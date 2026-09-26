import React, { useState, useEffect } from 'react';
import { 
  Database, 
  Download, 
  Upload, 
  RefreshCw, 
  ShieldAlert, 
  CheckCircle2, 
  AlertTriangle, 
  FileSpreadsheet, 
  FileJson, 
  Clock, 
  HardDrive, 
  FileText, 
  Users, 
  Building2, 
  BedDouble, 
  QrCode, 
  Utensils, 
  ScrollText,
  AlertCircle,
  X
} from 'lucide-react';
import { 
  fetchDatabaseOverview, 
  exportStudentRecords, 
  exportAttendanceRecords, 
  exportMessBillingRecords, 
  exportLeaveRecords, 
  exportHostelData, 
  exportSystemLogs, 
  exportCompleteSystem, 
  createSystemBackup, 
  getBackupHistory, 
  downloadBackupFromHistory, 
  restoreSystemBackup 
} from '../../services/backupService';
import { DatabaseOverviewStats, SystemBackupRecord } from '../../types';

interface DataBackupSectionProps {
  adminEmail: string;
  adminName: string;
  onRefreshGlobalState?: () => Promise<void>;
  onLogCreated?: () => void;
}

export default function DataBackupSection({
  adminEmail,
  adminName,
  onRefreshGlobalState,
  onLogCreated
}: DataBackupSectionProps) {
  // Stats
  const [stats, setStats] = useState<DatabaseOverviewStats | null>(null);
  const [loadingStats, setLoadingStats] = useState(false);

  // Backup History
  const [backups, setBackups] = useState<SystemBackupRecord[]>([]);
  const [loadingBackups, setLoadingBackups] = useState(false);

  // Toast / Messages
  const [successMessage, setSuccessMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  // Active Export Progress
  const [exportingType, setExportingType] = useState<string | null>(null);

  // Create Backup Progress
  const [isCreatingBackup, setIsCreatingBackup] = useState(false);
  const [backupProgress, setBackupProgress] = useState(0);
  const [backupStepText, setBackupStepText] = useState('');
  const [latestCreatedBackup, setLatestCreatedBackup] = useState<SystemBackupRecord | null>(null);

  // Restore Modal State
  const [showRestoreModal, setShowRestoreModal] = useState(false);
  const [selectedBackupForRestore, setSelectedBackupForRestore] = useState<SystemBackupRecord | null>(null);
  const [uploadedRestorePayload, setUploadedRestorePayload] = useState<any | null>(null);
  const [restoreConfirmInput, setRestoreConfirmInput] = useState('');
  const [isRestoring, setIsRestoring] = useState(false);
  const [restoreProgress, setRestoreProgress] = useState(0);
  const [restoreStepText, setRestoreStepText] = useState('');

  // Fetch Stats & Backups
  const loadData = async () => {
    setLoadingStats(true);
    setLoadingBackups(true);
    try {
      const [overviewData, historyData] = await Promise.all([
        fetchDatabaseOverview(),
        getBackupHistory()
      ]);
      setStats(overviewData);
      setBackups(historyData);
    } catch (err: any) {
      console.error('Error loading backup data:', err);
      setErrorMessage(err.message || 'Failed to fetch database overview.');
    } finally {
      setLoadingStats(false);
      setLoadingBackups(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Handle Specific Exports
  const handleExport = async (type: string) => {
    setExportingType(type);
    try {
      let count = 0;
      if (type === 'students') count = await exportStudentRecords(adminEmail);
      else if (type === 'attendance') count = await exportAttendanceRecords(adminEmail);
      else if (type === 'billing') count = await exportMessBillingRecords(adminEmail);
      else if (type === 'leaves') count = await exportLeaveRecords(adminEmail);
      else if (type === 'hostels') count = await exportHostelData(adminEmail);
      else if (type === 'logs') count = await exportSystemLogs(adminEmail);
      else if (type === 'complete') count = await exportCompleteSystem(adminEmail);

      setSuccessMessage(`Successfully exported ${type.toUpperCase()} (${count} records downloaded).`);
      if (onLogCreated) onLogCreated();
      setTimeout(() => setSuccessMessage(''), 4000);
    } catch (err: any) {
      setErrorMessage(err.message || `Failed to export ${type}`);
      setTimeout(() => setErrorMessage(''), 5000);
    } finally {
      setExportingType(null);
    }
  };

  // Handle Create Backup
  const handleCreateBackup = async () => {
    setIsCreatingBackup(true);
    setBackupProgress(5);
    setBackupStepText('Initializing Firestore backup snapshot...');
    setLatestCreatedBackup(null);

    try {
      const record = await createSystemBackup(adminEmail, (step, percent) => {
        setBackupStepText(step);
        setBackupProgress(percent);
      });

      setLatestCreatedBackup(record);
      setSuccessMessage(`System backup ${record.id} completed successfully and downloaded!`);
      if (onLogCreated) onLogCreated();
      await loadData();
      setTimeout(() => setSuccessMessage(''), 6000);
    } catch (err: any) {
      console.error('Backup creation failed:', err);
      setErrorMessage(err.message || 'Failed to create system backup.');
      setTimeout(() => setErrorMessage(''), 5000);
    } finally {
      setIsCreatingBackup(false);
    }
  };

  // Handle File Upload for Restore
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const parsed = JSON.parse(event.target?.result as string);
        if (!parsed.data && !parsed.collections) {
          throw new Error('File does not contain valid IRA HOSTEL backup collections.');
        }
        setUploadedRestorePayload(parsed);
        setSelectedBackupForRestore(null);
        setRestoreConfirmInput('');
        setShowRestoreModal(true);
      } catch (err: any) {
        setErrorMessage(`Invalid backup file: ${err.message}`);
        setTimeout(() => setErrorMessage(''), 5000);
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  // Trigger Restore Modal from History
  const handleOpenRestoreFromHistory = (bkp: SystemBackupRecord) => {
    setSelectedBackupForRestore(bkp);
    setUploadedRestorePayload(null);
    setRestoreConfirmInput('');
    setShowRestoreModal(true);
  };

  // Confirm and Execute Restore
  const handleConfirmRestore = async (e: React.FormEvent) => {
    e.preventDefault();
    if (restoreConfirmInput.trim().toUpperCase() !== 'RESTORE BACKUP') {
      setErrorMessage('Please type exact confirmation phrase "RESTORE BACKUP".');
      return;
    }

    const payloadToRestore = uploadedRestorePayload || selectedBackupForRestore?.payload;
    if (!payloadToRestore) {
      setErrorMessage('No backup snapshot found to restore.');
      return;
    }

    setIsRestoring(true);
    setRestoreProgress(5);
    setRestoreStepText('Starting database restoration...');

    try {
      const res = await restoreSystemBackup(payloadToRestore, adminEmail, (step, percent) => {
        setRestoreStepText(step);
        setRestoreProgress(percent);
      });

      setShowRestoreModal(false);
      setSuccessMessage(`Database restored successfully! (${res.restoredRecords} records updated).`);
      if (onRefreshGlobalState) await onRefreshGlobalState();
      if (onLogCreated) onLogCreated();
      await loadData();
      setTimeout(() => setSuccessMessage(''), 6000);
    } catch (err: any) {
      setErrorMessage(err.message || 'Restoration failed.');
      setTimeout(() => setErrorMessage(''), 6000);
    } finally {
      setIsRestoring(false);
      setSelectedBackupForRestore(null);
      setUploadedRestorePayload(null);
      setRestoreConfirmInput('');
    }
  };

  return (
    <div className="space-y-6">
      
      {/* PAGE HEADER */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2.5">
            <Database className="w-6 h-6 text-blue-600 shrink-0" />
            <span>Data & Backup Administration</span>
          </h2>
          <p className="text-xs text-slate-500 font-medium mt-0.5">
            Database overview, verified offline snapshots, granular CSV data exports, and disaster recovery.
          </p>
        </div>

        <button
          onClick={loadData}
          disabled={loadingStats}
          className="bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium px-3 py-1.5 rounded-lg text-xs transition cursor-pointer flex items-center gap-1.5 w-fit border border-slate-200"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loadingStats ? 'animate-spin text-blue-600' : ''}`} />
          <span>{loadingStats ? 'Calculating...' : 'Refresh Overview'}</span>
        </button>
      </div>

      {/* MESSAGES */}
      {successMessage && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 text-xs text-emerald-800 font-medium flex items-center justify-between shadow-2xs">
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
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-xs text-amber-800 font-medium flex items-center justify-between shadow-2xs">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
            <span>{errorMessage}</span>
          </div>
          <button onClick={() => setErrorMessage('')} className="text-amber-700 hover:text-amber-900">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 1. DATABASE OVERVIEW */}
      {/* ========================================================================= */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider text-slate-600">
            1. Live Database Overview
          </h3>
          {stats?.lastCalculatedAt && (
            <span className="text-[11px] text-slate-400 font-mono">
              Live Firestore snapshot as of {new Date(stats.lastCalculatedAt).toLocaleTimeString()}
            </span>
          )}
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
          
          {/* Hostels */}
          <div className="bg-white border border-slate-200 rounded-xl p-3.5 shadow-2xs space-y-1">
            <div className="flex items-center justify-between text-slate-500">
              <span className="text-[11px] font-medium">Total Hostels</span>
              <Building2 className="w-3.5 h-3.5 text-blue-600" />
            </div>
            <div className="text-xl font-bold text-slate-900">
              {loadingStats ? '—' : stats?.totalHostels ?? 0}
            </div>
          </div>

          {/* Students */}
          <div className="bg-white border border-slate-200 rounded-xl p-3.5 shadow-2xs space-y-1">
            <div className="flex items-center justify-between text-slate-500">
              <span className="text-[11px] font-medium">Total Students</span>
              <Users className="w-3.5 h-3.5 text-blue-600" />
            </div>
            <div className="text-xl font-bold text-slate-900">
              {loadingStats ? '—' : stats?.totalStudents ?? 0}
            </div>
          </div>

          {/* Rooms / Beds */}
          <div className="bg-white border border-slate-200 rounded-xl p-3.5 shadow-2xs space-y-1">
            <div className="flex items-center justify-between text-slate-500">
              <span className="text-[11px] font-medium">Rooms / Beds</span>
              <BedDouble className="w-3.5 h-3.5 text-blue-600" />
            </div>
            <div className="text-base font-bold text-slate-900">
              {loadingStats ? '—' : `${stats?.totalRooms ?? 0} / ${stats?.totalBeds ?? 0}`}
            </div>
          </div>

          {/* Attendance */}
          <div className="bg-white border border-slate-200 rounded-xl p-3.5 shadow-2xs space-y-1">
            <div className="flex items-center justify-between text-slate-500">
              <span className="text-[11px] font-medium">Attendance</span>
              <QrCode className="w-3.5 h-3.5 text-blue-600" />
            </div>
            <div className="text-xl font-bold text-slate-900">
              {loadingStats ? '—' : stats?.totalAttendanceRecords ?? 0}
            </div>
          </div>

          {/* Leaves */}
          <div className="bg-white border border-slate-200 rounded-xl p-3.5 shadow-2xs space-y-1">
            <div className="flex items-center justify-between text-slate-500">
              <span className="text-[11px] font-medium">Leave Records</span>
              <FileText className="w-3.5 h-3.5 text-blue-600" />
            </div>
            <div className="text-xl font-bold text-slate-900">
              {loadingStats ? '—' : stats?.totalLeaveRecords ?? 0}
            </div>
          </div>

          {/* Mess / Billing */}
          <div className="bg-white border border-slate-200 rounded-xl p-3.5 shadow-2xs space-y-1">
            <div className="flex items-center justify-between text-slate-500">
              <span className="text-[11px] font-medium">Mess / Bills</span>
              <Utensils className="w-3.5 h-3.5 text-blue-600" />
            </div>
            <div className="text-xl font-bold text-slate-900">
              {loadingStats ? '—' : stats?.totalBillingRecords ?? 0}
            </div>
          </div>

          {/* System Logs */}
          <div className="bg-white border border-slate-200 rounded-xl p-3.5 shadow-2xs space-y-1 col-span-2 sm:col-span-1">
            <div className="flex items-center justify-between text-slate-500">
              <span className="text-[11px] font-medium">System Logs</span>
              <ScrollText className="w-3.5 h-3.5 text-blue-600" />
            </div>
            <div className="text-xl font-bold text-slate-900">
              {loadingStats ? '—' : stats?.totalSystemLogs ?? 0}
            </div>
          </div>

        </div>
      </div>

      {/* ========================================================================= */}
      {/* 2. CREATE BACKUP & RESTORE ACTIONS */}
      {/* ========================================================================= */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        
        {/* CREATE BACKUP CARD */}
        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-2xs space-y-4 flex flex-col justify-between">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <HardDrive className="w-5 h-5 text-blue-600" />
                <h3 className="font-bold text-slate-900 text-sm">Create System Backup</h3>
              </div>
              <span className="text-[10px] bg-blue-50 text-blue-700 font-semibold px-2 py-0.5 rounded border border-blue-200">
                JSON Snapshot
              </span>
            </div>

            <p className="text-xs text-slate-500 leading-relaxed">
              Creates a point-in-time snapshot of all Firestore collections (hostels, students, rooms, attendance, leaves, bills, and logs). The backup is registered in the audit history and downloaded to your computer.
            </p>
          </div>

          {/* Progress Bar (while backing up) */}
          {isCreatingBackup && (
            <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 space-y-2 text-xs">
              <div className="flex items-center justify-between text-slate-700 font-medium">
                <span>{backupStepText}</span>
                <span className="font-bold font-mono text-blue-600">{backupProgress}%</span>
              </div>
              <div className="w-full bg-slate-200 h-2 rounded-full overflow-hidden">
                <div 
                  className="bg-blue-600 h-full transition-all duration-300 rounded-full"
                  style={{ width: `${backupProgress}%` }}
                />
              </div>
            </div>
          )}

          {/* Latest Created Status Banner */}
          {latestCreatedBackup && (
            <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3 text-xs text-emerald-900 space-y-1">
              <div className="font-bold flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>Backup {latestCreatedBackup.id} Ready</span>
              </div>
              <div className="text-[11px] text-emerald-800">
                Backed up <strong>{latestCreatedBackup.recordCount} records</strong> ({latestCreatedBackup.sizeFormatted}) on {new Date(latestCreatedBackup.timestamp).toLocaleTimeString()}.
              </div>
            </div>
          )}

          <button
            onClick={handleCreateBackup}
            disabled={isCreatingBackup}
            className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-bold py-2.5 px-4 rounded-lg text-xs transition cursor-pointer flex items-center justify-center gap-2 shadow-xs"
          >
            <Download className="w-4 h-4" />
            <span>{isCreatingBackup ? 'Generating Backup...' : 'Create Backup'}</span>
          </button>
        </div>

        {/* RESTORE BACKUP CARD */}
        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-2xs space-y-4 flex flex-col justify-between">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ShieldAlert className="w-5 h-5 text-amber-600" />
                <h3 className="font-bold text-slate-900 text-sm">Restore from Backup</h3>
              </div>
              <span className="text-[10px] bg-amber-50 text-amber-800 font-semibold px-2 py-0.5 rounded border border-amber-200">
                Protected Action
              </span>
            </div>

            <p className="text-xs text-slate-500 leading-relaxed">
              Upload a verified JSON snapshot file to restore system state. All operations are atomic, authenticated to Super Admin, and logged in the System Audit Log.
            </p>
          </div>

          <div className="p-3 bg-amber-50/70 border border-amber-200 rounded-lg text-amber-900 text-xs space-y-1">
            <div className="font-bold flex items-center gap-1">
              <AlertTriangle className="w-3.5 h-3.5 text-amber-700 shrink-0" />
              <span>Safety Warning</span>
            </div>
            <p className="text-[11px] text-amber-800">
              Restoring merges and updates documents with backup records. Always ensure you have created a fresh backup before performing a restore.
            </p>
          </div>

          <div>
            <label className="w-full bg-white border border-slate-300 hover:border-slate-400 text-slate-700 font-medium py-2.5 px-4 rounded-lg text-xs transition cursor-pointer flex items-center justify-center gap-2">
              <Upload className="w-4 h-4 text-slate-600" />
              <span>Upload Backup JSON File to Restore</span>
              <input
                type="file"
                accept=".json"
                onChange={handleFileUpload}
                className="hidden"
              />
            </label>
          </div>
        </div>

      </div>

      {/* ========================================================================= */}
      {/* 3. EXPORT DATA (GRANULAR DOWNLOADS) */}
      {/* ========================================================================= */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-2xs space-y-4">
        <div className="border-b border-slate-100 pb-3">
          <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
            <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
            <span>2. Export Operational Data</span>
          </h3>
          <p className="text-xs text-slate-500 mt-0.5">
            Download filtered operational registers as CSV / Excel-compatible spreadsheets or complete JSON archives.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
          
          {/* Student Records */}
          <div className="border border-slate-200 rounded-lg p-3 hover:border-slate-300 transition flex flex-col justify-between space-y-3 bg-slate-50/50">
            <div>
              <div className="flex items-center justify-between">
                <span className="font-bold text-slate-900">Student Records</span>
                <span className="text-[10px] font-mono font-semibold bg-emerald-100 text-emerald-800 px-1.5 py-0.5 rounded">CSV</span>
              </div>
              <p className="text-[11px] text-slate-500 mt-1">Roll numbers, contacts, room allocations, admission dates.</p>
            </div>
            <button
              onClick={() => handleExport('students')}
              disabled={exportingType === 'students'}
              className="w-full bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 font-medium py-1.5 px-3 rounded text-xs transition flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <Download className="w-3.5 h-3.5 text-slate-500" />
              <span>{exportingType === 'students' ? 'Exporting...' : 'Export Students'}</span>
            </button>
          </div>

          {/* Attendance Records */}
          <div className="border border-slate-200 rounded-lg p-3 hover:border-slate-300 transition flex flex-col justify-between space-y-3 bg-slate-50/50">
            <div>
              <div className="flex items-center justify-between">
                <span className="font-bold text-slate-900">Attendance Records</span>
                <span className="text-[10px] font-mono font-semibold bg-emerald-100 text-emerald-800 px-1.5 py-0.5 rounded">CSV</span>
              </div>
              <p className="text-[11px] text-slate-500 mt-1">QR scan logs, meal attendance, daily presence logs.</p>
            </div>
            <button
              onClick={() => handleExport('attendance')}
              disabled={exportingType === 'attendance'}
              className="w-full bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 font-medium py-1.5 px-3 rounded text-xs transition flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <Download className="w-3.5 h-3.5 text-slate-500" />
              <span>{exportingType === 'attendance' ? 'Exporting...' : 'Export Attendance'}</span>
            </button>
          </div>

          {/* Mess & Billing */}
          <div className="border border-slate-200 rounded-lg p-3 hover:border-slate-300 transition flex flex-col justify-between space-y-3 bg-slate-50/50">
            <div>
              <div className="flex items-center justify-between">
                <span className="font-bold text-slate-900">Mess / Billing</span>
                <span className="text-[10px] font-mono font-semibold bg-emerald-100 text-emerald-800 px-1.5 py-0.5 rounded">CSV</span>
              </div>
              <p className="text-[11px] text-slate-500 mt-1">Monthly student bills, meal counts, leave deductions.</p>
            </div>
            <button
              onClick={() => handleExport('billing')}
              disabled={exportingType === 'billing'}
              className="w-full bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 font-medium py-1.5 px-3 rounded text-xs transition flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <Download className="w-3.5 h-3.5 text-slate-500" />
              <span>{exportingType === 'billing' ? 'Exporting...' : 'Export Mess Bills'}</span>
            </button>
          </div>

          {/* Leave Records */}
          <div className="border border-slate-200 rounded-lg p-3 hover:border-slate-300 transition flex flex-col justify-between space-y-3 bg-slate-50/50">
            <div>
              <div className="flex items-center justify-between">
                <span className="font-bold text-slate-900">Leave Records</span>
                <span className="text-[10px] font-mono font-semibold bg-emerald-100 text-emerald-800 px-1.5 py-0.5 rounded">CSV</span>
              </div>
              <p className="text-[11px] text-slate-500 mt-1">Leave applications, start/end dates, approval statuses.</p>
            </div>
            <button
              onClick={() => handleExport('leaves')}
              disabled={exportingType === 'leaves'}
              className="w-full bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 font-medium py-1.5 px-3 rounded text-xs transition flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <Download className="w-3.5 h-3.5 text-slate-500" />
              <span>{exportingType === 'leaves' ? 'Exporting...' : 'Export Leaves'}</span>
            </button>
          </div>

          {/* Hostel Data */}
          <div className="border border-slate-200 rounded-lg p-3 hover:border-slate-300 transition flex flex-col justify-between space-y-3 bg-slate-50/50">
            <div>
              <div className="flex items-center justify-between">
                <span className="font-bold text-slate-900">Hostel Directory</span>
                <span className="text-[10px] font-mono font-semibold bg-emerald-100 text-emerald-800 px-1.5 py-0.5 rounded">CSV</span>
              </div>
              <p className="text-[11px] text-slate-500 mt-1">Hostels, capacities, rooms, assigned in-charges.</p>
            </div>
            <button
              onClick={() => handleExport('hostels')}
              disabled={exportingType === 'hostels'}
              className="w-full bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 font-medium py-1.5 px-3 rounded text-xs transition flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <Download className="w-3.5 h-3.5 text-slate-500" />
              <span>{exportingType === 'hostels' ? 'Exporting...' : 'Export Hostels'}</span>
            </button>
          </div>

          {/* System Logs */}
          <div className="border border-slate-200 rounded-lg p-3 hover:border-slate-300 transition flex flex-col justify-between space-y-3 bg-slate-50/50">
            <div>
              <div className="flex items-center justify-between">
                <span className="font-bold text-slate-900">System Logs</span>
                <span className="text-[10px] font-mono font-semibold bg-emerald-100 text-emerald-800 px-1.5 py-0.5 rounded">CSV</span>
              </div>
              <p className="text-[11px] text-slate-500 mt-1">Central audit trail of admin actions and transactions.</p>
            </div>
            <button
              onClick={() => handleExport('logs')}
              disabled={exportingType === 'logs'}
              className="w-full bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 font-medium py-1.5 px-3 rounded text-xs transition flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <Download className="w-3.5 h-3.5 text-slate-500" />
              <span>{exportingType === 'logs' ? 'Exporting...' : 'Export Logs'}</span>
            </button>
          </div>

          {/* Complete System Export */}
          <div className="border border-blue-200 bg-blue-50/40 rounded-lg p-3 hover:border-blue-300 transition flex flex-col justify-between space-y-3 col-span-1 sm:col-span-2">
            <div>
              <div className="flex items-center justify-between">
                <span className="font-bold text-blue-950">Complete System Export</span>
                <span className="text-[10px] font-mono font-semibold bg-blue-200 text-blue-900 px-1.5 py-0.5 rounded">JSON</span>
              </div>
              <p className="text-[11px] text-slate-600 mt-1">
                Full-database raw export encompassing all collections in a structured JSON payload for external archives.
              </p>
            </div>
            <button
              onClick={() => handleExport('complete')}
              disabled={exportingType === 'complete'}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-1.5 px-3 rounded text-xs transition flex items-center justify-center gap-1.5 cursor-pointer shadow-2xs"
            >
              <FileJson className="w-3.5 h-3.5" />
              <span>{exportingType === 'complete' ? 'Exporting JSON...' : 'Export Complete System (JSON)'}</span>
            </button>
          </div>

        </div>
      </div>

      {/* ========================================================================= */}
      {/* 4. BACKUP HISTORY */}
      {/* ========================================================================= */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-2xs space-y-0">
        <div className="p-4 border-b border-slate-200 bg-slate-50/60 flex items-center justify-between">
          <div>
            <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
              <Clock className="w-4 h-4 text-slate-600" />
              <span>3. Backup History</span>
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">Real Firestore backup snapshots recorded in system.</p>
          </div>
          <span className="text-xs text-slate-500 font-medium font-mono">
            {backups.length} Backups Saved
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold uppercase tracking-wider">
              <tr>
                <th className="px-4 py-3">Backup ID</th>
                <th className="px-4 py-3">Date & Time</th>
                <th className="px-4 py-3">Created By</th>
                <th className="px-4 py-3">Scope / Records</th>
                <th className="px-4 py-3">Size</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loadingBackups ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-slate-400">
                    Loading backup history...
                  </td>
                </tr>
              ) : backups.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-slate-400">
                    No previous backups recorded. Click "Create Backup" above to generate your first system snapshot.
                  </td>
                </tr>
              ) : (
                backups.map((bkp) => (
                  <tr key={bkp.id} className="hover:bg-slate-50/80 transition">
                    <td className="px-4 py-3 font-mono font-semibold text-slate-900">
                      {bkp.id}
                    </td>
                    <td className="px-4 py-3 font-mono text-slate-500 text-[11px] whitespace-nowrap">
                      {new Date(bkp.timestamp || bkp.createdAt).toLocaleString()}
                    </td>
                    <td className="px-4 py-3 text-slate-700 truncate max-w-[140px]" title={bkp.createdBy}>
                      {bkp.createdBy || 'Super Admin'}
                    </td>
                    <td className="px-4 py-3 text-slate-700">
                      <span className="font-semibold text-slate-900">{bkp.recordCount}</span>
                      <span className="text-slate-400 ml-1">records</span>
                    </td>
                    <td className="px-4 py-3 font-mono text-slate-600">
                      {bkp.sizeFormatted || '—'}
                    </td>
                    <td className="px-4 py-3">
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold border bg-emerald-50 text-emerald-700 border-emerald-200">
                        {bkp.status || 'Completed'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => downloadBackupFromHistory(bkp)}
                          className="bg-slate-100 hover:bg-slate-200 text-slate-700 px-2.5 py-1 rounded font-medium text-xs transition cursor-pointer flex items-center gap-1"
                          title="Download Snapshot JSON"
                        >
                          <Download className="w-3 h-3 text-slate-500" />
                          <span>Download</span>
                        </button>

                        <button
                          onClick={() => handleOpenRestoreFromHistory(bkp)}
                          className="bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 px-2.5 py-1 rounded font-medium text-xs transition cursor-pointer flex items-center gap-1"
                          title="Restore from this backup"
                        >
                          <RefreshCw className="w-3 h-3 text-amber-600" />
                          <span>Restore</span>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* RESTORE CONFIRMATION MODAL */}
      {/* ========================================================================= */}
      {showRestoreModal && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl border border-slate-200 max-w-md w-full p-6 space-y-5 shadow-xl">
            
            <div className="flex items-start justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2.5 text-amber-600">
                <div className="p-2 bg-amber-100 rounded-lg shrink-0">
                  <ShieldAlert className="w-5 h-5 text-amber-600" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900 leading-snug">Confirm System Restore</h3>
                  <p className="text-xs text-amber-700 font-medium">Critical Administrative Recovery</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  if (!isRestoring) {
                    setShowRestoreModal(false);
                    setSelectedBackupForRestore(null);
                    setUploadedRestorePayload(null);
                    setRestoreConfirmInput('');
                  }
                }}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs text-slate-600 leading-relaxed">
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-rose-900 space-y-1">
                <div className="font-bold flex items-center gap-1.5 text-rose-800">
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                  <span>Overwriting Warning</span>
                </div>
                <p className="text-[11px] leading-normal">
                  Restoring will overwrite or update existing database records in Firestore with the snapshot contents. This action cannot be automatically undone.
                </p>
              </div>

              {selectedBackupForRestore ? (
                <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg space-y-1">
                  <div className="text-[11px] text-slate-400">Target Backup:</div>
                  <div className="font-mono font-bold text-slate-900">{selectedBackupForRestore.id}</div>
                  <div className="text-[11px] text-slate-500">
                    Created: {new Date(selectedBackupForRestore.timestamp).toLocaleString()} ({selectedBackupForRestore.recordCount} records)
                  </div>
                </div>
              ) : uploadedRestorePayload ? (
                <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg space-y-1">
                  <div className="text-[11px] text-slate-400">Uploaded File Snapshot:</div>
                  <div className="font-mono font-bold text-slate-900">
                    {uploadedRestorePayload.backupId || uploadedRestorePayload.id || 'Custom Upload'}
                  </div>
                  <div className="text-[11px] text-slate-500">
                    Total Records in Package: {uploadedRestorePayload.recordCount || uploadedRestorePayload.totalRecords || 'Calculated on restore'}
                  </div>
                </div>
              ) : null}

              {isRestoring ? (
                <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 space-y-2 text-xs">
                  <div className="flex items-center justify-between text-slate-700 font-medium">
                    <span>{restoreStepText}</span>
                    <span className="font-bold font-mono text-amber-600">{restoreProgress}%</span>
                  </div>
                  <div className="w-full bg-slate-200 h-2 rounded-full overflow-hidden">
                    <div 
                      className="bg-amber-600 h-full transition-all duration-300 rounded-full"
                      style={{ width: `${restoreProgress}%` }}
                    />
                  </div>
                </div>
              ) : (
                <div className="space-y-1.5 pt-2">
                  <label className="block font-medium text-slate-700">
                    To authorize restore, please type <strong className="text-slate-900 select-all font-mono bg-slate-100 px-1.5 py-0.5 rounded">RESTORE BACKUP</strong> below:
                  </label>
                  <input
                    type="text"
                    value={restoreConfirmInput}
                    onChange={(e) => setRestoreConfirmInput(e.target.value)}
                    placeholder="Type RESTORE BACKUP to confirm"
                    className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-xs outline-none focus:border-amber-600 font-medium uppercase transition font-mono"
                    autoFocus
                  />
                </div>
              )}
            </div>

            <div className="flex items-center justify-end gap-2 border-t border-slate-100 pt-4">
              <button
                type="button"
                disabled={isRestoring}
                onClick={() => {
                  setShowRestoreModal(false);
                  setSelectedBackupForRestore(null);
                  setUploadedRestorePayload(null);
                  setRestoreConfirmInput('');
                }}
                className="bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 px-4 py-2 rounded-lg font-medium text-xs transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmRestore}
                disabled={restoreConfirmInput.trim().toUpperCase() !== 'RESTORE BACKUP' || isRestoring}
                className="bg-amber-600 hover:bg-amber-700 disabled:opacity-40 text-white font-bold px-4 py-2 rounded-lg text-xs transition cursor-pointer shadow-2xs flex items-center gap-1.5"
              >
                {isRestoring ? 'Restoring Database...' : 'Authorize & Restore Backup'}
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
}
