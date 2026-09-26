import React, { useState, useEffect } from 'react';
import { useHostelSystem } from './hooks/useHostelSystem';
import { ensureGangpurHostelExists } from './services/initializationService';
import InchargeDashboard from './components/InchargeDashboard';
import StudentProfile from './components/StudentProfile';
import StudentManagement from './components/StudentManagement';
import AttendanceCorrection from './components/AttendanceCorrection';
import ManualAttendanceCorrection from './components/ManualAttendanceCorrection';
import LeaveManagement from './components/LeaveManagement';
import MessManagement from './components/MessManagement';
import Reports from './components/Reports';
import AIChatbot from './components/AIChatbot';
import NoticeManagement from './components/NoticeManagement';
import StudentNotificationBell from './components/StudentNotificationBell';
import SuperAdminDashboard from './components/SuperAdminDashboard';
import { useAuth } from './contexts/AuthContext';
import { useHostel } from './contexts/HostelContext';
import LoginPage from './components/LoginPage';
import ForcePasswordChangeView from './components/ForcePasswordChangeView';
import PWAInstallPrompt from './components/PWAInstallPrompt';
import HostelUnavailableState from './components/HostelUnavailableState';

import { 
  Building2, 
  Users, 
  CalendarCheck, 
  CalendarMinus, 
  DollarSign, 
  FileSpreadsheet, 
  Bot, 
  Sparkles, 
  UserCircle2, 
  ShieldCheck, 
  BellRing, 
  CalendarRange, 
  HelpCircle,
  Menu,
  X,
  CheckCircle2,
  ShieldAlert,
  Layers
} from 'lucide-react';

import { publishNotice as svcPublishNotice, DEFAULT_HOSTEL_ID } from './services/noticeService';

