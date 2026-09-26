import React from 'react';
import { Users, UserCheck, UserMinus, CalendarDays, UtensilsCrossed, CreditCard, Clock, FileBadge, ArrowRight, ShieldCheck, HelpCircle, BellRing, Pin, Send, AlertTriangle } from 'lucide-react';
import { Student, Attendance, LeaveRequest, MonthlyBill, Hostel, Room, Notice } from '../types';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, Legend, Cell, PieChart, Pie } from 'recharts';

interface InchargeDashboardProps {
  students: Student[];
  attendance: Attendance[];
  leaves: LeaveRequest[];
  bills: MonthlyBill[];
  hostels: Hostel[];
  rooms: Room[];
  notices?: Notice[];
  setActiveTab: (tab: string) => void;
  onQuickScan: () => void;
}

export default function InchargeDashboard({ 
  students, 
  attendance, 
  leaves, 
  bills, 
  hostels, 
  rooms, 
  notices = [],
  setActiveTab,
  onQuickScan
}: InchargeDashboardProps) {
  
  // Date Helpers
  const todayStr = new Date().toISOString().split('T')[0];

  // 1. STATS CALCULATIONS
  const totalStudentsCount = students.length;
  const presentTodayCount = students.filter(s => s.hostelStatus === 'present').length;
  const onLeaveTodayCount = students.filter(s => s.hostelStatus === 'leave').length;
  const absentTodayCount = students.filter(s => s.hostelStatus === 'absent').length;

  const lunchTodayCount = attendance.filter(a => a.date === todayStr && a.type === 'lunch' && a.status === 'present').length;
  const dinnerTodayCount = attendance.filter(a => a.date === todayStr && a.type === 'dinner' && a.status === 'present').length;
  const totalRevenue = bills.reduce((acc, b) => b.status === 'paid' ? acc + b.totalAmount : acc, 0);
  const pendingLeavesCount = leaves.filter(l => l.status === 'pending').length;

  // 2. CHART DATA 1: Last 7 Days Attendance Trends
  const getLast7DaysData = () => {
    const data = [];
    const today = new Date();
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(today.getDate() - i);
      const dateStr = d.toISOString().split('T')[0];
      const dayLabel = d.toLocaleDateString([], { weekday: 'short', month: 'numeric', day: 'numeric' });

      // Filter attendance records on this date
      const dayAtts = attendance.filter(a => a.date === dateStr && a.type === 'hostel');
      
      let present = dayAtts.filter(a => a.status === 'present').length;
      let absent = dayAtts.filter(a => a.status === 'absent').length;
      let leave = dayAtts.filter(a => a.status === 'leave').length;

      // Fallback fallback if no scans recorded for a day
      if (dayAtts.length === 0) {
        present = 0;
        absent = 0;
        leave = 0;
      }

      data.push({
        name: dayLabel,
        Present: present,
        Absent: absent,
        Leave: leave,
      });
    }
    return data;
  };

  const attendanceChartData = getLast7DaysData();

  // CHART DATA 2: Meal distribution
  const getMealDistributionData = () => {
    const data = [];
    const today = new Date();
    for (let i = 4; i >= 0; i--) {
      const d = new Date();
      d.setDate(today.getDate() - i);
      const dateStr = d.toISOString().split('T')[0];
      const dayLabel = d.toLocaleDateString([], { weekday: 'short' });

      const lunch = attendance.filter(a => a.date === dateStr && a.type === 'lunch' && a.status === 'present').length;
      const dinner = attendance.filter(a => a.date === dateStr && a.type === 'dinner' && a.status === 'present').length;

      data.push({
        name: dayLabel,
        Lunch: lunch,
        Dinner: dinner,
      });
    }
    return data;
  };

  const mealChartData = getMealDistributionData();

  // Occupancy calculations
  const totalBedsCount = hostels.reduce((acc, h) => acc + h.capacity, 0);
  const occupiedBedsCount = students.length;
  const vacantBedsCount = Math.max(0, totalBedsCount - occupiedBedsCount);
  const occupancyPercentage = Math.round((occupiedBedsCount / totalBedsCount) * 100) || 0;

  // Boys vs Girls Occupancy
  const boysOccupied = students.filter(s => s.hostelName.includes('Boys')).length;
  const boysCapacity = hostels.find(h => h.type === 'Boys')?.capacity || 30;
  const girlsOccupied = students.filter(s => s.hostelName.includes('Girls')).length;
  const girlsCapacity = hostels.find(h => h.type === 'Girls')?.capacity || 30;

  const pieData = [
    { name: 'Occupied Beds', value: occupiedBedsCount, color: '#0f172a' }, // slate-900
    { name: 'Vacant Beds', value: vacantBedsCount, color: '#e2e8f0' } // slate-200
  ];

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Overview Intro Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-900 to-slate-950 p-6 md:p-8 rounded-2xl text-white flex flex-col md:flex-row items-start md:items-center justify-between gap-6 shadow-sm">
        <div className="space-y-2">
          <div className="flex items-center gap-2 bg-slate-800/80 text-slate-300 text-xs px-3 py-1 rounded-full border border-slate-700 w-fit font-medium">
            <ShieldCheck className="w-3.5 h-3.5" /> Approved College Portal
          </div>
          <h2 className="text-2xl md:text-3xl font-semibold tracking-tight">IRA Campus: Hostel Dashboard</h2>
          <p className="text-slate-300 text-sm max-w-xl">
            Streamlining roll-calls, automating mess balances, and executing direct Firestore sync. Authorized view: **Hostel In-charge**.
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <button 
            id="quick_scan_btn"
            onClick={onQuickScan}
            className="bg-white text-slate-900 hover:bg-slate-50 px-5 py-2.5 rounded-xl text-sm font-semibold shadow-md flex items-center gap-2 transition cursor-pointer">
            <UtensilsCrossed className="w-4 h-4 text-slate-700" /> Start QR Scanner
          </button>
          <button 
            id="quick_notice_btn"
            onClick={() => setActiveTab('notices')}
            className="bg-slate-800 hover:bg-slate-750 text-white border border-slate-700 px-5 py-2.5 rounded-xl text-sm font-semibold flex items-center gap-2 transition cursor-pointer">
            Publish Notice
          </button>
        </div>
      </div>

      {/* Empty state banners if students or rooms are not configured */}
      {students.length === 0 && (
        <div className="p-4 bg-amber-50 border border-amber-200 text-amber-900 rounded-2xl text-xs font-medium flex items-center gap-2">
          <HelpCircle className="w-4 h-4 text-amber-600 shrink-0" />
          <span>No students have been registered for this hostel.</span>
        </div>
      )}
      {rooms.length === 0 && (
        <div className="p-4 bg-amber-50 border border-amber-200 text-amber-900 rounded-2xl text-xs font-medium flex items-center gap-2">
          <HelpCircle className="w-4 h-4 text-amber-600 shrink-0" />
          <span>No rooms have been configured.</span>
        </div>
      )}

      {/* Metrics Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
        {/* Total Students */}
        <div className="bg-white border border-slate-200 hover:border-slate-300 hover:shadow-sm p-5 rounded-2xl flex items-center justify-between transition-all duration-300">
          <div className="space-y-1.5">
            <p className="text-xs text-gray-500 uppercase font-bold tracking-wider">Total Occupants</p>
            <h3 className="text-2xl md:text-3xl font-bold text-gray-900 font-sans tracking-tight">{totalStudentsCount}</h3>
            <p className="text-[11px] text-gray-400">Allocated in {rooms.filter(r => r.occupiedBeds > 0).length} Rooms</p>
          </div>
          <div className="bg-slate-50 p-3.5 rounded-2xl text-slate-700 border border-slate-100">
            <Users className="w-6 h-6" />
          </div>
        </div>

        {/* Present Today */}
        <div className="bg-white border border-slate-200 hover:border-slate-300 hover:shadow-sm p-5 rounded-2xl flex items-center justify-between transition-all duration-300">
          <div className="space-y-1.5">
            <p className="text-xs text-gray-500 uppercase font-bold tracking-wider font-sans">Present Today</p>
            <h3 className="text-2xl md:text-3xl font-bold text-slate-900 font-sans tracking-tight">{presentTodayCount}</h3>
            <p className="text-[11px] text-gray-400">{Math.round((presentTodayCount / totalStudentsCount) * 100 || 0)}% Attendance rate</p>
          </div>
          <div className="bg-slate-50 p-3.5 rounded-2xl text-slate-800 border border-slate-100">
            <UserCheck className="w-6 h-6" />
          </div>
        </div>

        {/* On Leave */}
        <div className="bg-white border border-slate-200 hover:border-slate-300 hover:shadow-sm p-5 rounded-2xl flex items-center justify-between transition-all duration-300">
          <div className="space-y-1.5">
            <p className="text-xs text-gray-500 uppercase font-bold tracking-wider">Active Leaves</p>
            <h3 className="text-2xl md:text-3xl font-bold text-slate-800 tracking-tight">{onLeaveTodayCount}</h3>
            <p className="text-[11px] text-gray-400">No mess charges apply</p>
          </div>
          <div className="bg-slate-50 p-3.5 rounded-2xl text-slate-600 border border-slate-100">
            <CalendarDays className="w-6 h-6" />
          </div>
        </div>

        {/* Absent */}
        <div className="bg-white border border-slate-200 hover:border-slate-300 hover:shadow-sm p-5 rounded-2xl flex items-center justify-between transition-all duration-300">
          <div className="space-y-1.5">
            <p className="text-xs text-gray-500 uppercase font-bold tracking-wider">Absent / Unreported</p>
            <h3 className="text-2xl md:text-3xl font-bold text-rose-600 tracking-tight">{absentTodayCount}</h3>
            <p className="text-[11px] text-gray-400">Requires review</p>
          </div>
          <div className="bg-rose-50 p-3.5 rounded-2xl text-rose-600 border border-rose-100">
            <UserMinus className="w-6 h-6" />
          </div>
        </div>

        {/* Today's Lunch Count */}
        <div className="bg-white border border-slate-200 hover:border-slate-300 hover:shadow-sm p-5 rounded-2xl flex items-center justify-between transition-all duration-300">
          <div className="space-y-1.5">
            <p className="text-xs text-gray-500 uppercase font-bold tracking-wider">Lunch Scans Today</p>
            <h3 className="text-2xl md:text-3xl font-bold text-slate-900 tracking-tight">{lunchTodayCount}</h3>
            <p className="text-[11px] text-slate-500 font-medium">₹{lunchTodayCount * 35} Generated</p>
          </div>
          <div className="bg-slate-50 p-3.5 rounded-2xl text-slate-700 border border-slate-100">
            <UtensilsCrossed className="w-6 h-6" />
          </div>
        </div>

        {/* Today's Dinner Count */}
        <div className="bg-white border border-slate-200 hover:border-slate-300 hover:shadow-sm p-5 rounded-2xl flex items-center justify-between transition-all duration-300">
          <div className="space-y-1.5">
            <p className="text-xs text-gray-500 uppercase font-bold tracking-wider">Dinner Scans Today</p>
            <h3 className="text-2xl md:text-3xl font-bold text-slate-900 tracking-tight">{dinnerTodayCount}</h3>
            <p className="text-[11px] text-slate-500 font-medium">₹{dinnerTodayCount * 35} Generated</p>
          </div>
          <div className="bg-slate-50 p-3.5 rounded-2xl text-slate-700 border border-slate-100">
            <UtensilsCrossed className="w-6 h-6" />
          </div>
        </div>

        {/* Monthly Revenue */}
        <div className="bg-white border border-slate-200 hover:border-slate-300 hover:shadow-sm p-5 rounded-2xl flex items-center justify-between transition-all duration-300">
          <div className="space-y-1.5">
            <p className="text-xs text-gray-500 uppercase font-bold tracking-wider">Revenue Collected</p>
            <h3 className="text-2xl md:text-3xl font-bold text-slate-900 tracking-tight">₹{totalRevenue}</h3>
            <p className="text-[11px] text-gray-400">Total processed mess bills</p>
          </div>
          <div className="bg-slate-900 p-3.5 rounded-2xl text-white border border-slate-800">
            <CreditCard className="w-6 h-6" />
          </div>
        </div>

        {/* Pending Leave Requests */}
        <div className="bg-white border border-slate-200 hover:border-slate-300 hover:shadow-sm p-5 rounded-2xl flex items-center justify-between transition-all duration-300">
          <div className="space-y-1.5">
            <p className="text-xs text-gray-500 uppercase font-bold tracking-wider">Pending Leaves</p>
            <h3 className="text-2xl md:text-3xl font-bold text-slate-800 tracking-tight">{pendingLeavesCount}</h3>
            {pendingLeavesCount > 0 ? (
              <button 
                id="view_leaves_notif"
                onClick={() => setActiveTab('leaves')} 
                className="text-[11px] text-slate-900 font-bold hover:underline flex items-center gap-1 cursor-pointer">
                Process applications <ArrowRight className="w-3 h-3" />
              </button>
            ) : (
              <p className="text-[11px] text-gray-400">All applications processed</p>
            )}
          </div>
          <div className="bg-slate-50 p-3.5 rounded-2xl text-slate-700 border border-slate-100">
            <Clock className="w-6 h-6" />
          </div>
        </div>
      </div>

      {/* RECENT NOTICES DASHBOARD WIDGET */}
      {(() => {
        const activeNotices = notices.filter(n => !n.expiresAt || new Date(n.expiresAt) > new Date());
        const emergencyNotices = activeNotices.filter(n => n.priority === 'emergency');
        const expiringSoonNotices = activeNotices.filter(n => {
          if (!n.expiresAt) return false;
          const exp = new Date(n.expiresAt).getTime();
          const diffHours = (exp - Date.now()) / (1000 * 60 * 60);
          return diffHours > 0 && diffHours <= 48;
        });
        const lastPublishedTime = notices.length > 0 ? new Date(notices[0].createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'None';

        return (
          <div className="bg-white border border-slate-200 rounded-2xl shadow-xs p-5 md:p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-slate-900 text-white rounded-xl">
                  <BellRing className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-extrabold text-slate-900 tracking-tight">Recent Notices & Broadcasts</h3>
                  <p className="text-[11px] text-slate-500">Live notice stats & push alert dispatch overview</p>
                </div>
              </div>

              <button
                id="manage_notices_dash_btn"
                onClick={() => setActiveTab('notices')}
                className="bg-slate-900 hover:bg-slate-800 text-white font-bold px-3.5 py-1.5 rounded-xl text-xs flex items-center gap-1.5 cursor-pointer shadow-xs transition"
              >
                <span>Publish Notice</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* 4 Stat Pills */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div className="bg-slate-50 border border-slate-200 p-3 rounded-xl text-left space-y-0.5">
                <span className="text-[10px] uppercase font-bold text-slate-400">Active Notices</span>
                <p className="text-lg font-black text-slate-900">{activeNotices.length}</p>
              </div>

              <div className="bg-red-50 border border-red-200 p-3 rounded-xl text-left space-y-0.5">
                <span className="text-[10px] uppercase font-bold text-red-500">Emergency Alerts</span>
                <p className="text-lg font-black text-red-700">{emergencyNotices.length}</p>
              </div>

              <div className="bg-amber-50 border border-amber-200 p-3 rounded-xl text-left space-y-0.5">
                <span className="text-[10px] uppercase font-bold text-amber-600">Expiring Soon</span>
                <p className="text-lg font-black text-amber-800">{expiringSoonNotices.length}</p>
              </div>

              <div className="bg-blue-50 border border-blue-200 p-3 rounded-xl text-left space-y-0.5">
                <span className="text-[10px] uppercase font-bold text-blue-600">Last Published</span>
                <p className="text-xs font-bold text-blue-900 truncate">{lastPublishedTime}</p>
              </div>
            </div>

            {/* Top 3 Active Notices Preview */}
            <div className="space-y-2 pt-1">
              {activeNotices.length === 0 ? (
                <p className="text-xs text-slate-400 font-medium text-center py-2">
                  No active notices currently published.
                </p>
              ) : (
                activeNotices.slice(0, 3).map((notice) => (
                  <div
                    key={notice.id}
                    onClick={() => setActiveTab('notices')}
                    className="flex items-center justify-between p-3 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl transition cursor-pointer text-xs"
                  >
                    <div className="flex items-center gap-2.5 truncate pr-2">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase shrink-0 ${
                        notice.priority === 'emergency' ? 'bg-red-100 text-red-700' : notice.priority === 'important' ? 'bg-amber-100 text-amber-800' : 'bg-blue-100 text-blue-800'
                      }`}>
                        {notice.priority}
                      </span>
                      <span className="font-bold text-slate-800 truncate">{notice.title}</span>
                    </div>
                    <span className="text-[10px] font-mono text-slate-400 shrink-0">
                      {new Date(notice.createdAt).toLocaleDateString([], { month: 'short', day: 'numeric' })}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>
        );
      })()}

      {/* Analytics Charts Panel */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Attendance Trends */}
        <div className="bg-white border border-gray-100 rounded-2xl shadow-sm p-6 lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-base font-semibold text-gray-900">Hostel Roll Call Rollout (Last 7 Days)</h3>
              <p className="text-xs text-gray-500">Student daily reporting status</p>
            </div>
            <span className="text-[11px] font-mono bg-gray-100 text-gray-600 px-2 py-1 rounded-md">Live Sync Active</span>
          </div>
          <div className="h-[280px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={attendanceChartData}>
                <defs>
                  <linearGradient id="colorPresent" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.1}/>
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                  </linearGradient>
                  <linearGradient id="colorLeave" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.1}/>
                    <stop offset="95%" stopColor="#f59e0b" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="name" stroke="#64748b" fontSize={11} tickLine={false} />
                <YAxis stroke="#64748b" fontSize={11} tickLine={false} />
                <Tooltip contentStyle={{ fontSize: '12px', borderRadius: '12px', border: '1px solid #f1f5f9', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.05)' }} />
                <Legend iconType="circle" wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }} />
                <Area type="monotone" dataKey="Present" stroke="#10b981" fillOpacity={1} fill="url(#colorPresent)" strokeWidth={2} />
                <Area type="monotone" dataKey="Leave" stroke="#f59e0b" fillOpacity={1} fill="url(#colorLeave)" strokeWidth={2} />
                <Area type="monotone" dataKey="Absent" stroke="#f43f5e" fillOpacity={0} strokeWidth={2} strokeDasharray="4 4" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Occupancy Status */}
        <div className="bg-white border border-gray-100 rounded-2xl shadow-sm p-6 flex flex-col justify-between space-y-4">
          <div>
            <h3 className="text-base font-semibold text-gray-900">Hostel Bed Occupancy</h3>
            <p className="text-xs text-gray-500">Live physical bed inventory</p>
          </div>
          
          <div className="flex-1 flex flex-col items-center justify-center py-4">
            <div className="relative w-44 h-44 flex items-center justify-center">
              {/* Simple beautiful Pie Chart */}
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={pieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={55}
                    outerRadius={75}
                    paddingAngle={3}
                    dataKey="value"
                  >
                    {pieData.map((entry, index) => (
                      <Cell key={`pie-cell-${entry.name}-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
              <div className="absolute text-center">
                <span className="text-3xl font-extrabold text-gray-900 font-sans">{occupancyPercentage}%</span>
                <p className="text-[10px] uppercase font-bold text-gray-400 tracking-wider">Occupied</p>
              </div>
            </div>
            
            {/* Legend */}
            <div className="w-full grid grid-cols-2 gap-2 text-center text-xs mt-4">
              <div className="p-2 bg-slate-50 border border-slate-200 rounded-xl">
                <p className="text-gray-500 text-[10px] uppercase font-semibold">Occupied</p>
                <p className="font-bold text-slate-900 text-sm">{occupiedBedsCount} Beds</p>
              </div>
              <div className="p-2 bg-gray-50 border border-gray-100 rounded-xl">
                <p className="text-gray-500 text-[10px] uppercase font-semibold">Vacant</p>
                <p className="font-bold text-gray-700 text-sm">{vacantBedsCount} Beds</p>
              </div>
            </div>
          </div>

          <div className="space-y-3 border-t border-gray-100 pt-4">
            {hostels.length === 0 ? (
              <p className="text-xs text-gray-500 font-medium text-center py-2">No hostels configured.</p>
            ) : (
              hostels.map((h, idx) => {
                const hostelStudents = students.filter(s => s.hostelName === h.name || (s as any).hostelId === h.id);
                const occupied = hostelStudents.length;
                const capacity = h.capacity || 30;
                const pct = Math.min(100, Math.round((occupied / capacity) * 100));
                return (
                  <div key={h.id || h.name || `hostel-item-${idx}`} className="space-y-1">
                    <div className="flex justify-between text-xs font-medium text-gray-600">
                      <span>{h.name}</span>
                      <span>{occupied} / {capacity} Beds</span>
                    </div>
                    <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                      <div className="bg-slate-900 h-2 rounded-full" style={{ width: `${pct}%` }}></div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>

      {/* Meal Volume & Recent Scans */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Mess Daily Scans Chart */}
        <div className="bg-white border border-gray-100 rounded-2xl shadow-sm p-6 space-y-4">
          <div>
            <h3 className="text-base font-semibold text-gray-900">Mess Consumed Volume</h3>
            <p className="text-xs text-gray-500">Meal scan comparison (last 5 days)</p>
          </div>
          <div className="h-[220px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={mealChartData} margin={{ top: 10, right: 0, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                <XAxis dataKey="name" stroke="#64748b" fontSize={11} tickLine={false} />
                <YAxis stroke="#64748b" fontSize={11} tickLine={false} />
                <Tooltip contentStyle={{ fontSize: '11px', borderRadius: '12px' }} />
                <Legend wrapperStyle={{ fontSize: '11px' }} />
                <Bar dataKey="Lunch" fill="#06b6d4" radius={[4, 4, 0, 0]} />
                <Bar dataKey="Dinner" fill="#6366f1" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Live Attendance Scanner Log */}
        <div className="bg-white border border-gray-100 rounded-2xl shadow-sm p-6 lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-base font-semibold text-gray-900">Live Entry & Scanner Register</h3>
              <p className="text-xs text-gray-500">Most recent QR scans recorded in database</p>
            </div>
            <button 
              id="view_all_att_btn"
              onClick={() => setActiveTab('attendance')} 
              className="text-xs text-slate-900 hover:text-slate-950 font-bold hover:underline flex items-center gap-1 cursor-pointer">
              Go to registers <ArrowRight className="w-4 h-4" />
            </button>
          </div>
          
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm border-collapse">
              <thead>
                <tr className="border-b border-gray-100 text-xs text-gray-400 uppercase font-bold tracking-wider">
                  <th className="py-2.5">Student</th>
                  <th className="py-2.5">Hostel & Room</th>
                  <th className="py-2.5">Time</th>
                  <th className="py-2.5">Scan Type</th>
                  <th className="py-2.5 text-right">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {attendance.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-12 text-center text-gray-400 font-medium">
                      No data available (No scans recorded yet)
                    </td>
                  </tr>
                ) : (
                  attendance.slice(0, 5).map((a, i) => (
                    <tr key={a.id || `att-row-${a.studentId || ''}-${a.date || ''}-${a.type || ''}-${i}`} className="hover:bg-gray-50/50 transition">
                      <td className="py-3">
                        <div className="flex flex-col">
                          <span className="font-semibold text-gray-900 text-xs">{a.studentName}</span>
                          <span className="text-[10px] font-mono text-gray-500">{a.rollNumber}</span>
                        </div>
                      </td>
                      <td className="py-3">
                        <div className="flex flex-col text-xs text-gray-600">
                          <span>{a.hostelName.split(' ')[0]}</span>
                          <span className="text-[10px]">Room {a.roomNumber}</span>
                        </div>
                      </td>
                      <td className="py-3">
                        <div className="flex flex-col text-xs text-gray-600">
                          <span>{a.date}</span>
                          <span className="text-[10px] text-gray-400 font-mono">{a.time}</span>
                        </div>
                      </td>
                      <td className="py-3">
                        <span className={`text-[10px] px-2.5 py-1 rounded-full font-semibold uppercase tracking-wider ${
                          a.type === 'lunch' ? 'bg-slate-50 text-slate-700 border border-slate-200' :
                          a.type === 'dinner' ? 'bg-slate-50 text-slate-700 border border-slate-200' :
                          'bg-slate-50 text-slate-800 border border-slate-200'
                        }`}>
                          {a.type}
                        </span>
                      </td>
                      <td className="py-3 text-right">
                        <span className={`inline-flex items-center gap-1 text-[11px] font-semibold uppercase ${
                          a.status === 'present' ? 'text-emerald-600' :
                          a.status === 'absent' ? 'text-rose-600' :
                          'text-amber-500'
                        }`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${
                            a.status === 'present' ? 'bg-emerald-500' :
                            a.status === 'absent' ? 'bg-rose-500' :
                            'bg-amber-400'
                          }`}></span>
                          {a.status}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
