import React, { useState, useEffect, useMemo } from 'react';
import { useHostel } from '../contexts/HostelContext';
import { Hostel } from '../types';
import { useAuth } from '../contexts/AuthContext';
import { 
  createHostel, 
  toggleHostelStatus, 
  updateHostel,
  deleteHostel,
  getAllSuperintendents,
  getAuditLogs,
  toggleSuperintendentStatus,
  reassignSuperintendent,
  resetSuperintendentPassword,
  SuperintendentRecord,
  SystemAuditLog 
} from '../services/hostelService';
import { 
  Building2, 
  Plus, 
  CheckCircle2, 
  AlertCircle, 
  AlertTriangle,
  MapPin, 
  X,
  Search,
  LayoutDashboard,
  UserCheck,
  ScrollText,
  LogOut,
  Trash2,
  Settings,
  Shield,
  Utensils,
  QrCode,
  Users,
  BedDouble,
  ChevronRight,
  ChevronLeft,
  KeyRound,
  ExternalLink,
  Info,
  Database
} from 'lucide-react';
import DataBackupSection from './superadmin/DataBackupSection';

function formatDate(val: any): string {
  if (!val) return 'Not configured';
  if (typeof val === 'object' && typeof val.seconds === 'number') {
    return new Date(val.seconds * 1000).toLocaleDateString();
  }
  const d = new Date(val);
  if (isNaN(d.getTime())) return 'Not configured';
  return d.toLocaleDateString();
}

export interface SetupCheckItem {
  key: string;
  label: string;
  isComplete: boolean;
  details: string;
}

export function calculateHostelSetup(hostel: Hostel): {
  percentage: number;
  checks: SetupCheckItem[];
} {
  const checks: SetupCheckItem[] = [
    {
      key: 'info',
      label: 'Hostel Information',
      isComplete: Boolean(hostel.name && hostel.district && hostel.type),
      details: hostel.district ? `District: ${hostel.district} (${hostel.type || 'Standard'})` : 'Missing district or type'
    },
    {
      key: 'incharge',
      label: 'In-charge Assigned',
      isComplete: Boolean(
        hostel.superintendentName && 
        hostel.superintendentName !== 'Unassigned' && 
        hostel.superintendentEmail && 
        hostel.superintendentEmail !== 'N/A'
      ),
      details: hostel.superintendentName && hostel.superintendentName !== 'Unassigned'
        ? `${hostel.superintendentName} (${hostel.superintendentEmail || 'Email set'})`
        : 'No superintendent assigned'
    },
    {
      key: 'capacity',
      label: 'Rooms & Capacity Configured',
      isComplete: Boolean((hostel.totalRooms || 0) > 0 && (hostel.capacity || 0) > 0),
      details: (hostel.totalRooms || 0) > 0 
        ? `${hostel.totalRooms} rooms (${hostel.capacity || 0} total capacity)`
        : 'Rooms and bed capacity not set'
    },
    {
      key: 'mess',
      label: 'Mess Configuration',
      isComplete: hostel.messEnabled === false 
        ? true 
        : Boolean(hostel.mealRates && (hostel.mealRates.lunchPrice > 0 || hostel.mealRates.dinnerPrice > 0)),
      details: hostel.messEnabled === false
        ? 'Mess disabled by Super Admin'
        : hostel.mealRates
        ? `Lunch: ₹${hostel.mealRates.lunchPrice || 0}, Dinner: ₹${hostel.mealRates.dinnerPrice || 0}`
        : 'Meal rates not specified'
    },
    {
      key: 'gate_qr',
      label: 'QR Gate & Attendance Ready',
      isComplete: hostel.qrGateAttendanceEnabled !== false && hostel.qrEnabled !== false,
      details: hostel.qrGateAttendanceEnabled !== false
        ? 'QR gate scanner & movement tracking enabled'
        : 'Gate QR system disabled'
    }
  ];

  const completedCount = checks.filter(c => c.isComplete).length;
  const percentage = Math.round((completedCount / checks.length) * 100);

  return { percentage, checks };
}

interface SuperAdminDashboardProps {
  onSelectHostel?: (hostelId: string) => void;
  onSelectHostelDashboard?: (hostelId: string) => void;
}