export default function App() {
  const { user, role, userProfile, studentData, adminData, loadingAuth, logout, changeStudentPassword } = useAuth();
  const { activeHostelId, activeHostel, setActiveHostelId } = useHostel();

  // Initialize and verify Gangpur Boys' Hostel document in Firestore on application startup
  useEffect(() => {
    ensureGangpurHostelExists().then(({ exists, data }) => {
      console.log(`[App Init] Gangpur Boys' Hostel document initialization check: exists=${exists}`, data);
    }).catch(err => {
      console.error('[App Init] Failed to initialize Gangpur Boys\' Hostel document:', err);
    });
  }, []);

  // 1. STATE & BUSINESS LOGIC
  const {
    students,
    attendance,
    leaveRequests,
    rooms,
    hostels,
    mealRates,
    monthlyBills,
    notifications,
    notices,
    loading,
    dbSynced,
    upsertStudent,
    deleteStudent,
    reallocateRoom,
    recordAttendance,
    deleteAttendance,
    submitLeaveRequest,
    processLeaveRequest,
    updateMealRates,
    recalculateAllBills,
    markBillPaid,
    publishNotification,
    importStudentsFromCSV
  } = useHostelSystem(user, role, studentData, adminData, activeHostelId, activeHostel?.name);

  // Role State: derived from authenticated role
  const isSuperAdmin = role === 'super_admin';
  const isStaffOrSuper = role === 'superintendent' || role === 'staff' || role === 'admin' || isSuperAdmin;
  const userRole = isStaffOrSuper ? 'incharge' : 'student';
  
  // Selected student ID derived from authenticated student
  const activeStudentId = studentData?.id || '';

  // Active navigation tab
  const [activeTab, setActiveTab] = useState<string>('dashboard');

  // Enforce strict role-based routing and landing pages immediately after authentication
  useEffect(() => {
    if (!loadingAuth && user && role) {
      if (role === 'super_admin') {
        // Super Admin lands directly on Platform Management
        setActiveTab('super_admin_overview');
      } else {
        // Non-super_admin users land on their respective hostel/student dashboard
        setActiveTab('dashboard');
      }
    }
  }, [user?.uid, role, loadingAuth]);

  // Guard: Ensure non-super_admin users can NEVER navigate to super_admin_overview
  useEffect(() => {
    if (role && role !== 'super_admin' && activeTab === 'super_admin_overview') {
      setActiveTab('dashboard');
    }
  }, [role, activeTab]);

  // Announcement modal state
  const [showNoticeModal, setShowNoticeModal] = useState(false);
  const [noticeTitle, setNoticeTitle] = useState('');
  const [noticeMsg, setNoticeMsg] = useState('');
  const [noticeType, setNoticeType] = useState<'announcement' | 'emergency'>('announcement');
  const [noticeSuccess, setNoticeSuccess] = useState(false);

  // Mobile sidebar state
  const [showMobileMenu, setShowMobileMenu] = useState(false);

  // Quick notices submit handler
  const handleNoticeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!noticeTitle.trim() || !noticeMsg.trim()) return;

    await svcPublishNotice({
      hostelId: adminData?.hostelId || DEFAULT_HOSTEL_ID,
      title: noticeTitle,
      description: noticeMsg,
      priority: noticeType === 'emergency' ? 'emergency' : 'normal',
      audienceType: 'all',
      audienceValue: 'all',
      createdBy: adminData?.name || 'Hostel Superintendent'
    });

    publishNotification({
      title: noticeTitle,
      message: noticeMsg,
      type: noticeType,
      target: 'all',
      sender: adminData?.hostelName ? `${adminData?.name || 'Hostel Superintendent'} (${adminData.hostelName})` : (adminData?.name || 'Hostel Superintendent')
    });

    setNoticeTitle('');
    setNoticeMsg('');
    setNoticeSuccess(true);
    setTimeout(() => {
      setNoticeSuccess(false);
      setShowNoticeModal(false);
    }, 2000);
  };

  if (loadingAuth) {
    return (
      <div id="loading_screen" className="fixed inset-0 bg-[#F8FAFC] text-slate-800 flex flex-col items-center justify-center gap-4">
        <div className="relative h-16 w-16">
          <div className="absolute inset-0 rounded-full border-4 border-slate-200 border-t-emerald-600 animate-spin"></div>
          <Building2 className="w-8 h-8 text-emerald-600 absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 animate-pulse" />
        </div>
        <div className="space-y-1.5 text-center">
          <h2 className="text-sm font-black text-slate-900 tracking-tight">IRA CAMPUS</h2>
          <p className="text-xs text-slate-400 font-medium">Verifying credentials securely...</p>
        </div>
      </div>
    );
  }

  if (!user || !role) {
    return <LoginPage />;
  }

  if (role === 'student' && studentData?.mustChangePassword) {
    return (
      <ForcePasswordChangeView 
        student={studentData} 
        onPasswordChanged={changeStudentPassword} 
        onLogout={logout} 
      />
    );
  }

  if (loading) {
    return (
      <div id="loading_screen" className="fixed inset-0 bg-[#F8FAFC] text-slate-800 flex flex-col items-center justify-center gap-4">
        <div className="relative h-16 w-16">
          <div className="absolute inset-0 rounded-full border-4 border-slate-200 border-t-emerald-600 animate-spin"></div>
          <Building2 className="w-8 h-8 text-emerald-600 absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 animate-pulse" />
        </div>
        <div className="space-y-1.5 text-center">
          <h2 className="text-sm font-black text-slate-900 tracking-tight">IRA HOSTEL</h2>
          <p className="text-xs text-slate-400 font-medium">Synchronizing campus registers...</p>
        </div>
      </div>
    );
  }

  const currentStudent = role === 'student'
    ? (students.find(s => s.id === studentData?.id || s.rollNumber === studentData?.rollNumber || (user?.uid && s.uid === user.uid)) || studentData)
    : (students.find(s => s.id === activeStudentId) || studentData || students[0] || null);

  // Super Admin direct platform dashboard view (full width, dedicated header)
  if (role === 'super_admin' && activeTab === 'super_admin_overview') {
    return (
      <SuperAdminDashboard
        onSelectHostel={(hostelId) => {
          setActiveHostelId(hostelId);
          setActiveTab('dashboard');
        }}
        onSelectHostelDashboard={(hostelId) => {
          setActiveHostelId(hostelId);
          setActiveTab('dashboard');
        }}
      />
    );
  }

  return (
    <div className="min-h-screen bg-white text-slate-800 font-sans flex flex-col">
      
      {/* 1. SECURE COLLEGE PORTAL UPPER BAR */}
      <header className="bg-white border-b border-slate-200 px-6 sm:px-8 lg:px-10 py-4 sticky top-0 z-40 shadow-xs">
        <div className="w-full flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
          
          {/* Logo Brand Block */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div>
                <h1 className="font-black text-slate-900 tracking-tight leading-none text-xl md:text-2xl font-sans">
                  IRA HOSTEL
                </h1>
              </div>
            </div>
            
            {/* Mobile Menu Toggle */}
            <button 
              id="mobile_menu_toggle"
              onClick={() => setShowMobileMenu(!showMobileMenu)}
              className="p-2 text-gray-500 hover:bg-gray-100 rounded-xl md:hidden cursor-pointer"
            >
              {showMobileMenu ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>

          {/* Live User Session & Control Board */}
          <div className="flex flex-col md:flex-row items-stretch md:items-center gap-3 text-xs">
            {/* Student Notification Bell */}
            {currentStudent && (
              <StudentNotificationBell 
                student={currentStudent} 
                hostelId={activeHostelId || adminData?.hostelId || studentData?.hostelId} 
              />
            )}

            {/* Authenticated user badge and logout */}
            <div className="flex items-center gap-3 bg-slate-100/70 border border-slate-200 pl-3 pr-2 py-1 rounded-xl text-left">
              <div className="flex flex-col text-left">
                <span className="text-[10px] text-slate-800 font-bold">
                  {role === 'student' ? (currentStudent?.name || studentData?.name || userProfile?.displayName) : (userProfile?.displayName || adminData?.name || user?.email?.split('@')[0])}
                </span>
                <span className="text-[9px] text-slate-500 font-mono">
                  {role === 'super_admin' ? 'SUPER ADMIN' : role === 'superintendent' ? 'SUPERINTENDENT' : role === 'staff' ? 'HOSTEL STAFF' : (currentStudent?.roomNumber ? `Room ${currentStudent.roomNumber}` : (studentData?.roomNumber ? `Room ${studentData.roomNumber}` : 'Room Unassigned'))}
                </span>
              </div>
              <button
                id="logout_header_btn"
                onClick={logout}
                className="bg-slate-900 hover:bg-slate-850 text-white font-extrabold px-3 py-1.5 rounded-lg text-[10px] uppercase transition cursor-pointer flex items-center shadow-xs"
              >
                Logout
              </button>
            </div>
          </div>

        </div>
      </header>

      {/* 2. CORE LAYOUT BODY CONTAINER */}
      <div className="flex-1 w-full px-6 sm:px-8 lg:px-10 py-6 flex flex-col md:flex-row gap-6 md:gap-8">
        
        {/* SIDE NAV MENU (Visible in In-charge Role on Desktop for hostel views, or Mobile Drawer) */}
        {userRole === 'incharge' && activeTab !== 'super_admin_overview' && (
          <aside className={`w-full md:w-64 shrink-0 space-y-4 md:block ${showMobileMenu ? 'block' : 'hidden'}`}>
            <nav id="admin_navigation" className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs space-y-1 text-xs font-semibold">
              <p className="text-[10px] text-gray-400 uppercase font-bold px-3 pb-2 border-b border-gray-50 mb-2">Navigation</p>
              
              <button 
                id="tab_dashboard"
                onClick={() => { setActiveTab('dashboard'); setShowMobileMenu(false); }}
                className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl cursor-pointer transition ${
                  activeTab === 'dashboard' ? 'bg-slate-100 text-slate-950 border-l-4 border-slate-900 pl-2.5 font-bold shadow-xs' : 'hover:bg-gray-50 text-gray-600'
                }`}
              >
                <Building2 className="w-4 h-4 shrink-0" />
                <span>Executive Dashboard</span>
              </button>

              <button 
                id="tab_students"
                onClick={() => { setActiveTab('students'); setShowMobileMenu(false); }}
                className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl cursor-pointer transition ${
                  activeTab === 'students' ? 'bg-slate-100 text-slate-950 border-l-4 border-slate-900 pl-2.5 font-bold shadow-xs' : 'hover:bg-gray-50 text-gray-600'
                }`}
              >
                <Users className="w-4 h-4 shrink-0" />
                <span>Student directory</span>
              </button>

              <button 
                id="tab_attendance"
                onClick={() => { setActiveTab('attendance'); setShowMobileMenu(false); }}
                className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl cursor-pointer transition ${
                  activeTab === 'attendance' ? 'bg-slate-100 text-slate-950 border-l-4 border-slate-900 pl-2.5 font-bold shadow-xs' : 'hover:bg-gray-50 text-gray-600'
                }`}
              >
                <CalendarCheck className="w-4 h-4 shrink-0" />
                <span>QR Attendance Scanner</span>
              </button>

              <button 
                id="tab_correction"
                onClick={() => { setActiveTab('correction'); setShowMobileMenu(false); }}
                className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl cursor-pointer transition ${
                  activeTab === 'correction' ? 'bg-slate-100 text-slate-950 border-l-4 border-slate-900 pl-2.5 font-bold shadow-xs' : 'hover:bg-gray-50 text-gray-600'
                }`}
              >
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                <span>Manual Meal Register</span>
              </button>

              <button 
                id="tab_leaves"
                onClick={() => { setActiveTab('leaves'); setShowMobileMenu(false); }}
                className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl cursor-pointer transition relative ${
                  activeTab === 'leaves' ? 'bg-slate-100 text-slate-950 border-l-4 border-slate-900 pl-2.5 font-bold shadow-xs' : 'hover:bg-gray-50 text-gray-600'
                }`}
              >
                <CalendarMinus className="w-4 h-4 shrink-0" />
                <span>Leave Inbox</span>
                {leaveRequests.filter(l => l.status === 'pending').length > 0 && (
                  <span className="absolute right-3 bg-slate-900 text-white font-bold h-5 px-1.5 rounded-full flex items-center justify-center text-[10px]">
                    {leaveRequests.filter(l => l.status === 'pending').length}
                  </span>
                )}
              </button>

              <button 
                id="tab_mess"
                onClick={() => { setActiveTab('mess'); setShowMobileMenu(false); }}
                className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl cursor-pointer transition ${
                  activeTab === 'mess' ? 'bg-slate-100 text-slate-950 border-l-4 border-slate-900 pl-2.5 font-bold shadow-xs' : 'hover:bg-gray-50 text-gray-600'
                }`}
              >
                <DollarSign className="w-4 h-4 shrink-0" />
                <span>Mess balances</span>
              </button>

              <button 
                id="tab_reports"
                onClick={() => { setActiveTab('reports'); setShowMobileMenu(false); }}
                className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl cursor-pointer transition ${
                  activeTab === 'reports' ? 'bg-slate-100 text-slate-950 border-l-4 border-slate-900 pl-2.5 font-bold shadow-xs' : 'hover:bg-gray-50 text-gray-600'
                }`}
              >
                <FileSpreadsheet className="w-4 h-4 shrink-0" />
                <span>Exports & Reports</span>
              </button>

              <button 
                id="tab_notices"
                onClick={() => { setActiveTab('notices'); setShowMobileMenu(false); }}
                className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl cursor-pointer transition relative ${
                  activeTab === 'notices' ? 'bg-slate-100 text-slate-950 border-l-4 border-slate-900 pl-2.5 font-bold shadow-xs' : 'hover:bg-gray-50 text-gray-600'
                }`}
              >
                <BellRing className="w-4 h-4 shrink-0" />
                <span>Notice Board</span>
                {notices.length > 0 && (
                  <span className="absolute right-3 bg-slate-900 text-white font-bold h-5 px-1.5 rounded-full flex items-center justify-center text-[10px]">
                    {notices.length}
                  </span>
                )}
              </button>

              <button 
                id="tab_ai_bot"
                onClick={() => { setActiveTab('ai_bot'); setShowMobileMenu(false); }}
                className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl cursor-pointer transition ${
                  activeTab === 'ai_bot' ? 'bg-slate-100 text-slate-955 border-l-4 border-slate-900 pl-2.5 font-bold shadow-xs' : 'hover:bg-gray-50 text-gray-600'
                }`}
              >
                <Bot className="w-4 h-4 shrink-0 text-slate-700" />
                <span className="flex items-center gap-1.5">IRA AI Advisor <Sparkles className="w-3 h-3 text-slate-650" /></span>
              </button>
            </nav>

            {/* Quick stats on sidebar */}
            <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs space-y-4">
              <span className="text-[10px] text-gray-400 uppercase font-bold tracking-wider">Fast Notice Board</span>
              <p className="text-xs text-gray-500 font-medium">Need to post emergency water/meal alerts or schedules?</p>
              <button 
                id="post_notice_sidebar_btn"
                onClick={() => { setActiveTab('notices'); setShowMobileMenu(false); }}
                className="w-full bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-850 font-bold py-2 rounded-xl text-xs flex items-center justify-center gap-1.5 transition cursor-pointer"
              >
                <BellRing className="w-4 h-4 text-slate-700" /> Publish notice
              </button>
            </div>
          </aside>
        )}

        {/* MAIN PANEL CONTENT WINDOW */}
        <main className="flex-1 min-w-0">
          
          {/* Super Admin Hostel Inspection Banner */}
          {isSuperAdmin && activeTab !== 'super_admin_overview' && (
            <div className="mb-4 p-3.5 bg-blue-50 border border-blue-200 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-blue-900 font-medium shadow-2xs">
              <div className="flex items-center gap-2">
                <ShieldAlert className="w-4 h-4 text-blue-600 shrink-0" />
                <span><strong>SUPER ADMIN INSPECTION MODE</strong> — Viewing: <strong>{activeHostel?.name || activeHostelId || 'Selected Hostel'}</strong></span>
              </div>
              <button
                onClick={() => setActiveTab('super_admin_overview')}
                className="bg-blue-600 hover:bg-blue-700 text-white font-semibold px-3.5 py-1.5 rounded-lg transition cursor-pointer text-xs w-fit flex items-center gap-1.5 shadow-2xs"
              >
                <span>← Back to Hostel Management</span>
              </button>
            </div>
          )}

          {/* Hostel Context Guard */}
          {userRole === 'incharge' && activeTab !== 'super_admin_overview' && !activeHostelId && !adminData?.hostelId ? (
            <HostelUnavailableState
              userRole={role || ''}
              availableHostels={hostels}
              onSelectHostel={(id) => {
                setActiveHostelId(id);
                setActiveTab('dashboard');
              }}
              onLogout={logout}
              onRefresh={() => window.location.reload()}
            />
          ) : userRole === 'incharge' ? (
            /* INCHARGE ACTIVE PANEL SWITCH */
            <div className="w-full h-full">
              {activeTab === 'super_admin_overview' && (
                <SuperAdminDashboard
                  onSelectHostel={(hostelId) => {
                    setActiveTab('dashboard');
                  }}
                  onSelectHostelDashboard={(hostelId) => {
                    setActiveTab('dashboard');
                  }}
                />
              )}

              {activeTab === 'dashboard' && (
                <InchargeDashboard 
                  students={students}
                  attendance={attendance}
                  leaves={leaveRequests}
                  bills={monthlyBills}
                  hostels={hostels}
                  rooms={rooms}
                  notices={notices}
                  setActiveTab={setActiveTab}
                  onQuickScan={() => setActiveTab('attendance')}
                />
              )}

              {activeTab === 'students' && (
                <StudentManagement 
                  students={students}
                  hostels={hostels}
                  rooms={rooms}
                  onUpsertStudent={upsertStudent}
                  onDeleteStudent={deleteStudent}
                  onReallocateRoom={reallocateRoom}
                  onImportCSV={importStudentsFromCSV}
                />
              )}

              {activeTab === 'attendance' && (
                <AttendanceCorrection 
                  students={students}
                  attendance={attendance}
                  hostels={hostels}
                  onRecordAttendance={recordAttendance}
                  onDeleteAttendance={deleteAttendance}
                />
              )}

              {activeTab === 'correction' && (
                <ManualAttendanceCorrection 
                  students={students}
                  attendance={attendance}
                  hostels={hostels}
                  onRecordAttendance={recordAttendance}
                />
              )}

              {activeTab === 'leaves' && (
                <LeaveManagement 
                  leaves={leaveRequests}
                  onProcessLeave={processLeaveRequest}
                />
              )}

              {activeTab === 'mess' && (
                <MessManagement 
                  bills={monthlyBills}
                  mealRates={mealRates}
                  students={students}
                  attendance={attendance}
                  onUpdateRates={updateMealRates}
                  onRecalculateAll={recalculateAllBills}
                  onMarkPaid={markBillPaid}
                  onDeleteAttendance={deleteAttendance}
                  onRecordAttendance={recordAttendance}
                />
              )}

              {activeTab === 'reports' && (
                <Reports 
                  students={students}
                  attendance={attendance}
                  leaves={leaveRequests}
                  bills={monthlyBills}
                  hostels={hostels}
                />
              )}

              {activeTab === 'notices' && (
                <NoticeManagement 
                  students={students}
                  hostelId={adminData?.hostelId}
                  superintendentName={user?.displayName || adminData?.name || "Hostel Superintendent"}
                />
              )}

              {activeTab === 'ai_bot' && (
                <AIChatbot 
                  students={students}
                  attendance={attendance}
                  leaves={leaveRequests}
                  bills={monthlyBills}
                  hostels={hostels}
                />
              )}
            </div>
          ) : (
            /* STUDENT VIEW SYSTEM */
            <div className="w-full h-full">
              {currentStudent ? (
                <StudentProfile 
                  student={currentStudent}
                  attendance={attendance}
                  leaves={leaveRequests}
                  bills={monthlyBills}
                  notifications={notifications}
                  onSubmitLeave={submitLeaveRequest}
                />
              ) : (
                <div className="bg-white border border-rose-200 rounded-2xl p-8 text-center max-w-lg mx-auto space-y-4 my-10 shadow-xs">
                  <div className="w-12 h-12 rounded-full bg-rose-50 text-rose-600 flex items-center justify-center mx-auto">
                    <ShieldAlert className="w-6 h-6" />
                  </div>
                  <h3 className="text-base font-bold text-slate-900">Student Profile Configuration Error</h3>
                  <p className="text-xs text-slate-500 leading-relaxed">
                    No active student record could be linked to your account. Please contact your Hostel In-charge or Superintendent to verify your Roll Number allocation in Firestore.
                  </p>
                </div>
              )}
            </div>
          )}

        </main>
      </div>

      {/* 3. ANNOUNCEMENT BROADCAST MODAL */}
      {showNoticeModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-xs flex items-center justify-center z-50 animate-fade-in">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h4 className="font-bold text-gray-900 text-sm flex items-center gap-1.5">
                <BellRing className="w-4 h-4 text-slate-800" /> Broadcast Hostel Announcement
              </h4>
              <button 
                id="close_notice_modal"
                onClick={() => setShowNoticeModal(false)} 
                className="p-1 text-gray-400 hover:text-gray-600 rounded-full cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleNoticeSubmit} className="space-y-4 text-xs">
              <div className="space-y-1">
                <label className="text-[10px] text-gray-400 uppercase font-bold">Announcement Title</label>
                <input 
                  id="notice_title_input"
                  type="text" 
                  required
                  placeholder="E.g., Emergency water maintenance drill..."
                  value={noticeTitle}
                  onChange={(e) => setNoticeTitle(e.target.value)}
                  className="w-full bg-gray-50 border border-slate-200 rounded-xl px-3 py-2 text-xs outline-none focus:border-slate-800 transition"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[10px] text-gray-400 uppercase font-bold">Severity protocol</label>
                  <select 
                    id="notice_type_select"
                    value={noticeType}
                    onChange={(e) => setNoticeType(e.target.value as any)}
                    className="w-full bg-gray-50 border border-slate-200 rounded-xl px-3 py-2 text-xs outline-none focus:border-slate-800 transition"
                  >
                    <option value="announcement">Standard notice</option>
                    <option value="emergency">High emergency broadcast</option>
                  </select>
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] text-gray-400 uppercase font-bold">Notice message description</label>
                <textarea 
                  id="notice_msg_textarea"
                  required
                  rows={4}
                  placeholder="Write clear details of the notice for students to view in their notification centers..."
                  value={noticeMsg}
                  onChange={(e) => setNoticeMsg(e.target.value)}
                  className="w-full bg-gray-50 border border-slate-200 rounded-xl p-3 text-xs outline-none focus:border-slate-800 transition resize-none"
                />
              </div>

              {noticeSuccess && (
                <div className="bg-slate-50 text-slate-800 p-2.5 rounded-xl border border-slate-200 flex items-center gap-1.5 font-medium">
                  <CheckCircle2 className="w-4 h-4 text-slate-800 shrink-0" />
                  <span>Announcement successfully broadcasted! Sync done.</span>
                </div>
              )}

              <div className="flex justify-end gap-2 border-t border-slate-100 pt-3">
                <button 
                  id="cancel_notice_submit"
                  type="button" 
                  onClick={() => setShowNoticeModal(false)}
                  className="bg-white hover:bg-gray-50 border border-slate-200 text-gray-700 px-4 py-2 rounded-xl cursor-pointer transition font-semibold text-xs"
                >
                  Cancel
                </button>
                <button 
                  id="confirm_notice_submit"
                  type="submit"
                  className="bg-slate-900 hover:bg-slate-850 text-white px-4 py-2 rounded-xl cursor-pointer transition font-semibold text-xs shadow-sm"
                >
                  Broadcast Notice
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 4. IN-CHARGE MOBILE BOTTOM NAVIGATION BAR */}
      {userRole === 'incharge' && activeTab !== 'super_admin_overview' && (
        <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 z-40 px-1 py-1.5 flex items-center justify-around shadow-lg">
          <button
            onClick={() => setActiveTab('dashboard')}
            className={`flex flex-col items-center gap-0.5 p-1 rounded-xl transition cursor-pointer ${
              activeTab === 'dashboard' ? 'text-indigo-600 font-extrabold' : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <Building2 className="w-4 h-4" />
            <span className="text-[9px]">Dashboard</span>
          </button>

          <button
            onClick={() => setActiveTab('students')}
            className={`flex flex-col items-center gap-0.5 p-1 rounded-xl transition cursor-pointer ${
              activeTab === 'students' ? 'text-indigo-600 font-extrabold' : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <Users className="w-4 h-4" />
            <span className="text-[9px]">Students</span>
          </button>

          <button
            onClick={() => setActiveTab('mess')}
            className={`flex flex-col items-center gap-0.5 p-1 rounded-xl transition cursor-pointer ${
              activeTab === 'mess' ? 'text-indigo-600 font-extrabold' : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <DollarSign className="w-4 h-4" />
            <span className="text-[9px]">Mess</span>
          </button>

          <button
            onClick={() => setActiveTab('attendance')}
            className={`flex flex-col items-center gap-0.5 p-1 rounded-xl transition cursor-pointer ${
              activeTab === 'attendance' ? 'text-indigo-600 font-extrabold' : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <CalendarCheck className="w-4 h-4" />
            <span className="text-[9px]">QR Scan</span>
          </button>

          <button
            onClick={() => setActiveTab('notices')}
            className={`flex flex-col items-center gap-0.5 p-1 rounded-xl transition cursor-pointer ${
              activeTab === 'notices' ? 'text-indigo-600 font-extrabold' : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <BellRing className="w-4 h-4" />
            <span className="text-[9px]">Notices</span>
          </button>

          <button
            onClick={() => setActiveTab('leaves')}
            className={`flex flex-col items-center gap-0.5 p-1 rounded-xl transition cursor-pointer ${
              activeTab === 'leaves' ? 'text-indigo-600 font-extrabold' : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <CalendarMinus className="w-4 h-4" />
            <span className="text-[9px]">Leave</span>
          </button>

          <button
            onClick={() => setActiveTab('reports')}
            className={`flex flex-col items-center gap-0.5 p-1 rounded-xl transition cursor-pointer ${
              activeTab === 'reports' ? 'text-indigo-600 font-extrabold' : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <FileSpreadsheet className="w-4 h-4" />
            <span className="text-[9px]">Reports</span>
          </button>
        </nav>
      )}

      {/* PWA Unobtrusive Install Prompt */}
      <PWAInstallPrompt />

      {/* Footer */}
      <footer className="bg-white border-t border-gray-100/50 py-4 pb-16 md:pb-4 text-center text-[11px] text-gray-400 font-medium">
        IRA Campus Hostel Management registers • Authorized college use only • Powered by Google AI Cloud Platform
      </footer>
    </div>
  );
}
