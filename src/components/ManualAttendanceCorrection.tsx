import React, { useState, useEffect, useMemo } from 'react';
import { Student, Attendance, Hostel } from '../types';
import { 
  ClipboardCheck, 
  Calendar, 
  Search, 
  Check, 
  X, 
  AlertCircle, 
  Loader2, 
  Sun, 
  Moon, 
  Building2, 
  Filter, 
  MessageSquare
} from 'lucide-react';

interface ManualAttendanceCorrectionProps {
  students: Student[];
  attendance: Attendance[];
  hostels?: Hostel[];
  onRecordAttendance: (
    studentId: string, 
    type: 'hostel' | 'lunch' | 'dinner', 
    status: 'present' | 'absent' | 'leave', 
    recordedBy: 'scanner' | 'manual',
    notes?: string,
    targetDate?: string
  ) => Promise<any>;
}

export default function ManualAttendanceCorrection({
  students,
  attendance,
  hostels = [],
  onRecordAttendance
}: ManualAttendanceCorrectionProps) {
  // 1. Core State
  const [selectedDate, setSelectedDate] = useState<string>(() => new Date().toISOString().split('T')[0]);
  const [selectedMeal, setSelectedMeal] = useState<'lunch' | 'dinner'>('lunch');
  const [selectedHostel, setSelectedHostel] = useState(hostels[0]?.name || "");
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'unmarked' | 'present' | 'absent'>('all');
  const [selectedRoom, setSelectedRoom] = useState<string>('all');
  
  // Custom reason popover state
  const [editingReasonStudentId, setEditingReasonStudentId] = useState<string | null>(null);
  const [customReasonText, setCustomReasonText] = useState('');
  
  // Feedback & Loading State
  const [loadingActionId, setLoadingActionId] = useState<string | null>(null);
  const [toastFeedback, setToastFeedback] = useState<{
    id: number;
    message: string;
    type: 'success' | 'error';
  } | null>(null);

  // Sync default hostel if updated
  useEffect(() => {
    if (hostels.length > 0 && (!selectedHostel || !hostels.some(h => h.name === selectedHostel))) {
      setSelectedHostel(hostels[0].name);
    }
  }, [hostels, selectedHostel]);

  // Extract unique room list for the selected hostel
  const availableRooms = useMemo(() => {
    const relevantStudents = students.filter(s => !selectedHostel || s.hostelName === selectedHostel);
    const rooms = Array.from(new Set(relevantStudents.map(s => s.roomNumber).filter(Boolean)));
    return rooms.sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' }));
  }, [students, selectedHostel]);

  // Helper: Query canonical attendance status for a student on selectedDate & selectedMeal
  const getMealStatusForStudent = (studentId: string, rollNumber: string, meal: 'lunch' | 'dinner', date: string): 'present' | 'absent' | 'leave' | null => {
    const record = attendance.find(a => 
      a.date === date && 
      (a.studentId === studentId || a.rollNumber === rollNumber) && 
      a.type === meal
    );
    return record ? record.status : null;
  };

  // Base list of students belonging to the active hostel
  const hostelStudents = useMemo(() => {
    return students.filter(s => !selectedHostel || s.hostelName === selectedHostel);
  }, [students, selectedHostel]);

  // Live Counts for the Selected Meal & Date
  const mealSummaryCounts = useMemo(() => {
    let present = 0;
    let absent = 0;
    let leave = 0;
    let unmarked = 0;

    hostelStudents.forEach(student => {
      const status = getMealStatusForStudent(student.id, student.rollNumber, selectedMeal, selectedDate);
      if (status === 'present') {
        present++;
      } else if (status === 'absent') {
        absent++;
      } else if (status === 'leave') {
        leave++;
      } else {
        unmarked++;
      }
    });

    return {
      total: hostelStudents.length,
      present,
      absent,
      leave,
      unmarked
    };
  }, [hostelStudents, attendance, selectedMeal, selectedDate]);

  // Filtered student list based on Search, Status Filter, and Room Filter
  const filteredStudents = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();

    return hostelStudents.filter(student => {
      // 1. Room filter
      if (selectedRoom !== 'all' && student.roomNumber !== selectedRoom) {
        return false;
      }

      // 2. Status filter
      const currentStatus = getMealStatusForStudent(student.id, student.rollNumber, selectedMeal, selectedDate);
      if (statusFilter === 'unmarked' && currentStatus !== null) {
        return false;
      }
      if (statusFilter === 'present' && currentStatus !== 'present') {
        return false;
      }
      if (statusFilter === 'absent' && currentStatus !== 'absent') {
        return false;
      }

      // 3. Search query (supports Name, Roll Number, Room Number, QR Code/ID)
      if (term) {
        const matchesName = student.name.toLowerCase().includes(term);
        const matchesRoll = student.rollNumber.toLowerCase().includes(term);
        const matchesRoom = (student.roomNumber || '').toLowerCase().includes(term);
        const matchesBed = (student.bedNumber || '').toLowerCase().includes(term);
        const matchesQR = ((student as any).qrCode || (student as any).qrId || '').toLowerCase().includes(term);

        if (!matchesName && !matchesRoll && !matchesRoom && !matchesBed && !matchesQR) {
          return false;
        }
      }

      return true;
    });
  }, [hostelStudents, attendance, selectedMeal, selectedDate, searchTerm, statusFilter, selectedRoom]);

  // Rapid One-Click Status Update Handler
  const handleQuickMark = async (
    student: Student, 
    targetStatus: 'present' | 'absent', 
    reasonOverride?: string
  ) => {
    const actionKey = `${student.id}_${selectedMeal}_${targetStatus}`;
    setLoadingActionId(actionKey);

    const mealLabel = selectedMeal === 'lunch' ? 'Lunch' : 'Dinner';
    const reason = reasonOverride || 'Manual correction — QR/scan unavailable';

    try {
      await onRecordAttendance(
        student.id,
        selectedMeal,
        targetStatus,
        'manual',
        reason,
        selectedDate
      );

      // Show small toast confirmation
      const toastId = Date.now();
      const statusWord = targetStatus === 'present' ? 'Present' : 'Absent';
      setToastFeedback({
        id: toastId,
        message: `✓ ${mealLabel} marked ${statusWord} for ${student.name} (${student.rollNumber})`,
        type: 'success'
      });

      // Clear popover if opened for this student
      if (editingReasonStudentId === student.id) {
        setEditingReasonStudentId(null);
        setCustomReasonText('');
      }

      // Auto dismiss toast after 3.5 seconds
      setTimeout(() => {
        setToastFeedback(prev => (prev?.id === toastId ? null : prev));
      }, 3500);

    } catch (err: any) {
      console.error('Error in manual meal attendance update:', err);
      const isPermission = err?.message?.includes('permission-denied') || err?.code === 'permission-denied';
      setToastFeedback({
        id: Date.now(),
        message: isPermission
          ? 'Permission denied. Please verify your hostel assignment.'
          : (err?.message || 'Unable to update attendance. Please try again.'),
        type: 'error'
      });
    } finally {
      setLoadingActionId(null);
    }
  };

  // Format Display Date nicely (e.g. "24 Aug 2026")
  const formattedDisplayDate = useMemo(() => {
    if (!selectedDate) return '';
    try {
      const [y, m, d] = selectedDate.split('-').map(Number);
      const dateObj = new Date(y, m - 1, d);
      return dateObj.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
    } catch {
      return selectedDate;
    }
  }, [selectedDate]);

  return (
    <div className="space-y-5 max-w-7xl mx-auto animate-fade-in pb-12">
      {/* 1. Header & Meal Control Bar */}
      <div className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-5 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-slate-100 border border-slate-200 text-slate-700 flex items-center justify-center shadow-2xs">
              <ClipboardCheck className="w-4 h-4" />
            </div>
            <div>
              <h1 className="text-lg sm:text-xl font-extrabold text-slate-900 tracking-tight">
                Manual Meal Register
              </h1>
              <p className="text-xs text-slate-500 font-medium">
                Quickly mark meal attendance when a QR scan is unavailable.
              </p>
            </div>
          </div>
        </div>

        {/* Date, Hostel & Meal Controls */}
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Hostel Selector (if multiple available) */}
          {hostels.length > 1 && (
            <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1.5 text-xs">
              <Building2 className="w-3.5 h-3.5 text-slate-500 shrink-0" />
              <select
                id="manual_register_hostel_select"
                value={selectedHostel}
                onChange={(e) => setSelectedHostel(e.target.value)}
                className="bg-transparent text-xs font-bold text-slate-800 outline-none cursor-pointer max-w-[150px] truncate"
              >
                {hostels.map((h, i) => (
                  <option key={h.id || `h-${i}`} value={h.name}>{h.name}</option>
                ))}
              </select>
            </div>
          )}

          {/* Date Picker */}
          <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 text-xs shadow-2xs">
            <Calendar className="w-3.5 h-3.5 text-slate-500 shrink-0" />
            <input 
              id="manual_register_date_picker"
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="bg-transparent text-xs font-bold text-slate-900 outline-none cursor-pointer"
            />
          </div>

          {/* Meal Selector Tabs: Lunch vs Dinner (Neutral Light Selected Style) */}
          <div className="flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200" id="manual_register_meal_selector">
            <button
              id="btn_select_lunch"
              type="button"
              onClick={() => setSelectedMeal('lunch')}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                selectedMeal === 'lunch'
                  ? 'bg-white text-slate-900 shadow-xs border border-slate-200'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
              }`}
            >
              <Sun className="w-3.5 h-3.5 text-slate-600" />
              <span>LUNCH</span>
            </button>

            <button
              id="btn_select_dinner"
              type="button"
              onClick={() => setSelectedMeal('dinner')}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                selectedMeal === 'dinner'
                  ? 'bg-white text-slate-900 shadow-xs border border-slate-200'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
              }`}
            >
              <Moon className="w-3.5 h-3.5 text-slate-600" />
              <span>DINNER</span>
            </button>
          </div>
        </div>
      </div>

      {/* 2. Live Daily Count Summary Bar (All Light Neutral Cards) */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {/* Total Card */}
        <div className="bg-white border border-slate-200 rounded-xl p-3 shadow-2xs">
          <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">Total Residents</span>
          <div className="flex items-baseline justify-between mt-1">
            <span className="text-xl font-extrabold text-slate-900 font-mono">
              {mealSummaryCounts.total}
            </span>
            <span className="text-[10px] font-semibold text-slate-400">
              {selectedHostel ? selectedHostel.split(' ')[0] : 'All'}
            </span>
          </div>
        </div>

        {/* Present Card - Light Neutral */}
        <div className="bg-white border border-slate-200 rounded-xl p-3 shadow-2xs">
          <span className="text-[11px] font-bold text-slate-600 uppercase tracking-wider block">Present ({selectedMeal === 'lunch' ? 'Lunch' : 'Dinner'})</span>
          <div className="flex items-baseline justify-between mt-1">
            <span className="text-xl font-extrabold text-slate-900 font-mono">
              {mealSummaryCounts.present}
            </span>
            <span className="text-[10px] font-semibold text-slate-500">
              {mealSummaryCounts.total > 0 ? Math.round((mealSummaryCounts.present / mealSummaryCounts.total) * 100) : 0}%
            </span>
          </div>
        </div>

        {/* Absent Card - Light Neutral */}
        <div className="bg-white border border-slate-200 rounded-xl p-3 shadow-2xs">
          <span className="text-[11px] font-bold text-slate-600 uppercase tracking-wider block">Absent</span>
          <div className="flex items-baseline justify-between mt-1">
            <span className="text-xl font-extrabold text-slate-900 font-mono">
              {mealSummaryCounts.absent}
            </span>
            <span className="text-[10px] font-semibold text-slate-500">
              {mealSummaryCounts.total > 0 ? Math.round((mealSummaryCounts.absent / mealSummaryCounts.total) * 100) : 0}%
            </span>
          </div>
        </div>

        {/* Not Marked Card - Light Neutral */}
        <div className="bg-white border border-slate-200 rounded-xl p-3 shadow-2xs">
          <span className="text-[11px] font-bold text-slate-600 uppercase tracking-wider block">Not Marked</span>
          <div className="flex items-baseline justify-between mt-1">
            <span className="text-xl font-extrabold text-slate-700 font-mono">
              {mealSummaryCounts.unmarked}
            </span>
            <span className="text-[10px] font-semibold text-slate-500">
              Pending
            </span>
          </div>
        </div>
      </div>

      {/* Instant Notification / Feedback Toast (Light Neutral) */}
      {toastFeedback && (
        <div 
          id="register_action_toast"
          className="px-4 py-2.5 rounded-xl border border-slate-300 bg-white text-slate-900 flex items-center justify-between gap-3 text-xs font-bold transition-all shadow-sm animate-fade-in"
        >
          <div className="flex items-center gap-2">
            {toastFeedback.type === 'success' ? (
              <Check className="w-4 h-4 shrink-0 text-slate-700" />
            ) : (
              <AlertCircle className="w-4 h-4 shrink-0 text-slate-700" />
            )}
            <span>{toastFeedback.message}</span>
          </div>
          <button 
            onClick={() => setToastFeedback(null)}
            className="text-slate-400 hover:text-slate-700 cursor-pointer p-0.5"
            aria-label="Dismiss toast"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* 3. Search & Filters Bar */}
      <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs space-y-3">
        <div className="flex flex-col md:flex-row items-stretch md:items-center gap-3">
          {/* Large Search Field */}
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3 pointer-events-none" />
            <input
              id="manual_register_search_input"
              type="text"
              placeholder="Search by student name, roll number, room or bed..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-10 pr-9 py-2 text-sm text-slate-900 font-medium placeholder:text-slate-400 outline-none focus:ring-2 focus:ring-slate-300 focus:bg-white transition"
            />
            {searchTerm && (
              <button 
                onClick={() => setSearchTerm('')}
                className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600 cursor-pointer p-0.5"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Room Organization Filter */}
          <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5">
            <Filter className="w-3.5 h-3.5 text-slate-500 shrink-0" />
            <label className="text-xs font-bold text-slate-600 whitespace-nowrap">Room:</label>
            <select
              id="manual_register_room_filter"
              value={selectedRoom}
              onChange={(e) => setSelectedRoom(e.target.value)}
              className="bg-transparent text-xs font-bold text-slate-900 outline-none cursor-pointer"
            >
              <option value="all">All Rooms ({availableRooms.length})</option>
              {availableRooms.map(room => (
                <option key={room} value={room}>Room {room}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Quick Status Filter Tabs - Neutral Light Style */}
        <div className="flex flex-wrap items-center gap-1.5 pt-1 border-t border-slate-100">
          <button
            id="filter_status_all"
            type="button"
            onClick={() => setStatusFilter('all')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer flex items-center gap-1.5 ${
              statusFilter === 'all'
                ? 'bg-white text-slate-900 border border-slate-300 shadow-2xs'
                : 'bg-slate-50 text-slate-600 border border-slate-200 hover:bg-slate-100'
            }`}
          >
            <span>All Residents</span>
            <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono ${statusFilter === 'all' ? 'bg-slate-200 text-slate-800' : 'bg-slate-200/70 text-slate-600'}`}>
              {hostelStudents.length}
            </span>
          </button>

          <button
            id="filter_status_unmarked"
            type="button"
            onClick={() => setStatusFilter('unmarked')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer flex items-center gap-1.5 ${
              statusFilter === 'unmarked'
                ? 'bg-white text-slate-900 border border-slate-300 shadow-2xs'
                : 'bg-slate-50 text-slate-600 border border-slate-200 hover:bg-slate-100'
            }`}
          >
            <span>○ Not Marked</span>
            <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono ${statusFilter === 'unmarked' ? 'bg-slate-200 text-slate-800' : 'bg-slate-200/70 text-slate-600'}`}>
              {mealSummaryCounts.unmarked}
            </span>
          </button>

          <button
            id="filter_status_present"
            type="button"
            onClick={() => setStatusFilter('present')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer flex items-center gap-1.5 ${
              statusFilter === 'present'
                ? 'bg-white text-slate-900 border border-slate-300 shadow-2xs'
                : 'bg-slate-50 text-slate-600 border border-slate-200 hover:bg-slate-100'
            }`}
          >
            <span>Present</span>
            <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono ${statusFilter === 'present' ? 'bg-slate-200 text-slate-800' : 'bg-slate-200/70 text-slate-600'}`}>
              {mealSummaryCounts.present}
            </span>
          </button>

          <button
            id="filter_status_absent"
            type="button"
            onClick={() => setStatusFilter('absent')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer flex items-center gap-1.5 ${
              statusFilter === 'absent'
                ? 'bg-white text-slate-900 border border-slate-300 shadow-2xs'
                : 'bg-slate-50 text-slate-600 border border-slate-200 hover:bg-slate-100'
            }`}
          >
            <span>Absent</span>
            <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono ${statusFilter === 'absent' ? 'bg-slate-200 text-slate-800' : 'bg-slate-200/70 text-slate-600'}`}>
              {mealSummaryCounts.absent}
            </span>
          </button>

          {/* Active View Indicator */}
          <div className="ml-auto text-[11px] font-semibold text-slate-500 hidden sm:block">
            Showing <strong className="text-slate-800">{filteredStudents.length}</strong> of <strong className="text-slate-800">{hostelStudents.length}</strong> students for <strong className="text-slate-800 capitalize">{selectedMeal} ({formattedDisplayDate})</strong>
          </div>
        </div>
      </div>

      {/* 4. DIGITAL MANUAL MEAL REGISTER TABLE (Desktop & Tablet) */}
      <div className="bg-white border border-slate-200 rounded-2xl shadow-xs overflow-hidden">
        {/* Table View (sm and up) */}
        <div className="hidden sm:block overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse" id="manual_meal_register_table">
            <thead>
              <tr className="border-b border-slate-200 text-slate-500 uppercase font-extrabold text-[10px] tracking-wider bg-slate-50">
                <th className="py-3 px-4 w-[28%]">Student</th>
                <th className="py-3 px-4 w-[20%]">Roll Number</th>
                <th className="py-3 px-4 w-[20%]">Room / Bed</th>
                <th className="py-3 px-4 w-[16%] text-center uppercase">
                  {selectedMeal} Status
                </th>
                <th className="py-3 px-4 w-[16%] text-right pr-6">Quick Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredStudents.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-14 text-center text-slate-400 font-medium">
                    <div className="max-w-xs mx-auto space-y-1">
                      <p className="text-sm font-bold text-slate-700">No resident records found</p>
                      <p className="text-xs text-slate-500">
                        {searchTerm ? `No results matching "${searchTerm}"` : 'Try changing your status or room filters.'}
                      </p>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredStudents.map((student) => {
                  const currentMealStatus = getMealStatusForStudent(
                    student.id, 
                    student.rollNumber, 
                    selectedMeal, 
                    selectedDate
                  );

                  const isPresent = currentMealStatus === 'present';
                  const isAbsent = currentMealStatus === 'absent';
                  const isLeave = currentMealStatus === 'leave';
                  const isUnmarked = currentMealStatus === null;

                  const isRowLoadingPresent = loadingActionId === `${student.id}_${selectedMeal}_present`;
                  const isRowLoadingAbsent = loadingActionId === `${student.id}_${selectedMeal}_absent`;

                  return (
                    <tr 
                      key={student.id} 
                      className="hover:bg-slate-50/80 transition-colors"
                    >
                      {/* Column 1: Student Name & Department */}
                      <td className="py-3.5 px-4">
                        <div className="font-extrabold text-slate-900 text-sm">
                          {student.name}
                        </div>
                        <div className="text-[11px] text-slate-500 font-medium">
                          {student.department || 'General Resident'}
                        </div>
                      </td>

                      {/* Column 2: Roll Number (High Contrast Mono Badge) */}
                      <td className="py-3.5 px-4">
                        <span className="inline-block font-mono font-bold text-xs bg-slate-100 text-slate-800 px-2 py-0.5 rounded-md border border-slate-200">
                          {student.rollNumber}
                        </span>
                      </td>

                      {/* Column 3: Room / Bed */}
                      <td className="py-3.5 px-4 text-slate-700 font-medium text-xs">
                        <div className="flex items-center gap-1.5">
                          <span className="font-bold text-slate-900">Room {student.roomNumber || '—'}</span>
                          {student.bedNumber && (
                            <span className="text-slate-400">• Bed {student.bedNumber}</span>
                          )}
                        </div>
                      </td>

                      {/* Column 4: Current Status for Selected Meal (Neutral Styling) */}
                      <td className="py-3.5 px-4 text-center">
                        {isPresent && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-slate-100 text-slate-800 border border-slate-300 shadow-2xs">
                            <Check className="w-3.5 h-3.5 text-slate-700 stroke-[2.5]" />
                            <span>Present</span>
                          </span>
                        )}
                        {isAbsent && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-slate-100 text-slate-800 border border-slate-300 shadow-2xs">
                            <X className="w-3.5 h-3.5 text-slate-700 stroke-[2.5]" />
                            <span>Absent</span>
                          </span>
                        )}
                        {isLeave && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-slate-100 text-slate-700 border border-slate-300 shadow-2xs">
                            <span>Leave</span>
                          </span>
                        )}
                        {isUnmarked && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-bold bg-slate-50 text-slate-500 border border-slate-200">
                            <span>○ Not Marked</span>
                          </span>
                        )}
                      </td>

                      {/* Column 5: 1-Click Action Buttons (Light Neutral Styling) */}
                      <td className="py-3.5 px-4 text-right pr-6">
                        <div className="inline-flex items-center gap-2 justify-end">
                          {/* Present Button - Light Neutral */}
                          <button
                            id={`btn_mark_present_${student.id}`}
                            type="button"
                            onClick={() => handleQuickMark(student, 'present')}
                            disabled={isRowLoadingPresent || isRowLoadingAbsent}
                            title={`Mark ${student.name} Present for ${selectedMeal}`}
                            className={`px-3 py-1.5 rounded-xl font-bold text-xs transition cursor-pointer flex items-center gap-1.5 shadow-2xs ${
                              isPresent
                                ? 'bg-slate-100 text-slate-900 border border-slate-400 font-bold ring-1 ring-slate-300'
                                : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 active:bg-slate-100'
                            }`}
                          >
                            {isRowLoadingPresent ? (
                              <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            ) : (
                              <Check className="w-3.5 h-3.5 stroke-[2]" />
                            )}
                            <span>Present</span>
                          </button>

                          {/* Absent Button - Light Neutral */}
                          <button
                            id={`btn_mark_absent_${student.id}`}
                            type="button"
                            onClick={() => handleQuickMark(student, 'absent')}
                            disabled={isRowLoadingPresent || isRowLoadingAbsent}
                            title={`Mark ${student.name} Absent for ${selectedMeal}`}
                            className={`px-3 py-1.5 rounded-xl font-bold text-xs transition cursor-pointer flex items-center gap-1.5 shadow-2xs ${
                              isAbsent
                                ? 'bg-slate-100 text-slate-900 border border-slate-400 font-bold ring-1 ring-slate-300'
                                : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 active:bg-slate-100'
                            }`}
                          >
                            {isRowLoadingAbsent ? (
                              <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            ) : (
                              <X className="w-3.5 h-3.5 stroke-[2]" />
                            )}
                            <span>Absent</span>
                          </button>

                          {/* Optional Reason / Note Action */}
                          <div className="relative inline-block">
                            <button
                              id={`btn_reason_toggle_${student.id}`}
                              type="button"
                              onClick={() => {
                                if (editingReasonStudentId === student.id) {
                                  setEditingReasonStudentId(null);
                                } else {
                                  setEditingReasonStudentId(student.id);
                                  setCustomReasonText('');
                                }
                              }}
                              title="Add custom correction note"
                              className="p-1.5 rounded-lg border border-slate-200 text-slate-400 hover:text-slate-700 hover:bg-slate-100 cursor-pointer"
                            >
                              <MessageSquare className="w-3.5 h-3.5" />
                            </button>

                            {/* Small Popover for Custom Reason */}
                            {editingReasonStudentId === student.id && (
                              <div className="absolute right-0 top-full mt-1.5 w-64 bg-white border border-slate-200 rounded-xl shadow-lg p-3 z-30 space-y-2 text-left animate-fade-in">
                                <div className="flex items-center justify-between">
                                  <span className="text-[11px] font-extrabold text-slate-800">Custom Reason</span>
                                  <button 
                                    onClick={() => setEditingReasonStudentId(null)}
                                    className="text-slate-400 hover:text-slate-600 p-0.5"
                                  >
                                    <X className="w-3 h-3" />
                                  </button>
                                </div>
                                <input
                                  type="text"
                                  placeholder="e.g. Physical token verified, scanner offline..."
                                  value={customReasonText}
                                  onChange={(e) => setCustomReasonText(e.target.value)}
                                  className="w-full text-xs bg-slate-50 border border-slate-200 rounded-lg p-1.5 text-slate-800 outline-none focus:ring-1 focus:ring-slate-400"
                                />
                                <div className="flex items-center justify-end gap-1.5 pt-1">
                                  <button
                                    type="button"
                                    onClick={() => handleQuickMark(student, 'present', customReasonText.trim())}
                                    className="px-2.5 py-1 bg-white border border-slate-300 text-slate-900 text-[10px] font-bold rounded-md hover:bg-slate-50 cursor-pointer shadow-2xs"
                                  >
                                    Save as Present
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleQuickMark(student, 'absent', customReasonText.trim())}
                                    className="px-2.5 py-1 bg-slate-100 border border-slate-200 text-slate-700 text-[10px] font-bold rounded-md hover:bg-slate-200 cursor-pointer"
                                  >
                                    Save as Absent
                                  </button>
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Mobile Cards View (Hidden on desktop) */}
        <div className="sm:hidden divide-y divide-slate-100">
          {filteredStudents.length === 0 ? (
            <div className="py-10 px-4 text-center text-slate-400">
              <p className="text-sm font-bold text-slate-700">No resident records found</p>
              <p className="text-xs text-slate-500 mt-1">Try changing your search or filter options.</p>
            </div>
          ) : (
            filteredStudents.map((student) => {
              const currentMealStatus = getMealStatusForStudent(
                student.id, 
                student.rollNumber, 
                selectedMeal, 
                selectedDate
              );

              const isPresent = currentMealStatus === 'present';
              const isAbsent = currentMealStatus === 'absent';
              const isLeave = currentMealStatus === 'leave';

              const isRowLoadingPresent = loadingActionId === `${student.id}_${selectedMeal}_present`;
              const isRowLoadingAbsent = loadingActionId === `${student.id}_${selectedMeal}_absent`;

              return (
                <div key={student.id} className="p-4 space-y-3">
                  {/* Top info row */}
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h3 className="font-extrabold text-slate-900 text-sm">{student.name}</h3>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="font-mono font-bold text-[11px] bg-slate-100 text-slate-800 px-1.5 py-0.2 rounded border border-slate-200">
                          {student.rollNumber}
                        </span>
                        <span className="text-xs font-semibold text-slate-600">
                          Room {student.roomNumber || '—'} • Bed {student.bedNumber || '—'}
                        </span>
                      </div>
                    </div>

                    {/* Status Badge - Light Neutral */}
                    <div>
                      {isPresent && (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-800 border border-slate-300">
                          Present
                        </span>
                      )}
                      {isAbsent && (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-800 border border-slate-300">
                          Absent
                        </span>
                      )}
                      {isLeave && (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-700 border border-slate-300">
                          Leave
                        </span>
                      )}
                      {!isPresent && !isAbsent && !isLeave && (
                        <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-slate-50 text-slate-500 border border-slate-200">
                          ○ Not Marked
                        </span>
                      )}
                    </div>
                  </div>

                  {/* 1-Click Action Buttons for Mobile (Light Neutral Style, min 44px) */}
                  <div className="grid grid-cols-2 gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => handleQuickMark(student, 'present')}
                      disabled={isRowLoadingPresent || isRowLoadingAbsent}
                      className={`min-h-[44px] rounded-xl font-bold text-xs transition cursor-pointer flex items-center justify-center gap-1.5 shadow-2xs ${
                        isPresent
                          ? 'bg-slate-100 text-slate-900 border border-slate-400 font-bold ring-1 ring-slate-300'
                          : 'bg-white text-slate-700 border border-slate-200 active:bg-slate-100'
                      }`}
                    >
                      {isRowLoadingPresent ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Check className="w-4 h-4 stroke-[2]" />
                      )}
                      <span>Present</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleQuickMark(student, 'absent')}
                      disabled={isRowLoadingPresent || isRowLoadingAbsent}
                      className={`min-h-[44px] rounded-xl font-bold text-xs transition cursor-pointer flex items-center justify-center gap-1.5 shadow-2xs ${
                        isAbsent
                          ? 'bg-slate-100 text-slate-900 border border-slate-400 font-bold ring-1 ring-slate-300'
                          : 'bg-white text-slate-700 border border-slate-200 active:bg-slate-100'
                      }`}
                    >
                      {isRowLoadingAbsent ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <X className="w-4 h-4 stroke-[2]" />
                      )}
                      <span>Absent</span>
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