export default function SuperAdminDashboard({ onSelectHostel, onSelectHostelDashboard }: SuperAdminDashboardProps) {
  const { availableHostels, refreshHostels, setActiveHostelId } = useHostel();
  const { user, userProfile, logout } = useAuth();

  // Navigation state (Dashboard | Hostels | In-charges | Data & Backup | System Logs)
  const [activeTab, setActiveTab] = useState<'dashboard' | 'hostels' | 'incharges' | 'backup' | 'logs'>('dashboard');

  // Search & Filter
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'disabled'>('all');

  // Toasts
  const [successMessage, setSuccessMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  // Modals
  const [showCreateHostelModal, setShowCreateHostelModal] = useState(false);
  const [createStep, setCreateStep] = useState<number>(1);
  const [showConfigModal, setShowConfigModal] = useState(false);
  const [configActiveSection, setConfigActiveSection] = useState<'basic' | 'capacity' | 'mess' | 'gate' | 'incharge'>('basic');
  const [showDeleteHostelModal, setShowDeleteHostelModal] = useState(false);
  const [showSetupStatusModal, setShowSetupStatusModal] = useState(false);

  // In-charge Modals
  const [showInchargeDetailModal, setShowInchargeDetailModal] = useState(false);
  const [showReassignModal, setShowReassignModal] = useState(false);
  const [selectedIncharge, setSelectedIncharge] = useState<SuperintendentRecord | null>(null);
  const [targetHostelIdForReassign, setTargetHostelIdForReassign] = useState('');

  // Selected hostel for config or delete or setup popup
  const [selectedHostel, setSelectedHostel] = useState<Hostel | null>(null);
  const [hostelToDelete, setHostelToDelete] = useState<Hostel | null>(null);
  const [deleteConfirmInput, setDeleteConfirmInput] = useState('');

  // Submitting Spinner
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Real Data from Firestore
  const [dbIncharges, setDbIncharges] = useState<SuperintendentRecord[]>([]);
  const [dbLogs, setDbLogs] = useState<SystemAuditLog[]>([]);

  // Fetch real database records
  const fetchRealData = async () => {
    try {
      const [supers, logs] = await Promise.all([
        getAllSuperintendents(),
        getAuditLogs()
      ]);
      setDbIncharges(supers);
      setDbLogs(logs);
    } catch (err) {
      console.error('Failed to load super admin records:', err);
    }
  };

  useEffect(() => {
    fetchRealData();
  }, [availableHostels]);

  // 6-Step Create Hostel Wizard State
  const [createHostelForm, setCreateHostelForm] = useState({
    // Step 1: Basic
    name: '',
    code: '',
    type: 'Boys' as 'Boys' | 'Girls',
    district: '',
    address: '',
    phone: '',
    email: '',
    college: 'Odisha Government College',
    // Step 2: Capacity
    totalRooms: 50,
    bedsPerRoom: 4,
    capacity: 200,
    buildings: 1,
    // Step 3: Mess
    messEnabled: true,
    lunchEnabled: true,
    dinnerEnabled: true,
    lunchPrice: 35,
    dinnerPrice: 35,
    // Step 4: Gate & QR
    qrGateAttendanceEnabled: true,
    gateMovementTrackingEnabled: true,
    // Step 5: In-charge
    inchargeMode: 'create' as 'create' | 'existing',
    selectedExistingSuperId: '',
    superintendentName: '',
    superintendentEmail: '',
    superintendentPhone: '',
    superintendentPass: 'Super@2026'
  });

  // Comprehensive Edit / Configure Form State
  const [configForm, setConfigForm] = useState({
    name: '',
    district: '',
    address: '',
    phone: '',
    email: '',
    type: 'Boys' as 'Boys' | 'Girls',
    college: '',
    totalRooms: 50,
    bedsPerRoom: 4,
    capacity: 200,
    messEnabled: true,
    lunchEnabled: true,
    dinnerEnabled: true,
    lunchPrice: 35,
    dinnerPrice: 35,
    qrGateAttendanceEnabled: true,
    gateMovementTrackingEnabled: true,
    superintendentId: '',
    superintendentName: '',
    superintendentEmail: '',
    superintendentPhone: ''
  });

  // Computed Real Summary Stats
  const totalHostelsCount = availableHostels.length;
  const activeHostelsCount = useMemo(() => {
    return availableHostels.filter(h => h.status === 'active' || h.isActive !== false).length;
  }, [availableHostels]);

  // Filtered Hostels
  const filteredHostels = useMemo(() => {
    return availableHostels.filter(hostel => {
      const matchesSearch = 
        !searchTerm.trim() ||
        hostel.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (hostel.district && hostel.district.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (hostel.superintendentName && hostel.superintendentName.toLowerCase().includes(searchTerm.toLowerCase()));

      const isHostelActive = hostel.status === 'active' || hostel.isActive !== false;
      const matchesStatus = 
        statusFilter === 'all' ||
        (statusFilter === 'active' && isHostelActive) ||
        (statusFilter === 'disabled' && !isHostelActive);

      return matchesSearch && matchesStatus;
    });
  }, [availableHostels, searchTerm, statusFilter]);

  // Handle Inspection Mode Open
  const handleOpenHostelInspection = (hostelId: string) => {
    setActiveHostelId(hostelId);
    if (onSelectHostelDashboard) {
      onSelectHostelDashboard(hostelId);
    } else if (onSelectHostel) {
      onSelectHostel(hostelId);
    }
  };

  // Handle Toggle Enable/Disable Status
  const handleToggleStatus = async (hostel: Hostel) => {
    try {
      const isCurrentlyActive = hostel.status === 'active' || hostel.isActive !== false;
      const newStatus = isCurrentlyActive ? 'inactive' : 'active';
      await toggleHostelStatus(hostel.id, newStatus);
      await refreshHostels();
      setSuccessMessage(`Hostel "${hostel.name}" status updated to ${newStatus === 'active' ? 'ACTIVE' : 'DISABLED'}.`);
      setTimeout(() => setSuccessMessage(''), 4000);
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to update hostel status');
      setTimeout(() => setErrorMessage(''), 4000);
    }
  };

  // Open Configure Modal
  const handleOpenConfigModal = (hostel: Hostel, defaultSection: 'basic' | 'capacity' | 'mess' | 'gate' | 'incharge' = 'basic') => {
    setSelectedHostel(hostel);
    setConfigActiveSection(defaultSection);
    setConfigForm({
      name: hostel.name || '',
      district: hostel.district || '',
      address: hostel.address || '',
      phone: hostel.phone || '',
      email: hostel.email || '',
      type: (hostel.type as any) || 'Boys',
      college: hostel.college || 'Odisha Government College',
      totalRooms: hostel.totalRooms || 50,
      bedsPerRoom: hostel.bedsPerRoom || (hostel.totalRooms && hostel.capacity ? Math.ceil(hostel.capacity / hostel.totalRooms) : 4),
      capacity: hostel.capacity || 200,
      messEnabled: hostel.messEnabled !== false,
      lunchEnabled: hostel.lunchEnabled !== false,
      dinnerEnabled: hostel.dinnerEnabled !== false,
      lunchPrice: hostel.mealRates?.lunchPrice ?? 35,
      dinnerPrice: hostel.mealRates?.dinnerPrice ?? 35,
      qrGateAttendanceEnabled: hostel.qrGateAttendanceEnabled !== false,
      gateMovementTrackingEnabled: hostel.gateMovementTrackingEnabled !== false,
      superintendentId: hostel.superintendentId || '',
      superintendentName: hostel.superintendentName || '',
      superintendentEmail: hostel.superintendentEmail || '',
      superintendentPhone: hostel.superintendentPhone || ''
    });
    setShowConfigModal(true);
  };

  // Open Setup Status Modal
  const handleOpenSetupStatus = (hostel: Hostel) => {
    setSelectedHostel(hostel);
    setShowSetupStatusModal(true);
  };

  // Save Configured Hostel
  const handleSaveConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedHostel) return;
    setIsSubmitting(true);
    try {
      await updateHostel(selectedHostel.id, {
        name: configForm.name,
        district: configForm.district,
        address: configForm.address,
        phone: configForm.phone,
        email: configForm.email,
        type: configForm.type,
        college: configForm.college,
        totalRooms: Number(configForm.totalRooms) || 0,
        bedsPerRoom: Number(configForm.bedsPerRoom) || 0,
        capacity: Number(configForm.capacity) || 0,
        messEnabled: configForm.messEnabled,
        lunchEnabled: configForm.lunchEnabled,
        dinnerEnabled: configForm.dinnerEnabled,
        qrGateAttendanceEnabled: configForm.qrGateAttendanceEnabled,
        gateMovementTrackingEnabled: configForm.gateMovementTrackingEnabled,
        superintendentId: configForm.superintendentId,
        superintendentName: configForm.superintendentName,
        superintendentEmail: configForm.superintendentEmail,
        superintendentPhone: configForm.superintendentPhone,
        mealRates: {
          lunchPrice: Number(configForm.lunchPrice) || 0,
          dinnerPrice: Number(configForm.dinnerPrice) || 0
        }
      });

      await refreshHostels();
      await fetchRealData();
      setShowConfigModal(false);
      setSelectedHostel(null);
      setSuccessMessage(`Configuration for "${configForm.name}" saved successfully.`);
      setTimeout(() => setSuccessMessage(''), 4000);
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to update hostel configuration.');
      setTimeout(() => setErrorMessage(''), 4000);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Open Delete Modal
  const handleOpenDeleteModal = (hostel: Hostel) => {
    setHostelToDelete(hostel);
    setDeleteConfirmInput('');
    setShowDeleteHostelModal(true);
  };

  // Confirm Delete Hostel
  const handleConfirmDelete = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!hostelToDelete) return;

    const expectedName = hostelToDelete.name.trim().replace(/’/g, "'").toLowerCase();
    const typedName = deleteConfirmInput.trim().replace(/’/g, "'").toLowerCase();

    if (typedName !== expectedName && typedName !== `delete ${expectedName}`) {
      setErrorMessage(`Confirmation phrase does not match. Please type "${hostelToDelete.name}" or "DELETE ${hostelToDelete.name}".`);
      return;
    }

    setIsSubmitting(true);
    try {
      await deleteHostel(hostelToDelete.id);
      await refreshHostels();
      await fetchRealData();

      setShowDeleteHostelModal(false);
      const deletedName = hostelToDelete.name;
      setHostelToDelete(null);
      setDeleteConfirmInput('');

      setSuccessMessage(`Hostel "${deletedName}" has been removed.`);
      setTimeout(() => setSuccessMessage(''), 4000);
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to delete hostel.');
      setTimeout(() => setErrorMessage(''), 4000);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle Wizard Create Hostel Submit
  const handleCreateHostelSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!createHostelForm.name.trim()) {
      setErrorMessage('Hostel name is required');
      setCreateStep(1);
      return;
    }
    if (!createHostelForm.code.trim()) {
      setErrorMessage('Hostel code is required');
      setCreateStep(1);
      return;
    }

    let superName = createHostelForm.superintendentName;
    let superEmail = createHostelForm.superintendentEmail;
    let superPhone = createHostelForm.superintendentPhone;
    let superId = '';

    if (createHostelForm.inchargeMode === 'existing' && createHostelForm.selectedExistingSuperId) {
      const found = dbIncharges.find(i => i.id === createHostelForm.selectedExistingSuperId);
      if (found) {
        superId = found.id;
        superName = found.name;
        superEmail = found.email;
        superPhone = found.phone || '';
      }
    }

    setIsSubmitting(true);
    try {
      await createHostel({
        name: createHostelForm.name,
        code: createHostelForm.code,
        district: createHostelForm.district || 'Sundargarh',
        address: createHostelForm.address || 'College Campus',
        phone: createHostelForm.phone || 'N/A',
        email: createHostelForm.email || 'N/A',
        type: createHostelForm.type,
        college: createHostelForm.college,
        buildings: createHostelForm.buildings,
        totalRooms: Number(createHostelForm.totalRooms) || 50,
        bedsPerRoom: Number(createHostelForm.bedsPerRoom) || 4,
        capacity: Number(createHostelForm.capacity) || 200,
        messEnabled: createHostelForm.messEnabled,
        lunchEnabled: createHostelForm.lunchEnabled,
        dinnerEnabled: createHostelForm.dinnerEnabled,
        lunchPrice: Number(createHostelForm.lunchPrice) || 35,
        dinnerPrice: Number(createHostelForm.dinnerPrice) || 35,
        qrGateAttendanceEnabled: createHostelForm.qrGateAttendanceEnabled,
        gateMovementTrackingEnabled: createHostelForm.gateMovementTrackingEnabled,
        superintendentId: superId,
        superintendentName: superName || 'Unassigned In-charge',
        superintendentEmail: superEmail || 'incharge@irahostel.in',
        superintendentPass: createHostelForm.superintendentPass || 'Super@2026',
        superintendentPhone: superPhone || 'N/A'
      });

      await refreshHostels();
      await fetchRealData();
      setShowCreateHostelModal(false);
      setCreateStep(1);
      setSuccessMessage(`New hostel "${createHostelForm.name}" created and configured successfully!`);
      setTimeout(() => setSuccessMessage(''), 4000);
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to create hostel');
      setTimeout(() => setErrorMessage(''), 4000);
    } finally {
      setIsSubmitting(false);
    }
  };

  // In-charge Actions
  const handleToggleInchargeStatus = async (inc: SuperintendentRecord) => {
    try {
      const isCurrentlyActive = inc.status === 'Active';
      const newStatus = !isCurrentlyActive;
      await toggleSuperintendentStatus(inc.id, newStatus, inc.name);
      await fetchRealData();
      setSuccessMessage(`In-charge "${inc.name}" account ${newStatus ? 'activated' : 'disabled'}.`);
      setTimeout(() => setSuccessMessage(''), 4000);
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to update in-charge status');
      setTimeout(() => setErrorMessage(''), 4000);
    }
  };

  const handleResetInchargePassword = async (inc: SuperintendentRecord) => {
    try {
      const res = await resetSuperintendentPassword(inc.id, inc.email, inc.name);
      await fetchRealData();
      setSuccessMessage(res.message);
      setTimeout(() => setSuccessMessage(''), 5000);
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to trigger password reset');
      setTimeout(() => setErrorMessage(''), 4000);
    }
  };

  const handleOpenReassignModal = (inc: SuperintendentRecord) => {
    setSelectedIncharge(inc);
    setTargetHostelIdForReassign(inc.hostelId || (availableHostels[0]?.id || ''));
    setShowReassignModal(true);
  };

  const handleConfirmReassign = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedIncharge || !targetHostelIdForReassign) return;
    const targetHostel = availableHostels.find(h => h.id === targetHostelIdForReassign);
    if (!targetHostel) return;

    setIsSubmitting(true);
    try {
      await reassignSuperintendent(
        selectedIncharge.id,
        selectedIncharge.name,
        targetHostel.id,
        targetHostel.name,
        selectedIncharge.email,
        selectedIncharge.phone
      );
      await refreshHostels();
      await fetchRealData();
      setShowReassignModal(false);
      setSelectedIncharge(null);
      setSuccessMessage(`In-charge "${selectedIncharge.name}" reassigned to ${targetHostel.name}.`);
      setTimeout(() => setSuccessMessage(''), 4000);
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to reassign hostel');
      setTimeout(() => setErrorMessage(''), 4000);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-white text-slate-800 flex flex-col font-sans">
      
      {/* TOP HEADER */}
      <header className="bg-white border-b border-slate-200 px-6 sm:px-8 lg:px-10 py-4 sticky top-0 z-30">
        <div className="w-full flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div>
              <h1 className="text-lg font-bold text-slate-900 leading-tight">IRA HOSTEL</h1>
              <p className="text-xs text-slate-500 font-medium">Super Admin Administration Portal</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="text-right hidden sm:block">
              <div className="text-xs font-semibold text-slate-900">{userProfile?.displayName || user?.email?.split('@')[0]}</div>
              <div className="text-[10px] text-slate-500 font-mono">SUPER ADMIN</div>
            </div>
            <button
              onClick={logout}
              className="bg-slate-100 hover:bg-slate-200 text-slate-700 p-2 rounded-lg transition cursor-pointer text-xs font-medium flex items-center gap-1.5"
              title="Logout"
            >
              <LogOut className="w-4 h-4" />
              <span className="hidden sm:inline">Logout</span>
            </button>
          </div>
        </div>
      </header>

      {/* NOTIFICATION MESSAGES */}
      {successMessage && (
        <div className="bg-emerald-50 border-b border-emerald-200 px-6 sm:px-8 lg:px-10 py-2.5 text-xs text-emerald-800 font-medium flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{successMessage}</span>
          </div>
          <button onClick={() => setSuccessMessage('')} className="text-emerald-700 hover:text-emerald-900">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {errorMessage && (
        <div className="bg-amber-50 border-b border-amber-200 px-6 sm:px-8 lg:px-10 py-2.5 text-xs text-amber-800 font-medium flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
            <span>{errorMessage}</span>
          </div>
          <button onClick={() => setErrorMessage('')} className="text-amber-700 hover:text-amber-900">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* MAIN CONTAINER */}
      <div className="w-full px-6 sm:px-8 lg:px-10 py-6 flex-1 flex flex-col md:flex-row gap-6">
        
        {/* SIDEBAR NAVIGATION */}
        <aside className="w-full md:w-60 shrink-0">
          <nav className="bg-white border border-slate-200 rounded-xl p-2 space-y-1 text-xs font-medium sticky top-24 shadow-2xs">
            <button
              onClick={() => setActiveTab('dashboard')}
              className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg transition cursor-pointer ${
                activeTab === 'dashboard'
                  ? 'bg-blue-50 text-blue-700 font-semibold border-l-4 border-blue-600'
                  : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
              }`}
            >
              <LayoutDashboard className="w-4 h-4 shrink-0" />
              <span>Dashboard</span>
            </button>

            <button
              onClick={() => setActiveTab('hostels')}
              className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg transition cursor-pointer ${
                activeTab === 'hostels'
                  ? 'bg-blue-50 text-blue-700 font-semibold border-l-4 border-blue-600'
                  : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
              }`}
            >
              <Building2 className="w-4 h-4 shrink-0" />
              <span>Hostels</span>
            </button>

            <button
              onClick={() => setActiveTab('incharges')}
              className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg transition cursor-pointer ${
                activeTab === 'incharges'
                  ? 'bg-blue-50 text-blue-700 font-semibold border-l-4 border-blue-600'
                  : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
              }`}
            >
              <UserCheck className="w-4 h-4 shrink-0" />
              <span>In-charges</span>
            </button>

            <button
              onClick={() => setActiveTab('backup')}
              className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg transition cursor-pointer ${
                activeTab === 'backup'
                  ? 'bg-blue-50 text-blue-700 font-semibold border-l-4 border-blue-600'
                  : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
              }`}
            >
              <Database className="w-4 h-4 shrink-0" />
              <span>Data & Backup</span>
            </button>

            <button
              onClick={() => setActiveTab('logs')}
              className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg transition cursor-pointer ${
                activeTab === 'logs'
                  ? 'bg-blue-50 text-blue-700 font-semibold border-l-4 border-blue-600'
                  : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
              }`}
            >
              <ScrollText className="w-4 h-4 shrink-0" />
              <span>System Logs</span>
            </button>
          </nav>
        </aside>

        {/* MAIN CONTENT AREA */}
        <main className="flex-1 min-w-0 space-y-6">

          {/* TAB 1: DASHBOARD & HOSTELS */}
          {(activeTab === 'dashboard' || activeTab === 'hostels') && (
            <div className="space-y-6">
              
              {/* PAGE HEADER */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-4">
                <div>
                  <h2 className="text-2xl font-bold text-slate-900 tracking-tight">Hostel Management</h2>
                  <p className="text-xs text-slate-500 font-medium mt-0.5">Central provisioning and multi-hostel administrative oversight.</p>
                </div>

                <button
                  onClick={() => {
                    setCreateStep(1);
                    setShowCreateHostelModal(true);
                  }}
                  className="bg-blue-600 hover:bg-blue-700 text-white font-medium px-4 py-2 rounded-lg text-xs transition cursor-pointer flex items-center gap-2 shadow-xs w-fit"
                >
                  <Plus className="w-4 h-4" />
                  <span>+ Add Hostel</span>
                </button>
              </div>

              {/* REAL DATA SUMMARY STATS */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-2xs">
                  <div className="text-xs text-slate-500 font-medium">Total Hostels</div>
                  <div className="text-2xl font-bold text-slate-900 mt-1">{totalHostelsCount}</div>
                </div>

                <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-2xs">
                  <div className="text-xs text-slate-500 font-medium">Active Hostels</div>
                  <div className="text-2xl font-bold text-emerald-700 mt-1">{activeHostelsCount}</div>
                </div>

                <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-2xs col-span-2 sm:col-span-1">
                  <div className="text-xs text-slate-500 font-medium">Assigned In-charges</div>
                  <div className="text-2xl font-bold text-slate-900 mt-1">{dbIncharges.length}</div>
                </div>
              </div>

              {/* FILTER & SEARCH ROW */}
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-white border border-slate-200 p-3 rounded-xl shadow-2xs">
                <div className="relative flex-1">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    placeholder="Search by hostel name, district, or in-charge..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg pl-9 pr-3 py-1.5 text-xs outline-none focus:border-blue-600 transition"
                  />
                </div>

                <div className="flex items-center gap-2 text-xs">
                  <span className="text-slate-500 font-medium">Filter:</span>
                  <select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value as any)}
                    className="bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs outline-none focus:border-blue-600 transition"
                  >
                    <option value="all">All Statuses</option>
                    <option value="active">Active Only</option>
                    <option value="disabled">Disabled Only</option>
                  </select>
                </div>
              </div>

              {/* HOSTELS LIST / GRID */}
              {filteredHostels.length === 0 ? (
                <div className="bg-white border border-slate-200 rounded-xl p-12 text-center space-y-3">
                  <Building2 className="w-10 h-10 text-slate-300 mx-auto" />
                  <div className="text-sm font-bold text-slate-800">
                    {availableHostels.length === 0 ? "No hostels added yet" : "No matching hostels found"}
                  </div>
                  <p className="text-xs text-slate-500 max-w-sm mx-auto">
                    {availableHostels.length === 0
                      ? "Get started by provisioning the first hostel in IRA Hostel."
                      : "Try adjusting your search criteria or filters."}
                  </p>
                  {availableHostels.length === 0 && (
                    <button
                      onClick={() => {
                        setCreateStep(1);
                        setShowCreateHostelModal(true);
                      }}
                      className="bg-blue-600 hover:bg-blue-700 text-white font-medium px-4 py-2 rounded-lg text-xs transition cursor-pointer inline-flex items-center gap-2 mt-2"
                    >
                      <Plus className="w-4 h-4" />
                      <span>Create First Hostel</span>
                    </button>
                  )}
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                  {filteredHostels.map((hostel) => {
                    const isActive = hostel.status === 'active' || hostel.isActive !== false;
                    const inchargeName = hostel.superintendentName && hostel.superintendentName !== 'Unassigned'
                      ? hostel.superintendentName
                      : 'Not assigned';
                    
                    const setup = calculateHostelSetup(hostel);

                    return (
                      <div
                        key={hostel.id}
                        className="bg-white border border-slate-200 rounded-xl p-5 space-y-4 flex flex-col justify-between hover:border-slate-300 transition shadow-2xs"
                      >
                        <div className="space-y-3">
                          {/* TOP ROW: NAME & STATUS */}
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <h3 className="font-bold text-slate-900 text-base leading-snug">{hostel.name}</h3>
                              <div className="text-xs text-slate-500 flex items-center gap-1 mt-0.5">
                                <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                                <span>District: {hostel.district || 'Not configured'}</span>
                              </div>
                            </div>

                            <span
                              className={`px-2.5 py-0.5 rounded-full text-[11px] font-semibold border shrink-0 ${
                                isActive
                                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                  : 'bg-rose-50 text-rose-700 border-rose-200'
                              }`}
                            >
                              {isActive ? 'ACTIVE' : 'DISABLED'}
                            </span>
                          </div>

                          {/* SETUP PROGRESS INDICATOR */}
                          <div 
                            onClick={() => handleOpenSetupStatus(hostel)}
                            className="bg-slate-50 hover:bg-slate-100/80 border border-slate-200/80 rounded-lg p-2.5 cursor-pointer transition space-y-1.5"
                            title="Click to view setup checklist and completion breakdown"
                          >
                            <div className="flex items-center justify-between text-xs">
                              <span className="font-semibold text-slate-700 flex items-center gap-1">
                                <span>Setup Status</span>
                                <Info className="w-3 h-3 text-slate-400" />
                              </span>
                              <span className={`font-bold font-mono ${setup.percentage === 100 ? 'text-emerald-700' : 'text-blue-700'}`}>
                                {setup.percentage}%
                              </span>
                            </div>

                            {/* Progress bar */}
                            <div className="w-full bg-slate-200 h-1.5 rounded-full overflow-hidden">
                              <div 
                                className={`h-full transition-all duration-300 ${setup.percentage === 100 ? 'bg-emerald-600' : 'bg-blue-600'}`}
                                style={{ width: `${setup.percentage}%` }}
                              />
                            </div>

                            {/* Compact mini-checklist summary */}
                            <div className="text-[11px] text-slate-500 flex items-center justify-between pt-0.5">
                              <span>{setup.checks.filter(c => c.isComplete).length} of {setup.checks.length} configured</span>
                              <span className="text-blue-600 font-medium hover:underline text-[11px]">View breakdown →</span>
                            </div>
                          </div>

                          {/* IN-CHARGE & CREATED DATE */}
                          <div className="text-xs text-slate-600 space-y-1 pt-1 border-t border-slate-100">
                            <div className="flex items-center justify-between">
                              <span className="text-slate-400">In-charge:</span>
                              <span className="font-medium text-slate-800 truncate max-w-[170px]" title={inchargeName}>{inchargeName}</span>
                            </div>
                            <div className="flex items-center justify-between">
                              <span className="text-slate-400">Created Date:</span>
                              <span className="font-mono text-slate-600">{formatDate(hostel.createdAt)}</span>
                            </div>
                          </div>
                        </div>

                        {/* ACTIONS */}
                        <div className="flex items-center gap-1.5 pt-3 border-t border-slate-100 text-xs">
                          <button
                            onClick={() => handleOpenHostelInspection(hostel.id)}
                            className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-medium py-1.5 px-2 rounded-lg transition cursor-pointer text-center"
                            title="Inspect hostel operational dashboard"
                          >
                            Open
                          </button>

                          <button
                            onClick={() => handleOpenConfigModal(hostel)}
                            className="bg-slate-100 hover:bg-slate-200 text-slate-700 px-2.5 py-1.5 rounded-lg transition cursor-pointer font-medium flex items-center gap-1"
                            title="Configure basic info, capacity, mess, QR & in-charge"
                          >
                            <Settings className="w-3.5 h-3.5" />
                            <span>Configure</span>
                          </button>

                          <button
                            onClick={() => handleToggleStatus(hostel)}
                            className={`px-2.5 py-1.5 rounded-lg transition cursor-pointer font-medium border ${
                              isActive
                                ? 'border-slate-200 text-slate-600 hover:bg-slate-50'
                                : 'bg-emerald-50 border-emerald-200 text-emerald-700 hover:bg-emerald-100'
                            }`}
                          >
                            {isActive ? 'Disable' : 'Enable'}
                          </button>

                          <button
                            onClick={() => handleOpenDeleteModal(hostel)}
                            className="bg-rose-50 hover:bg-rose-100 border border-rose-200 text-rose-700 px-2 py-1.5 rounded-lg transition cursor-pointer font-medium flex items-center gap-1"
                            title="Delete Hostel"
                          >
                            <Trash2 className="w-3.5 h-3.5 shrink-0" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* TAB 2: IN-CHARGES */}
          {activeTab === 'incharges' && (
            <div className="space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-4">
                <div>
                  <h2 className="text-2xl font-bold text-slate-900 tracking-tight">Hostel In-charges</h2>
                  <p className="text-xs text-slate-500 font-medium mt-0.5">Manage in-charge accounts, assignments, access status, and password resets.</p>
                </div>
              </div>

              <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-2xs">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold uppercase tracking-wider">
                      <tr>
                        <th className="px-4 py-3">In-charge Name</th>
                        <th className="px-4 py-3">Assigned Hostel</th>
                        <th className="px-4 py-3">Account Status</th>
                        <th className="px-4 py-3">Registered / Last Login</th>
                        <th className="px-4 py-3 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {dbIncharges.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="px-4 py-8 text-center text-slate-400">
                            No in-charge accounts registered in system.
                          </td>
                        </tr>
                      ) : (
                        dbIncharges.map((inc) => {
                          const isActive = inc.status === 'Active';
                          return (
                            <tr key={inc.id} className="hover:bg-slate-50/80 transition">
                              <td className="px-4 py-3">
                                <div className="font-semibold text-slate-900">{inc.name}</div>
                                <div className="font-mono text-slate-500 text-[11px]">{inc.email}</div>
                              </td>
                              <td className="px-4 py-3">
                                <span className="font-medium text-slate-800">{inc.hostelName || 'Unassigned'}</span>
                              </td>
                              <td className="px-4 py-3">
                                <span
                                  className={`px-2 py-0.5 rounded-full text-[10px] font-semibold border ${
                                    isActive
                                      ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                      : 'bg-rose-50 text-rose-700 border-rose-200'
                                  }`}
                                >
                                  {isActive ? 'Active' : 'Disabled'}
                                </span>
                              </td>
                              <td className="px-4 py-3 font-mono text-slate-500 text-[11px]">
                                {formatDate(inc.createdAt)}
                              </td>
                              <td className="px-4 py-3 text-right">
                                <div className="flex items-center justify-end gap-1.5">
                                  <button
                                    onClick={() => {
                                      setSelectedIncharge(inc);
                                      setShowInchargeDetailModal(true);
                                    }}
                                    className="bg-slate-100 hover:bg-slate-200 text-slate-700 px-2.5 py-1 rounded font-medium text-xs transition cursor-pointer"
                                  >
                                    View
                                  </button>

                                  <button
                                    onClick={() => handleOpenReassignModal(inc)}
                                    className="bg-blue-50 hover:bg-blue-100 text-blue-700 px-2.5 py-1 rounded font-medium text-xs transition cursor-pointer border border-blue-200"
                                  >
                                    Assign / Reassign
                                  </button>

                                  <button
                                    onClick={() => handleToggleInchargeStatus(inc)}
                                    className={`px-2.5 py-1 rounded font-medium text-xs transition cursor-pointer border ${
                                      isActive
                                        ? 'border-slate-200 text-slate-600 hover:bg-slate-100'
                                        : 'bg-emerald-50 border-emerald-200 text-emerald-700 hover:bg-emerald-100'
                                    }`}
                                  >
                                    {isActive ? 'Disable' : 'Enable'}
                                  </button>

                                  <button
                                    onClick={() => handleResetInchargePassword(inc)}
                                    className="bg-slate-100 hover:bg-slate-200 text-slate-700 px-2 py-1 rounded font-medium text-xs transition cursor-pointer flex items-center gap-1"
                                    title="Reset Password"
                                  >
                                    <KeyRound className="w-3 h-3 text-slate-500" />
                                    <span>Reset Password</span>
                                  </button>
                                </div>
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: DATA & BACKUP */}
          {activeTab === 'backup' && (
            <DataBackupSection
              adminEmail={user?.email || 'admin@irahostel.com'}
              adminName={userProfile?.displayName || user?.email?.split('@')[0] || 'Super Admin'}
              onRefreshGlobalState={async () => {
                await refreshHostels();
                await fetchRealData();
              }}
              onLogCreated={fetchRealData}
            />
          )}

          {/* TAB 4: SYSTEM LOGS */}
          {activeTab === 'logs' && (
            <div className="space-y-6">
              <div className="border-b border-slate-200 pb-4">
                <h2 className="text-2xl font-bold text-slate-900 tracking-tight">System Activity Logs</h2>
                <p className="text-xs text-slate-500 font-medium mt-0.5">Audit trail of Super Admin provisioning, configuration changes, and in-charge management.</p>
              </div>

              <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-2xs">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold uppercase tracking-wider">
                      <tr>
                        <th className="px-4 py-3">Date & Time</th>
                        <th className="px-4 py-3">Action</th>
                        <th className="px-4 py-3">Hostel</th>
                        <th className="px-4 py-3">Details</th>
                        <th className="px-4 py-3">Actor / Role</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {dbLogs.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="px-4 py-8 text-center text-slate-400">
                            No log events recorded yet.
                          </td>
                        </tr>
                      ) : (
                        dbLogs.map((log) => (
                          <tr key={log.id} className="hover:bg-slate-50/80 transition">
                            <td className="px-4 py-3 font-mono text-slate-500 text-[11px] whitespace-nowrap">
                              {log.timestamp ? new Date(log.timestamp).toLocaleString() : 'N/A'}
                            </td>
                            <td className="px-4 py-3">
                              <span className="font-semibold text-slate-800 bg-slate-100 px-2 py-0.5 rounded font-mono text-[11px]">
                                {log.action}
                              </span>
                            </td>
                            <td className="px-4 py-3 font-medium text-slate-700">
                              {log.hostelId && log.hostelId !== 'global' ? log.hostelId : '—'}
                            </td>
                            <td className="px-4 py-3 text-slate-600 max-w-md">
                              {log.details}
                            </td>
                            <td className="px-4 py-3 text-slate-500 font-mono text-[11px]">
                              {log.role || 'Super Admin'}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

        </main>
      </div>

      {/* ========================================================================= */}
      {/* MODAL: 6-STEP ADD HOSTEL WORKFLOW */}
      {/* ========================================================================= */}
      {showCreateHostelModal && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl border border-slate-200 max-w-2xl w-full p-6 space-y-5 max-h-[92vh] overflow-y-auto shadow-xl">
            
            {/* Header */}
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-base font-bold text-slate-900">Add New Hostel</h3>
                <p className="text-xs text-slate-500">Step {createStep} of 6 — Provision new hostel in IRA Hostel</p>
              </div>
              <button
                onClick={() => setShowCreateHostelModal(false)}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Stepper Navigation Indicator */}
            <div className="grid grid-cols-6 gap-1 bg-slate-50 p-1.5 rounded-lg border border-slate-200/80 text-[11px] font-medium text-center">
              {[
                { step: 1, label: '1. Basic' },
                { step: 2, label: '2. Capacity' },
                { step: 3, label: '3. Mess' },
                { step: 4, label: '4. Gate & QR' },
                { step: 5, label: '5. In-charge' },
                { step: 6, label: '6. Review' }
              ].map((s) => (
                <button
                  key={s.step}
                  type="button"
                  onClick={() => setCreateStep(s.step)}
                  className={`py-1 rounded transition ${
                    createStep === s.step
                      ? 'bg-blue-600 text-white font-semibold shadow-2xs'
                      : createStep > s.step
                      ? 'text-emerald-700 bg-emerald-50'
                      : 'text-slate-500 hover:bg-slate-100'
                  }`}
                >
                  {s.label}
                </button>
              ))}
            </div>

            {/* Step Form Body */}
            <form onSubmit={handleCreateHostelSubmit} className="space-y-4 text-xs">
              
              {/* STEP 1: Basic Information */}
              {createStep === 1 && (
                <div className="space-y-4">
                  <div className="space-y-1">
                    <label className="font-medium text-slate-700">Hostel Name *</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Gangpur Boys' Hostel"
                      value={createHostelForm.name}
                      onChange={(e) => setCreateHostelForm({ ...createHostelForm, name: e.target.value })}
                      className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs outline-none focus:border-blue-600"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="font-medium text-slate-700">Hostel Code / Identifier *</label>
                      <input
                        type="text"
                        required
                        placeholder="e.g. gangpur-boys"
                        value={createHostelForm.code}
                        onChange={(e) => setCreateHostelForm({ ...createHostelForm, code: e.target.value })}
                        className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs outline-none focus:border-blue-600 font-mono"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="font-medium text-slate-700">Hostel Type</label>
                      <select
                        value={createHostelForm.type}
                        onChange={(e) => setCreateHostelForm({ ...createHostelForm, type: e.target.value as any })}
                        className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs outline-none focus:border-blue-600"
                      >
                        <option value="Boys">Boys' Hostel</option>
                        <option value="Girls">Girls' Hostel</option>
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="font-medium text-slate-700">District</label>
                      <input
                        type="text"
                        placeholder="e.g. Sundargarh"
                        value={createHostelForm.district}
                        onChange={(e) => setCreateHostelForm({ ...createHostelForm, district: e.target.value })}
                        className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs outline-none focus:border-blue-600"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="font-medium text-slate-700">College / Institution</label>
                      <input
                        type="text"
                        placeholder="e.g. Government College"
                        value={createHostelForm.college}
                        onChange={(e) => setCreateHostelForm({ ...createHostelForm, college: e.target.value })}
                        className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs outline-none focus:border-blue-600"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="font-medium text-slate-700">Contact Phone</label>
                      <input
                        type="text"
                        placeholder="Official phone"
                        value={createHostelForm.phone}
                        onChange={(e) => setCreateHostelForm({ ...createHostelForm, phone: e.target.value })}
                        className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs outline-none focus:border-blue-600 font-mono"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="font-medium text-slate-700">Contact Email</label>
                      <input
                        type="email"
                        placeholder="Official email"
                        value={createHostelForm.email}
                        onChange={(e) => setCreateHostelForm({ ...createHostelForm, email: e.target.value })}
                        className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs outline-none focus:border-blue-600 font-mono"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* STEP 2: Capacity */}
              {createStep === 2 && (
                <div className="space-y-4">
                  <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg text-blue-900 text-xs">
                    Set up hostel block parameters for room allocation and bed capacity management.
                  </div>

                  <div className="grid grid-cols-3 gap-3">
                    <div className="space-y-1">
                      <label className="font-medium text-slate-700">Number of Rooms *</label>
                      <input
                        type="number"
                        min="1"
                        required
                        value={createHostelForm.totalRooms}
                        onChange={(e) => {
                          const rooms = Number(e.target.value);
                          setCreateHostelForm({ 
                            ...createHostelForm, 
                            totalRooms: rooms,
                            capacity: rooms * createHostelForm.bedsPerRoom 
                          });
                        }}
                        className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs outline-none focus:border-blue-600 font-mono"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="font-medium text-slate-700">Beds per Room</label>
                      <input
                        type="number"
                        min="1"
                        value={createHostelForm.bedsPerRoom}
                        onChange={(e) => {
                          const beds = Number(e.target.value);
                          setCreateHostelForm({ 
                            ...createHostelForm, 
                            bedsPerRoom: beds,
                            capacity: createHostelForm.totalRooms * beds 
                          });
                        }}
                        className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs outline-none focus:border-blue-600 font-mono"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="font-medium text-slate-700">Total Capacity (Beds)</label>
                      <input
                        type="number"
                        min="1"
                        value={createHostelForm.capacity}
                        onChange={(e) => setCreateHostelForm({ ...createHostelForm, capacity: Number(e.target.value) })}
                        className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs outline-none focus:border-blue-600 font-mono font-bold"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* STEP 3: Mess */}
              {createStep === 3 && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between p-3 bg-slate-50 border border-slate-200 rounded-lg">
                    <div>
                      <div className="font-bold text-slate-900">Enable Mess System</div>
                      <div className="text-slate-500 text-[11px]">Enable student daily meal logging, billing, and session management</div>
                    </div>
                    <input
                      type="checkbox"
                      checked={createHostelForm.messEnabled}
                      onChange={(e) => setCreateHostelForm({ ...createHostelForm, messEnabled: e.target.checked })}
                      className="w-4 h-4 text-blue-600 rounded cursor-pointer"
                    />
                  </div>

                  {createHostelForm.messEnabled && (
                    <div className="space-y-3 pl-2 border-l-2 border-blue-200">
                      <div className="grid grid-cols-2 gap-3">
                        <label className="flex items-center gap-2 text-slate-700 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={createHostelForm.lunchEnabled}
                            onChange={(e) => setCreateHostelForm({ ...createHostelForm, lunchEnabled: e.target.checked })}
                            className="w-4 h-4 text-blue-600 rounded"
                          />
                          <span>Enable Lunch Service</span>
                        </label>

                        <label className="flex items-center gap-2 text-slate-700 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={createHostelForm.dinnerEnabled}
                            onChange={(e) => setCreateHostelForm({ ...createHostelForm, dinnerEnabled: e.target.checked })}
                            className="w-4 h-4 text-blue-600 rounded"
                          />
                          <span>Enable Dinner Service</span>
                        </label>
                      </div>

                      <div className="grid grid-cols-2 gap-3 pt-2">
                        <div className="space-y-1">
                          <label className="font-medium text-slate-700">Lunch Price (₹ per meal)</label>
                          <input
                            type="number"
                            min="0"
                            value={createHostelForm.lunchPrice}
                            onChange={(e) => setCreateHostelForm({ ...createHostelForm, lunchPrice: Number(e.target.value) })}
                            className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs outline-none focus:border-blue-600 font-mono"
                          />
                        </div>

                        <div className="space-y-1">
                          <label className="font-medium text-slate-700">Dinner Price (₹ per meal)</label>
                          <input
                            type="number"
                            min="0"
                            value={createHostelForm.dinnerPrice}
                            onChange={(e) => setCreateHostelForm({ ...createHostelForm, dinnerPrice: Number(e.target.value) })}
                            className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs outline-none focus:border-blue-600 font-mono"
                          />
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* STEP 4: Gate & QR */}
              {createStep === 4 && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between p-3 bg-slate-50 border border-slate-200 rounded-lg">
                    <div>
                      <div className="font-bold text-slate-900">QR Gate Attendance System</div>
                      <div className="text-slate-500 text-[11px]">Enable student QR card scanning at hostel entry / exit</div>
                    </div>
                    <input
                      type="checkbox"
                      checked={createHostelForm.qrGateAttendanceEnabled}
                      onChange={(e) => setCreateHostelForm({ ...createHostelForm, qrGateAttendanceEnabled: e.target.checked })}
                      className="w-4 h-4 text-blue-600 rounded cursor-pointer"
                    />
                  </div>

                  <div className="flex items-center justify-between p-3 bg-slate-50 border border-slate-200 rounded-lg">
                    <div>
                      <div className="font-bold text-slate-900">Gate Movement Tracking</div>
                      <div className="text-slate-500 text-[11px]">Log movement timestamp and in/out register for student safety</div>
                    </div>
                    <input
                      type="checkbox"
                      checked={createHostelForm.gateMovementTrackingEnabled}
                      onChange={(e) => setCreateHostelForm({ ...createHostelForm, gateMovementTrackingEnabled: e.target.checked })}
                      className="w-4 h-4 text-blue-600 rounded cursor-pointer"
                    />
                  </div>
                </div>
              )}

              {/* STEP 5: Assign In-charge */}
              {createStep === 5 && (
                <div className="space-y-4">
                  <div className="flex items-center gap-4 border-b border-slate-100 pb-2">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="radio"
                        name="inchargeMode"
                        checked={createHostelForm.inchargeMode === 'create'}
                        onChange={() => setCreateHostelForm({ ...createHostelForm, inchargeMode: 'create' })}
                        className="text-blue-600"
                      />
                      <span className="font-medium text-slate-800">Create New In-charge Account</span>
                    </label>

                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="radio"
                        name="inchargeMode"
                        checked={createHostelForm.inchargeMode === 'existing'}
                        onChange={() => setCreateHostelForm({ ...createHostelForm, inchargeMode: 'existing' })}
                        className="text-blue-600"
                      />
                      <span className="font-medium text-slate-800">Assign Existing In-charge</span>
                    </label>
                  </div>

                  {createHostelForm.inchargeMode === 'existing' ? (
                    <div className="space-y-2">
                      <label className="font-medium text-slate-700">Select Existing In-charge</label>
                      <select
                        value={createHostelForm.selectedExistingSuperId}
                        onChange={(e) => setCreateHostelForm({ ...createHostelForm, selectedExistingSuperId: e.target.value })}
                        className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs outline-none focus:border-blue-600"
                      >
                        <option value="">-- Choose an in-charge --</option>
                        {dbIncharges.map(inc => (
                          <option key={inc.id} value={inc.id}>
                            {inc.name} ({inc.email}) - currently assigned to {inc.hostelName || 'None'}
                          </option>
                        ))}
                      </select>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <div className="space-y-1">
                        <label className="font-medium text-slate-700">In-charge Full Name</label>
                        <input
                          type="text"
                          placeholder="e.g. Dr. Rajesh Kumar"
                          value={createHostelForm.superintendentName}
                          onChange={(e) => setCreateHostelForm({ ...createHostelForm, superintendentName: e.target.value })}
                          className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs outline-none focus:border-blue-600"
                        />
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1">
                          <label className="font-medium text-slate-700">In-charge Email *</label>
                          <input
                            type="email"
                            required={createHostelForm.inchargeMode === 'create'}
                            placeholder="incharge@irahostel.in"
                            value={createHostelForm.superintendentEmail}
                            onChange={(e) => setCreateHostelForm({ ...createHostelForm, superintendentEmail: e.target.value })}
                            className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs outline-none focus:border-blue-600 font-mono"
                          />
                        </div>

                        <div className="space-y-1">
                          <label className="font-medium text-slate-700">In-charge Password</label>
                          <input
                            type="text"
                            value={createHostelForm.superintendentPass}
                            onChange={(e) => setCreateHostelForm({ ...createHostelForm, superintendentPass: e.target.value })}
                            className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs outline-none focus:border-blue-600 font-mono"
                          />
                        </div>
                      </div>

                      <div className="space-y-1">
                        <label className="font-medium text-slate-700">In-charge Phone</label>
                        <input
                          type="text"
                          placeholder="Phone number"
                          value={createHostelForm.superintendentPhone}
                          onChange={(e) => setCreateHostelForm({ ...createHostelForm, superintendentPhone: e.target.value })}
                          className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs outline-none focus:border-blue-600 font-mono"
                        />
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* STEP 6: Review */}
              {createStep === 6 && (
                <div className="space-y-4">
                  <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
                    <div className="text-xs font-bold text-slate-900 border-b border-slate-200 pb-2">
                      Hostel Provisioning Summary
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div>
                        <span className="text-slate-400 block">Hostel Name:</span>
                        <span className="font-bold text-slate-800">{createHostelForm.name || 'Not provided'}</span>
                      </div>

                      <div>
                        <span className="text-slate-400 block">District & Type:</span>
                        <span className="font-medium text-slate-800">{createHostelForm.district || 'Unassigned'} ({createHostelForm.type})</span>
                      </div>

                      <div>
                        <span className="text-slate-400 block">Capacity:</span>
                        <span className="font-mono text-slate-800">{createHostelForm.totalRooms} Rooms ({createHostelForm.capacity} Beds)</span>
                      </div>

                      <div>
                        <span className="text-slate-400 block">Mess System:</span>
                        <span className="font-medium text-slate-800">
                          {createHostelForm.messEnabled 
                            ? `Enabled (Lunch: ₹${createHostelForm.lunchPrice}, Dinner: ₹${createHostelForm.dinnerPrice})`
                            : 'Disabled'}
                        </span>
                      </div>

                      <div>
                        <span className="text-slate-400 block">Gate / QR:</span>
                        <span className="font-medium text-slate-800">
                          {createHostelForm.qrGateAttendanceEnabled ? 'QR Gate Scanner Active' : 'Disabled'}
                        </span>
                      </div>

                      <div>
                        <span className="text-slate-400 block">In-charge:</span>
                        <span className="font-medium text-slate-800">
                          {createHostelForm.inchargeMode === 'existing'
                            ? (dbIncharges.find(i => i.id === createHostelForm.selectedExistingSuperId)?.name || 'Selected In-charge')
                            : (createHostelForm.superintendentName || createHostelForm.superintendentEmail || 'Unassigned')}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Wizard Footer Navigation */}
              <div className="flex items-center justify-between border-t border-slate-100 pt-4">
                {createStep > 1 ? (
                  <button
                    type="button"
                    onClick={() => setCreateStep(createStep - 1)}
                    className="bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium px-4 py-2 rounded-lg text-xs transition cursor-pointer flex items-center gap-1"
                  >
                    <ChevronLeft className="w-4 h-4" />
                    <span>Back</span>
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => setShowCreateHostelModal(false)}
                    className="bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 px-4 py-2 rounded-lg font-medium text-xs"
                  >
                    Cancel
                  </button>
                )}

                {createStep < 6 ? (
                  <button
                    type="button"
                    onClick={() => setCreateStep(createStep + 1)}
                    className="bg-blue-600 hover:bg-blue-700 text-white font-medium px-4 py-2 rounded-lg text-xs transition cursor-pointer flex items-center gap-1"
                  >
                    <span>Next</span>
                    <ChevronRight className="w-4 h-4" />
                  </button>
                ) : (
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="bg-blue-600 hover:bg-blue-700 text-white font-bold px-5 py-2 rounded-lg text-xs transition cursor-pointer shadow-xs"
                  >
                    {isSubmitting ? 'Provisioning...' : 'Create Hostel'}
                  </button>
                )}
              </div>

            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: COMPREHENSIVE CONFIGURE / EDIT HOSTEL */}
      {/* ========================================================================= */}
      {showConfigModal && selectedHostel && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl border border-slate-200 max-w-2xl w-full p-6 space-y-5 max-h-[92vh] overflow-y-auto shadow-xl">
            
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-base font-bold text-slate-900">Configure Hostel</h3>
                <p className="text-xs text-slate-500">{selectedHostel.name}</p>
              </div>
              <button
                onClick={() => {
                  setShowConfigModal(false);
                  setSelectedHostel(null);
                }}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Section Tabs */}
            <div className="flex items-center gap-1 border-b border-slate-200 pb-2 text-xs font-medium overflow-x-auto">
              <button
                type="button"
                onClick={() => setConfigActiveSection('basic')}
                className={`px-3 py-1.5 rounded-lg transition whitespace-nowrap ${
                  configActiveSection === 'basic'
                    ? 'bg-blue-600 text-white font-semibold'
                    : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                Basic Info
              </button>

              <button
                type="button"
                onClick={() => setConfigActiveSection('capacity')}
                className={`px-3 py-1.5 rounded-lg transition whitespace-nowrap ${
                  configActiveSection === 'capacity'
                    ? 'bg-blue-600 text-white font-semibold'
                    : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                Capacity
              </button>

              <button
                type="button"
                onClick={() => setConfigActiveSection('mess')}
                className={`px-3 py-1.5 rounded-lg transition whitespace-nowrap ${
                  configActiveSection === 'mess'
                    ? 'bg-blue-600 text-white font-semibold'
                    : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                Mess
              </button>

              <button
                type="button"
                onClick={() => setConfigActiveSection('gate')}
                className={`px-3 py-1.5 rounded-lg transition whitespace-nowrap ${
                  configActiveSection === 'gate'
                    ? 'bg-blue-600 text-white font-semibold'
                    : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                Gate / QR
              </button>

              <button
                type="button"
                onClick={() => setConfigActiveSection('incharge')}
                className={`px-3 py-1.5 rounded-lg transition whitespace-nowrap ${
                  configActiveSection === 'incharge'
                    ? 'bg-blue-600 text-white font-semibold'
                    : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                In-charge
              </button>
            </div>

            <form onSubmit={handleSaveConfig} className="space-y-4 text-xs">
              
              {/* BASIC INFO */}
              {configActiveSection === 'basic' && (
                <div className="space-y-4">
                  <div className="space-y-1">
                    <label className="font-medium text-slate-700">Hostel Name</label>
                    <input
                      type="text"
                      required
                      value={configForm.name}
                      onChange={(e) => setConfigForm({ ...configForm, name: e.target.value })}
                      className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs outline-none focus:border-blue-600"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="font-medium text-slate-700">District</label>
                      <input
                        type="text"
                        value={configForm.district}
                        onChange={(e) => setConfigForm({ ...configForm, district: e.target.value })}
                        className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs outline-none focus:border-blue-600"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="font-medium text-slate-700">Hostel Type</label>
                      <select
                        value={configForm.type}
                        onChange={(e) => setConfigForm({ ...configForm, type: e.target.value as any })}
                        className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs outline-none focus:border-blue-600"
                      >
                        <option value="Boys">Boys' Hostel</option>
                        <option value="Girls">Girls' Hostel</option>
                      </select>
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label className="font-medium text-slate-700">Location / Campus Address</label>
                    <input
                      type="text"
                      value={configForm.address}
                      onChange={(e) => setConfigForm({ ...configForm, address: e.target.value })}
                      className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs outline-none focus:border-blue-600"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="font-medium text-slate-700">Contact Phone</label>
                      <input
                        type="text"
                        value={configForm.phone}
                        onChange={(e) => setConfigForm({ ...configForm, phone: e.target.value })}
                        className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs outline-none focus:border-blue-600 font-mono"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="font-medium text-slate-700">Contact Email</label>
                      <input
                        type="email"
                        value={configForm.email}
                        onChange={(e) => setConfigForm({ ...configForm, email: e.target.value })}
                        className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs outline-none focus:border-blue-600 font-mono"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* CAPACITY */}
              {configActiveSection === 'capacity' && (
                <div className="space-y-4">
                  <div className="grid grid-cols-3 gap-3">
                    <div className="space-y-1">
                      <label className="font-medium text-slate-700">Number of Rooms</label>
                      <input
                        type="number"
                        min="1"
                        value={configForm.totalRooms}
                        onChange={(e) => {
                          const rooms = Number(e.target.value);
                          setConfigForm({ 
                            ...configForm, 
                            totalRooms: rooms,
                            capacity: rooms * configForm.bedsPerRoom 
                          });
                        }}
                        className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs outline-none focus:border-blue-600 font-mono"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="font-medium text-slate-700">Beds per Room</label>
                      <input
                        type="number"
                        min="1"
                        value={configForm.bedsPerRoom}
                        onChange={(e) => {
                          const beds = Number(e.target.value);
                          setConfigForm({ 
                            ...configForm, 
                            bedsPerRoom: beds,
                            capacity: configForm.totalRooms * beds 
                          });
                        }}
                        className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs outline-none focus:border-blue-600 font-mono"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="font-medium text-slate-700">Total Capacity</label>
                      <input
                        type="number"
                        min="1"
                        value={configForm.capacity}
                        onChange={(e) => setConfigForm({ ...configForm, capacity: Number(e.target.value) })}
                        className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs outline-none focus:border-blue-600 font-mono font-bold"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* MESS */}
              {configActiveSection === 'mess' && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between p-3 bg-slate-50 border border-slate-200 rounded-lg">
                    <div>
                      <div className="font-bold text-slate-900">Mess System Enabled</div>
                      <div className="text-slate-500 text-[11px]">Enable student dining register and meal rates</div>
                    </div>
                    <input
                      type="checkbox"
                      checked={configForm.messEnabled}
                      onChange={(e) => setConfigForm({ ...configForm, messEnabled: e.target.checked })}
                      className="w-4 h-4 text-blue-600 rounded cursor-pointer"
                    />
                  </div>

                  {configForm.messEnabled && (
                    <div className="space-y-3 pl-2 border-l-2 border-blue-200">
                      <div className="grid grid-cols-2 gap-3">
                        <label className="flex items-center gap-2 text-slate-700 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={configForm.lunchEnabled}
                            onChange={(e) => setConfigForm({ ...configForm, lunchEnabled: e.target.checked })}
                            className="w-4 h-4 text-blue-600 rounded"
                          />
                          <span>Lunch Enabled</span>
                        </label>

                        <label className="flex items-center gap-2 text-slate-700 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={configForm.dinnerEnabled}
                            onChange={(e) => setConfigForm({ ...configForm, dinnerEnabled: e.target.checked })}
                            className="w-4 h-4 text-blue-600 rounded"
                          />
                          <span>Dinner Enabled</span>
                        </label>
                      </div>

                      <div className="grid grid-cols-2 gap-3 pt-2">
                        <div className="space-y-1">
                          <label className="font-medium text-slate-700">Lunch Price (₹)</label>
                          <input
                            type="number"
                            min="0"
                            value={configForm.lunchPrice}
                            onChange={(e) => setConfigForm({ ...configForm, lunchPrice: Number(e.target.value) })}
                            className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs outline-none focus:border-blue-600 font-mono"
                          />
                        </div>

                        <div className="space-y-1">
                          <label className="font-medium text-slate-700">Dinner Price (₹)</label>
                          <input
                            type="number"
                            min="0"
                            value={configForm.dinnerPrice}
                            onChange={(e) => setConfigForm({ ...configForm, dinnerPrice: Number(e.target.value) })}
                            className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs outline-none focus:border-blue-600 font-mono"
                          />
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* GATE / QR */}
              {configActiveSection === 'gate' && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between p-3 bg-slate-50 border border-slate-200 rounded-lg">
                    <div>
                      <div className="font-bold text-slate-900">QR Gate Attendance</div>
                      <div className="text-slate-500 text-[11px]">Allow in-charge scanning of student QR badges at gate</div>
                    </div>
                    <input
                      type="checkbox"
                      checked={configForm.qrGateAttendanceEnabled}
                      onChange={(e) => setConfigForm({ ...configForm, qrGateAttendanceEnabled: e.target.checked })}
                      className="w-4 h-4 text-blue-600 rounded cursor-pointer"
                    />
                  </div>

                  <div className="flex items-center justify-between p-3 bg-slate-50 border border-slate-200 rounded-lg">
                    <div>
                      <div className="font-bold text-slate-900">Gate Movement Tracking</div>
                      <div className="text-slate-500 text-[11px]">Track student in/out movement and curfews</div>
                    </div>
                    <input
                      type="checkbox"
                      checked={configForm.gateMovementTrackingEnabled}
                      onChange={(e) => setConfigForm({ ...configForm, gateMovementTrackingEnabled: e.target.checked })}
                      className="w-4 h-4 text-blue-600 rounded cursor-pointer"
                    />
                  </div>
                </div>
              )}

              {/* IN-CHARGE */}
              {configActiveSection === 'incharge' && (
                <div className="space-y-4">
                  <div className="space-y-1">
                    <label className="font-medium text-slate-700">Assigned In-charge (Quick Pick)</label>
                    <select
                      value={configForm.superintendentId}
                      onChange={(e) => {
                        const selId = e.target.value;
                        const found = dbIncharges.find(i => i.id === selId);
                        if (found) {
                          setConfigForm({
                            ...configForm,
                            superintendentId: found.id,
                            superintendentName: found.name,
                            superintendentEmail: found.email,
                            superintendentPhone: found.phone || ''
                          });
                        }
                      }}
                      className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs outline-none focus:border-blue-600"
                    >
                      <option value="">-- Choose from existing In-charges --</option>
                      {dbIncharges.map(inc => (
                        <option key={inc.id} value={inc.id}>
                          {inc.name} ({inc.email})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label className="font-medium text-slate-700">In-charge Name</label>
                    <input
                      type="text"
                      value={configForm.superintendentName}
                      onChange={(e) => setConfigForm({ ...configForm, superintendentName: e.target.value })}
                      className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs outline-none focus:border-blue-600"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="font-medium text-slate-700">In-charge Email</label>
                      <input
                        type="email"
                        value={configForm.superintendentEmail}
                        onChange={(e) => setConfigForm({ ...configForm, superintendentEmail: e.target.value })}
                        className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs outline-none focus:border-blue-600 font-mono"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="font-medium text-slate-700">In-charge Phone</label>
                      <input
                        type="text"
                        value={configForm.superintendentPhone}
                        onChange={(e) => setConfigForm({ ...configForm, superintendentPhone: e.target.value })}
                        className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs outline-none focus:border-blue-600 font-mono"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Modal Footer */}
              <div className="flex items-center justify-end gap-2 border-t border-slate-100 pt-4">
                <button
                  type="button"
                  onClick={() => {
                    setShowConfigModal(false);
                    setSelectedHostel(null);
                  }}
                  className="bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 px-4 py-2 rounded-lg font-medium text-xs"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="bg-blue-600 hover:bg-blue-700 text-white font-bold px-5 py-2 rounded-lg text-xs transition cursor-pointer shadow-xs"
                >
                  {isSubmitting ? 'Saving...' : 'Save Configuration'}
                </button>
              </div>

            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: SETUP STATUS & CHECKLIST BREAKDOWN */}
      {/* ========================================================================= */}
      {showSetupStatusModal && selectedHostel && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl border border-slate-200 max-w-md w-full p-6 space-y-5 shadow-xl">
            
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-base font-bold text-slate-900">Hostel Setup Status</h3>
                <p className="text-xs text-slate-500">{selectedHostel.name}</p>
              </div>
              <button
                onClick={() => setShowSetupStatusModal(false)}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {(() => {
              const setup = calculateHostelSetup(selectedHostel);
              return (
                <div className="space-y-4 text-xs">
                  <div className="flex items-center justify-between p-3 bg-slate-50 border border-slate-200 rounded-lg">
                    <div>
                      <div className="font-bold text-slate-900">Total Setup Score</div>
                      <div className="text-slate-500 text-[11px]">Calculated from active Firestore configuration</div>
                    </div>
                    <div className={`text-xl font-bold font-mono ${setup.percentage === 100 ? 'text-emerald-700' : 'text-blue-700'}`}>
                      {setup.percentage}%
                    </div>
                  </div>

                  {/* Checklist items */}
                  <div className="space-y-2">
                    {setup.checks.map(chk => (
                      <div 
                        key={chk.key} 
                        className={`p-2.5 rounded-lg border flex items-start gap-2.5 ${
                          chk.isComplete 
                            ? 'bg-emerald-50/60 border-emerald-200 text-slate-800' 
                            : 'bg-amber-50/60 border-amber-200 text-slate-800'
                        }`}
                      >
                        {chk.isComplete ? (
                          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                        ) : (
                          <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                        )}
                        <div className="flex-1 min-w-0">
                          <div className="font-semibold text-slate-900 flex items-center justify-between">
                            <span>{chk.label}</span>
                            <span className={`text-[10px] font-mono font-bold ${chk.isComplete ? 'text-emerald-700' : 'text-amber-700'}`}>
                              {chk.isComplete ? 'COMPLETE' : 'INCOMPLETE'}
                            </span>
                          </div>
                          <div className="text-slate-600 text-[11px] mt-0.5">{chk.details}</div>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="flex items-center justify-end gap-2 border-t border-slate-100 pt-4">
                    <button
                      type="button"
                      onClick={() => setShowSetupStatusModal(false)}
                      className="bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 px-4 py-2 rounded-lg font-medium text-xs"
                    >
                      Close
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setShowSetupStatusModal(false);
                        handleOpenConfigModal(selectedHostel);
                      }}
                      className="bg-blue-600 hover:bg-blue-700 text-white font-medium px-4 py-2 rounded-lg text-xs transition cursor-pointer"
                    >
                      Configure Missing Settings
                    </button>
                  </div>
                </div>
              );
            })()}

          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: IN-CHARGE DETAIL */}
      {/* ========================================================================= */}
      {showInchargeDetailModal && selectedIncharge && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl border border-slate-200 max-w-md w-full p-6 space-y-4 shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-base font-bold text-slate-900">In-charge Details</h3>
                <p className="text-xs text-slate-500">{selectedIncharge.name}</p>
              </div>
              <button
                onClick={() => {
                  setShowInchargeDetailModal(false);
                  setSelectedIncharge(null);
                }}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-2.5 text-xs text-slate-700">
              <div className="flex justify-between py-1 border-b border-slate-100">
                <span className="text-slate-400">Full Name:</span>
                <span className="font-semibold text-slate-900">{selectedIncharge.name}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-100">
                <span className="text-slate-400">Email Address:</span>
                <span className="font-mono text-slate-800">{selectedIncharge.email}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-100">
                <span className="text-slate-400">Phone:</span>
                <span className="font-mono text-slate-800">{selectedIncharge.phone || 'N/A'}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-100">
                <span className="text-slate-400">Assigned Hostel:</span>
                <span className="font-semibold text-blue-700">{selectedIncharge.hostelName || 'Unassigned'}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-100">
                <span className="text-slate-400">Account Status:</span>
                <span className={`font-semibold ${selectedIncharge.status === 'Active' ? 'text-emerald-700' : 'text-rose-700'}`}>
                  {selectedIncharge.status}
                </span>
              </div>
              <div className="flex justify-between py-1">
                <span className="text-slate-400">Created Date:</span>
                <span className="font-mono text-slate-600">{formatDate(selectedIncharge.createdAt)}</span>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 border-t border-slate-100 pt-4">
              <button
                type="button"
                onClick={() => {
                  setShowInchargeDetailModal(false);
                  setSelectedIncharge(null);
                }}
                className="bg-slate-100 hover:bg-slate-200 text-slate-700 px-4 py-2 rounded-lg font-medium text-xs"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: REASSIGN IN-CHARGE */}
      {/* ========================================================================= */}
      {showReassignModal && selectedIncharge && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl border border-slate-200 max-w-md w-full p-6 space-y-4 shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-base font-bold text-slate-900">Assign / Reassign Hostel</h3>
                <p className="text-xs text-slate-500">{selectedIncharge.name}</p>
              </div>
              <button
                onClick={() => {
                  setShowReassignModal(false);
                  setSelectedIncharge(null);
                }}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleConfirmReassign} className="space-y-4 text-xs">
              <div className="space-y-1">
                <label className="font-medium text-slate-700">Select Hostel</label>
                <select
                  value={targetHostelIdForReassign}
                  onChange={(e) => setTargetHostelIdForReassign(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs outline-none focus:border-blue-600"
                >
                  {availableHostels.map(h => (
                    <option key={h.id} value={h.id}>
                      {h.name} ({h.district || 'General'})
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex items-center justify-end gap-2 border-t border-slate-100 pt-4">
                <button
                  type="button"
                  onClick={() => {
                    setShowReassignModal(false);
                    setSelectedIncharge(null);
                  }}
                  className="bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 px-4 py-2 rounded-lg font-medium text-xs"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="bg-blue-600 hover:bg-blue-700 text-white font-medium px-4 py-2 rounded-lg text-xs transition cursor-pointer"
                >
                  {isSubmitting ? 'Saving...' : 'Confirm Assignment'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* DELETE HOSTEL CONFIRMATION MODAL */}
      {/* ========================================================================= */}
      {showDeleteHostelModal && hostelToDelete && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl border border-slate-200 max-w-md w-full p-6 space-y-5 shadow-xl">
            <div className="flex items-start justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2.5 text-rose-600">
                <div className="p-2 bg-rose-100 rounded-lg shrink-0">
                  <Trash2 className="w-5 h-5 text-rose-600" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900 leading-snug">Delete {hostelToDelete.name}?</h3>
                  <p className="text-xs text-rose-600 font-medium">Permanent Administrative Action</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setShowDeleteHostelModal(false);
                  setHostelToDelete(null);
                  setDeleteConfirmInput('');
                }}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs text-slate-600 leading-relaxed">
              <p className="font-medium text-slate-800">
                You are about to permanently delete <strong className="text-rose-700 bg-rose-50 px-1.5 py-0.5 rounded font-mono border border-rose-200">{hostelToDelete.name}</strong>
                <span className="text-slate-400 font-mono ml-1.5">(ID: {hostelToDelete.id})</span>.
              </p>

              <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-amber-900 space-y-1">
                <div className="font-bold flex items-center gap-1.5 text-amber-800">
                  <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
                  <span>Permanent Action & History Preservation Note</span>
                </div>
                <p className="text-[11px] leading-normal">
                  Deletion is permanent and removes the hostel document and isolated subcollections. If you want to keep historical registers while preventing active use, consider clicking <strong>Disable</strong> instead.
                </p>
              </div>

              <div className="space-y-1.5 pt-2">
                <label className="block font-medium text-slate-700">
                  To confirm permanent deletion, please type <strong className="text-slate-900 select-all font-mono bg-slate-100 px-1.5 py-0.5 rounded">{hostelToDelete.name}</strong> below:
                </label>
                <input
                  type="text"
                  value={deleteConfirmInput}
                  onChange={(e) => setDeleteConfirmInput(e.target.value)}
                  placeholder={`Type "${hostelToDelete.name}" to confirm`}
                  className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-xs outline-none focus:border-rose-500 font-medium transition"
                  autoFocus
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 border-t border-slate-100 pt-4">
              <button
                type="button"
                onClick={() => {
                  setShowDeleteHostelModal(false);
                  setHostelToDelete(null);
                  setDeleteConfirmInput('');
                }}
                className="bg-white border border-slate-200 text-slate-700 hover:bg-slate-100 px-4 py-2 rounded-lg font-medium text-xs transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                disabled={
                  deleteConfirmInput.trim().replace(/’/g, "'").toLowerCase() !== hostelToDelete.name.trim().replace(/’/g, "'").toLowerCase() &&
                  deleteConfirmInput.trim().replace(/’/g, "'").toLowerCase() !== `delete ${hostelToDelete.name.trim().replace(/’/g, "'").toLowerCase()}` ||
                  isSubmitting
                }
                className="bg-rose-600 hover:bg-rose-700 disabled:opacity-40 disabled:hover:bg-rose-600 text-white font-bold px-4 py-2 rounded-lg text-xs transition cursor-pointer shadow-2xs flex items-center gap-1.5"
              >
                {isSubmitting ? 'Deleting...' : 'Delete Hostel'}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
