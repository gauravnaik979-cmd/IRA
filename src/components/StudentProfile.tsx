import React, { useState } from 'react';
import { Student, Attendance, LeaveRequest, MonthlyBill, Notification } from '../types';
import { 
  Download, Calendar, Mail, Phone, Home, CreditCard, Clock, CheckCircle2, 
  AlertTriangle, XCircle, Send, FileBadge, Bell, User, LayoutDashboard, 
  Receipt, FileText, UserCheck 
} from 'lucide-react';

interface StudentProfileProps {
  student: Student;
  attendance: Attendance[];
  leaves: LeaveRequest[];
  bills: MonthlyBill[];
  notifications: Notification[];
  onSubmitLeave: (leave: Omit<LeaveRequest, 'id' | 'status' | 'createdAt'>) => void;
}

type StudentMobileTab = 'dashboard' | 'attendance' | 'mess' | 'notices' | 'leave' | 'profile';

export default function StudentProfile({
  student,
  attendance,
  leaves,
  bills,
  notifications,
  onSubmitLeave
}: StudentProfileProps) {
  
  // States for Leave Application Form
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [reason, setReason] = useState('');
  const [formSuccess, setFormSuccess] = useState(false);

  // Mobile navigation active tab
  const [activeMobileTab, setActiveMobileTab] = useState<StudentMobileTab>('dashboard');

  if (!student) {
    return (
      <div className="bg-white border border-slate-200 rounded-2xl p-8 text-center max-w-xl mx-auto my-12 shadow-xs space-y-4">
        <User className="w-16 h-16 text-slate-300 mx-auto" />
        <h3 className="text-lg font-bold text-slate-900">No Student Profile Selected</h3>
        <p className="text-sm text-slate-500">
          There are currently no registered student profiles in the system database. Please switch to the **In-charge** role to enroll students first.
        </p>
      </div>
    );
  }

  // Filter personal records
  const personalAttendance = attendance.filter(a => a.studentId === student.id);
  const personalLeaves = leaves.filter(l => l.studentId === student.id);
  const personalBills = bills.filter(b => b.studentId === student.id);
  const personalNotifs = notifications.filter(n => n.target === 'all' || n.target === student.id);

  // Calculations
  const presentCount = personalAttendance.filter(a => a.status === 'present').length;
  const leaveCount = personalAttendance.filter(a => a.status === 'leave').length;
  const absentCount = personalAttendance.filter(a => a.status === 'absent').length;

  const currentMonthStr = new Date().toISOString().substring(0, 7);
  const currentMonthBill = personalBills.find(b => b.month === currentMonthStr) || {
    lunchCount: personalAttendance.filter(a => a.date.startsWith(currentMonthStr) && a.type === 'lunch' && a.status === 'present').length,
    dinnerCount: personalAttendance.filter(a => a.date.startsWith(currentMonthStr) && a.type === 'dinner' && a.status === 'present').length,
    totalAmount: 0,
    status: 'unpaid'
  };

  const handleLeaveSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!startDate || !endDate || !reason.trim()) return;

    onSubmitLeave({
      studentId: student.id,
      studentName: student.name,
      rollNumber: student.rollNumber,
      department: student.department,
      hostelName: student.hostelName,
      roomNumber: student.roomNumber,
      startDate,
      endDate,
      reason
    });

    setStartDate('');
    setEndDate('');
    setReason('');
    setFormSuccess(true);
    setTimeout(() => setFormSuccess(false), 4000);
  };

  const handlePrintCard = () => {
    const win = window.open('', '', 'width=500,height=700');
    if (win) {
      win.document.write(`
        <html>
          <head>
            <title>Digital Hostel ID Card - ${student.name}</title>
            <style>
              body { font-family: system-ui, sans-serif; display: flex; align-items: center; justify-content: center; height: 95vh; background: #f8fafc; }
              .card { width: 350px; background: white; border: 1px solid #e2e8f0; border-radius: 16px; padding: 24px; box-shadow: 0 4px 12px rgba(0,0,0,0.05); text-align: center; }
              .header { background: #0f172a; color: white; padding: 12px; border-radius: 8px; font-weight: bold; font-size: 14px; letter-spacing: 1px; margin-bottom: 16px; text-transform: uppercase; }
              .photo { width: 100px; height: 100px; border-radius: 50%; object-fit: cover; border: 4px solid #0f172a; margin: 0 auto 12px; }
              .name { font-size: 20px; font-weight: bold; color: #1e293b; margin: 0 0 4px; }
              .roll { font-family: monospace; font-size: 13px; color: #64748b; margin-bottom: 16px; }
              .grid { display: grid; grid-template-cols: 1fr 1fr; gap: 12px; text-align: left; font-size: 12px; color: #334155; margin-bottom: 20px; }
              .label { color: #64748b; font-size: 10px; text-transform: uppercase; font-weight: bold; }
              .qr { margin: 16px auto; width: 150px; height: 150px; }
              .footer { font-size: 10px; color: #94a3b8; font-weight: 500; border-top: 1px dashed #cbd5e1; padding-top: 12px; margin-top: 12px; }
            </style>
          </head>
          <body>
            <div class="card">
              <div class="header">IRA Campus Hostel ID</div>
              <img 
                class="photo" 
                src="${student.photoURL || student.photoUrl || ''}" 
                onerror="this.src='data:image/svg+xml;utf8,<svg xmlns=\'http://www.w3.org/2000/svg\' width=\'100\' height=\'100\' viewBox=\'0 0 24 24\' fill=\'%230f172a\' stroke=\'white\' stroke-width=\'1.5\'><circle cx=\'12\' cy=\'7\' r=\'4\'/><path d=\'M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2\'/></svg>'" 
              />
              <div class="name">${student.name}</div>
              <div class="roll">${student.rollNumber}</div>
              <div class="grid">
                <div>
                  <div class="label">Hostel Name</div>
                  <div style="font-weight: 600;">${student.hostelName.split(' ')[0]}</div>
                </div>
                <div>
                  <div class="label">Room & Bed</div>
                  <div style="font-weight: 600;">Room ${student.roomNumber} - Bed ${student.bedNumber}</div>
                </div>
                <div>
                  <div class="label">Department</div>
                  <div style="font-weight: 600;">${student.department}</div>
                </div>
                <div>
                  <div class="label">Semester</div>
                  <div style="font-weight: 600;">Semester ${student.semester}</div>
                </div>
              </div>
              <img class="qr" src="https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(student.qrId)}" />
              <div class="footer">Scan at Mess or Gate Entrance for Verification</div>
            </div>
            <script>window.print();</script>
          </body>
        </html>
      `);
      win.document.close();
    }
  };

  // Student prioritized mobile tabs bar component
  const studentMobileTabsList: { id: StudentMobileTab; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'attendance', label: 'Attendance', icon: UserCheck },
    { id: 'mess', label: 'Mess', icon: Receipt },
    { id: 'notices', label: 'Notices', icon: Bell },
    { id: 'leave', label: 'Leave', icon: Calendar },
    { id: 'profile', label: 'Profile', icon: User },
  ];

  return (
    <div className="space-y-6 animate-fade-in pb-16 lg:pb-0">
      
      {/* Student Prioritized Mobile Navigation Bar */}
      <div className="lg:hidden bg-white border border-slate-200 rounded-2xl p-1.5 shadow-xs overflow-x-auto scrollbar-none sticky top-16 z-30">
        <div className="flex items-center gap-1 min-w-max">
          {studentMobileTabsList.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeMobileTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveMobileTab(tab.id)}
                className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition cursor-pointer ${
                  isActive 
                    ? 'bg-slate-900 text-white shadow-xs' 
                    : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                }`}
              >
                <Icon className="w-3.5 h-3.5 shrink-0" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Left Column: Digital ID & Personal Details */}
        <div className={`space-y-6 ${activeMobileTab !== 'profile' && activeMobileTab !== 'dashboard' ? 'hidden lg:block' : ''}`}>
          
          {/* Digital ID Card */}
          <div className="bg-white border border-gray-100 rounded-2xl shadow-sm p-6 flex flex-col items-center">
            <div className="w-full flex items-center justify-between border-b border-gray-100 pb-4 mb-4">
              <h3 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
                <FileBadge className="w-4 h-4 text-slate-800" /> Digital Hostel ID
              </h3>
              <button 
                id="print_id_card_btn"
                onClick={handlePrintCard}
                className="text-xs text-slate-900 hover:text-slate-950 font-bold hover:underline flex items-center gap-1 cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" /> Print / PDF
              </button>
            </div>

            {/* HTML Structure targetable for Print */}
            <div id="digital_id_card" className="w-full max-w-[320px] bg-gradient-to-b from-slate-50/50 to-white border border-slate-200 rounded-2xl p-5 text-center relative overflow-hidden shadow-sm">
              <div className="absolute top-0 right-0 bg-slate-900 text-white text-[9px] uppercase font-bold tracking-widest px-4 py-1 rounded-bl-xl shadow-sm">
                IRA Hostel
              </div>

              <div className="flex flex-col items-center mt-3">
                <img 
                  src={student.photoURL || student.photoUrl || ''} 
                  alt={student.name} 
                  className="w-24 h-24 rounded-full border-4 border-slate-900 object-cover shadow-sm mb-3 bg-slate-100"
                  onError={(e) => {
                    (e.target as HTMLImageElement).src = 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="96" height="96" viewBox="0 0 24 24" fill="%23f1f5f9" stroke="%23334155" stroke-width="1.5"><circle cx="12" cy="7" r="4"/><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/></svg>';
                  }}
                />
                <h4 className="font-bold text-gray-900 text-lg leading-snug">{student.name}</h4>
                <p className="font-mono text-xs text-gray-500 mb-4">{student.rollNumber}</p>
              </div>

              <div className="grid grid-cols-2 gap-3 text-left bg-slate-50 border border-slate-200/60 p-3.5 rounded-xl text-xs text-gray-700 mb-4">
                <div>
                  <span className="text-[10px] text-gray-400 uppercase font-bold tracking-wider">Hostel</span>
                  <p className="font-semibold text-gray-800">{student.hostelName.split(' ')[0]}</p>
                </div>
                <div>
                  <span className="text-[10px] text-gray-400 uppercase font-bold tracking-wider">Room & Bed</span>
                  <p className="font-semibold text-gray-800">Rm {student.roomNumber} - Bed {student.bedNumber}</p>
                </div>
                <div>
                  <span className="text-[10px] text-gray-400 uppercase font-bold tracking-wider">Department</span>
                  <p className="font-semibold text-gray-800 truncate">{student.department}</p>
                </div>
                <div>
                  <span className="text-[10px] text-gray-400 uppercase font-bold tracking-wider">Semester</span>
                  <p className="font-semibold text-gray-800">Sem {student.semester}</p>
                </div>
              </div>

              {/* Generated QR Code */}
              <div className="bg-white border border-gray-100 p-2.5 rounded-xl w-36 h-36 mx-auto shadow-sm flex items-center justify-center">
                <img 
                  src={`https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(student.qrId)}`} 
                  alt="Student QR Card" 
                  className="w-full h-full object-contain"
                  referrerPolicy="no-referrer"
                />
              </div>
              <p className="text-[10px] text-gray-400 font-medium font-mono mt-3">QR ID: {student.qrId}</p>
            </div>
          </div>

          {/* Profile details list */}
          <div className="bg-white border border-gray-100 rounded-2xl shadow-sm p-6 space-y-4">
            <h3 className="text-sm font-semibold text-gray-900 border-b border-gray-100 pb-3">Contact Details</h3>
            <div className="space-y-3 text-sm">
              <div className="flex items-center gap-3 text-gray-600">
                <Phone className="w-4 h-4 text-teal-600 shrink-0" />
                <div>
                  <p className="text-[10px] text-gray-400 uppercase font-bold">Personal Phone</p>
                  <p className="font-medium text-gray-800">
                    {student.studentPhone || student.phone 
                      ? ((student.studentPhone || student.phone).startsWith('+') ? (student.studentPhone || student.phone) : `+91 ${student.studentPhone || student.phone}`) 
                      : 'Not provided'}
                  </p>
                </div>
              </div>
              {student.guardianName && (
                <div className="flex items-center gap-3 text-gray-600">
                  <User className="w-4 h-4 text-indigo-600 shrink-0" />
                  <div>
                    <p className="text-[10px] text-gray-400 uppercase font-bold">Guardian Name</p>
                    <p className="font-medium text-gray-800">{student.guardianName}</p>
                  </div>
                </div>
              )}
              <div className="flex items-center gap-3 text-gray-600">
                <Phone className="w-4 h-4 text-emerald-600 shrink-0" />
                <div>
                  <p className="text-[10px] text-gray-400 uppercase font-bold">Guardian Emergency Number</p>
                  <p className="font-medium text-gray-800">
                    {student.guardianPhone 
                      ? (student.guardianPhone.startsWith('+') ? student.guardianPhone : `+91 ${student.guardianPhone}`) 
                      : 'Not provided'}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3 text-gray-600">
                <Home className="w-4 h-4 text-indigo-600 shrink-0" />
                <div>
                  <p className="text-[10px] text-gray-400 uppercase font-bold">Admission Date</p>
                  <p className="font-medium text-gray-800">{student.admissionDate}</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Middle & Right Column: Dashboard Stats, Attendance History, Mess Bills, Leaves & Notices */}
        <div className="space-y-6 lg:col-span-2">
          
          {/* Quick Personal Stats Dashboard */}
          <div className={`grid grid-cols-3 gap-4 ${activeMobileTab !== 'dashboard' && activeMobileTab !== 'attendance' ? 'hidden lg:grid' : ''}`}>
            <div className="bg-slate-50 border border-slate-200 p-4 rounded-2xl text-center">
              <p className="text-gray-500 text-[10px] uppercase font-bold">Scanned Days</p>
              <p className="text-2xl font-extrabold text-slate-900 mt-1">{presentCount}</p>
            </div>
            <div className="bg-slate-50 border border-slate-200 p-4 rounded-2xl text-center">
              <p className="text-gray-500 text-[10px] uppercase font-bold">Approved Leaves</p>
              <p className="text-2xl font-extrabold text-slate-800 mt-1">{personalLeaves.filter(l => l.status === 'approved').length}</p>
            </div>
            <div className="bg-rose-50 border border-rose-100/50 p-4 rounded-2xl text-center">
              <p className="text-gray-500 text-[10px] uppercase font-bold">Missed Scans</p>
              <p className="text-2xl font-extrabold text-rose-700 mt-1">{absentCount}</p>
            </div>
          </div>

          {/* Mess Billing Hub */}
          <div className={`bg-white border border-gray-100 rounded-2xl shadow-sm p-6 space-y-4 ${
            activeMobileTab !== 'mess' && activeMobileTab !== 'dashboard' ? 'hidden lg:block' : ''
          }`}>
            <div className="flex items-center justify-between border-b border-gray-100 pb-4">
              <div>
                <h3 className="font-bold text-gray-900 text-base">Active Monthly Mess Balance</h3>
                <p className="text-xs text-gray-500">Current running billing cycle ({currentMonthStr})</p>
              </div>
              <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                student.messStatus === 'active' ? 'bg-emerald-100 text-emerald-800' : 'bg-gray-100 text-gray-600'
              }`}>
                Mess is {student.messStatus.toUpperCase()}
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
              <div className="bg-gray-50 p-4 rounded-xl">
                <span className="text-[10px] text-gray-400 uppercase font-bold">Lunch Scans</span>
                <p className="text-xl font-bold text-gray-800 mt-1">
                  {currentMonthBill.lunchCount ?? 0} <span className="text-xs font-normal text-gray-500">× ₹35</span>
                </p>
              </div>
              <div className="bg-gray-50 p-4 rounded-xl">
                <span className="text-[10px] text-gray-400 uppercase font-bold">Dinner Scans</span>
                <p className="text-xl font-bold text-gray-800 mt-1">
                  {currentMonthBill.dinnerCount ?? 0} <span className="text-xs font-normal text-gray-500">× ₹35</span>
                </p>
              </div>
              <div className="bg-slate-900 border border-slate-850 p-4 rounded-xl flex flex-col justify-between text-white">
                <span className="text-[10px] text-slate-300 uppercase font-bold">Total Running Bill</span>
                <div className="flex items-baseline justify-between mt-1">
                  <span className="text-2xl font-black text-white">
                    ₹{((currentMonthBill.lunchCount ?? 0) * 35) + ((currentMonthBill.dinnerCount ?? 0) * 35)}
                  </span>
                  <span className="text-[10px] font-mono text-amber-300 uppercase font-bold bg-slate-800 px-2 py-0.5 rounded-md">UNPAID</span>
                </div>
              </div>
            </div>
          </div>

          {/* Leave application terminal & active requests */}
          <div className={`grid grid-cols-1 md:grid-cols-2 gap-6 ${
            activeMobileTab !== 'leave' && activeMobileTab !== 'dashboard' ? 'hidden lg:grid' : ''
          }`}>
            {/* Submit Leave */}
            <div className="bg-white border border-gray-100 rounded-2xl shadow-sm p-6 space-y-4">
              <h3 className="font-bold text-gray-900 text-sm flex items-center gap-2">
                <Calendar className="w-4 h-4 text-slate-700" /> Apply For Gate Leave / Mess Off
              </h3>
              
              <form onSubmit={handleLeaveSubmit} className="space-y-3.5">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-[10px] text-gray-400 uppercase font-bold">From Date</label>
                    <input 
                      type="date" 
                      required
                      value={startDate}
                      onChange={(e) => setStartDate(e.target.value)}
                      className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-xs outline-none focus:border-slate-800 transition"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] text-gray-400 uppercase font-bold">To Date</label>
                    <input 
                      type="date" 
                      required
                      value={endDate}
                      onChange={(e) => setEndDate(e.target.value)}
                      className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-xs outline-none focus:border-slate-800 transition"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] text-gray-400 uppercase font-bold">Reason for Leave</label>
                  <textarea 
                    required
                    rows={2}
                    placeholder="E.g., Medical treatment, family function..."
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-xs outline-none focus:border-slate-800 transition resize-none"
                  />
                </div>

                {formSuccess && (
                  <div className="bg-slate-50 text-slate-800 text-[11px] p-2.5 rounded-xl border border-slate-200 flex items-center gap-2 animate-pulse">
                    <CheckCircle2 className="w-4 h-4 text-slate-750 shrink-0" />
                    <span>Leave request submitted successfully. Waiting for in-charge approval.</span>
                  </div>
                )}

                <button 
                  id="submit_leave_btn"
                  type="submit"
                  className="w-full bg-slate-900 hover:bg-slate-850 text-white py-2 rounded-xl text-xs font-semibold cursor-pointer flex items-center justify-center gap-2 transition"
                >
                  <Send className="w-3.5 h-3.5" /> Submit Application
                </button>
              </form>
            </div>

            {/* Leave Log */}
            <div className="bg-white border border-gray-100 rounded-2xl shadow-sm p-6 space-y-4">
              <h3 className="font-bold text-gray-900 text-sm flex items-center gap-2">
                <Clock className="w-4 h-4 text-slate-700" /> Active Applications
              </h3>

              <div className="space-y-3 max-h-[220px] overflow-y-auto">
                {personalLeaves.length === 0 ? (
                  <p className="text-xs text-gray-400 py-6 text-center">No leave applications found.</p>
                ) : (
                  personalLeaves.map((l, i) => (
                    <div key={l.id || `prof-leave-${l.startDate}-${i}`} className="border border-gray-50 rounded-xl p-3 text-xs bg-gray-50/50 space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-gray-700">
                          {l.startDate} to {l.endDate}
                        </span>
                        <span className={`px-2 py-0.5 rounded-full text-[9px] uppercase font-bold tracking-wider ${
                          l.status === 'approved' ? 'bg-emerald-100 text-emerald-800 border border-emerald-200' :
                          l.status === 'rejected' ? 'bg-rose-100 text-rose-800 border border-rose-200' :
                          'bg-amber-100 text-amber-800 border border-amber-200'
                        }`}>
                          {l.status}
                        </span>
                      </div>
                      <p className="text-gray-500 text-[11px] italic">"{l.reason}"</p>
                      {l.processedBy && (
                        <p className="text-[10px] text-gray-400 mt-1 border-t border-gray-100 pt-1">
                          Reviewed by: {l.processedBy}
                        </p>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

          {/* Notifications & Announcements Inbox */}
          <div className={`bg-white border border-gray-100 rounded-2xl shadow-sm p-6 space-y-4 ${
            activeMobileTab !== 'notices' && activeMobileTab !== 'dashboard' ? 'hidden lg:block' : ''
          }`}>
            <h3 className="font-bold text-gray-900 text-sm flex items-center gap-2 border-b border-gray-100 pb-3">
              <Bell className="w-4 h-4 text-slate-700 animate-swing" /> Hostel Noticeboard & Notifications
            </h3>

            <div className="space-y-3 max-h-[240px] overflow-y-auto">
              {personalNotifs.map((n, i) => (
                <div key={n.id || `prof-notif-${n.createdAt || ''}-${i}`} className="flex gap-3 border-b border-gray-50 pb-3 last:border-b-0">
                  <div className={`p-1.5 h-7 w-7 rounded-full flex items-center justify-center shrink-0 ${
                    n.type === 'emergency' ? 'bg-rose-50 text-rose-600' :
                    n.type === 'leave_status' ? 'bg-amber-50 text-amber-600' :
                    'bg-slate-50 text-slate-700 border border-slate-100'
                  }`}>
                    {n.type === 'emergency' ? <AlertTriangle className="w-4 h-4" /> : <Bell className="w-4 h-4" />}
                  </div>
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-gray-950 text-xs">{n.title}</span>
                      <span className="text-[9px] text-gray-400 font-mono">{new Date(n.createdAt).toLocaleDateString()}</span>
                    </div>
                    <p className="text-gray-600 text-xs leading-relaxed">{n.message}</p>
                    <span className="text-[10px] text-gray-400 font-medium">Sender: {n.sender}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
