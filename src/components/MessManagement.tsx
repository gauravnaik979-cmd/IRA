import React, { useState } from 'react';
import { MonthlyBill, MealRates, Student, Attendance } from '../types';
import { 
  DollarSign, Check, X, RefreshCw, Search, Calculator, CheckCircle2, ChevronRight, 
  HelpCircle, History, Trash2, Edit, RotateCcw, AlertTriangle, Calendar, Clock, Utensils, UserCheck
} from 'lucide-react';

interface MessManagementProps {
  bills: MonthlyBill[];
  mealRates: MealRates;
  students?: Student[];
  attendance?: Attendance[];
  onUpdateRates: (rates: MealRates) => void;
  onRecalculateAll: (month: string) => void;
  onMarkPaid: (billId: string, status: 'paid' | 'unpaid') => void;
  onDeleteAttendance?: (attendanceId: string, reason?: string) => Promise<void>;
  onRecordAttendance?: (
    studentId: string, 
    type: 'hostel' | 'lunch' | 'dinner', 
    status: 'present' | 'absent' | 'leave', 
    recordedBy: 'scanner' | 'manual',
    notes?: string
  ) => Promise<any>;
}

export default function MessManagement({
  bills,
  mealRates,
  students = [],
  attendance = [],
  onUpdateRates,
  onRecalculateAll,
  onMarkPaid,
  onDeleteAttendance,
  onRecordAttendance
}: MessManagementProps) {
  
  // Rate edit states
  const [lunchPrice, setLunchPrice] = useState(mealRates.lunchPrice);
  const [dinnerPrice, setDinnerPrice] = useState(mealRates.dinnerPrice);
  const [ratesSuccess, setRatesSuccess] = useState(false);

  // Bill search state
  const currentMonthStr = new Date().toISOString().substring(0, 7);
  const [billSearch, setBillSearch] = useState('');
  const [monthFilter, setMonthFilter] = useState(currentMonthStr);
  const [recalcSuccess, setRecalcSuccess] = useState(false);

  // Feedback Notification Toast
  const [feedbackToast, setFeedbackToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  // Dialog 1: View Attendance History
  const [historyStudent, setHistoryStudent] = useState<Student | null>(null);

  // Dialog 2: Delete Scan Confirmation
  const [deleteRecord, setDeleteRecord] = useState<Attendance | null>(null);
  const [deleteReason, setDeleteReason] = useState<string>('Superintendent correction');
  const [isDeleting, setIsDeleting] = useState<boolean>(false);

  // Dialog 3: Edit / Add Attendance
  const [editStudent, setEditStudent] = useState<Student | null>(null);
  const [editType, setEditType] = useState<'lunch' | 'dinner' | 'hostel'>('lunch');
  const [editDate, setEditDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [editStatus, setEditStatus] = useState<'present' | 'absent' | 'leave'>('present');
  const [editNotes, setEditNotes] = useState<string>('');
  const [isSavingEdit, setIsSavingEdit] = useState<boolean>(false);

  const handleRatesSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onUpdateRates({ lunchPrice, dinnerPrice });
    setRatesSuccess(true);
    setTimeout(() => setRatesSuccess(false), 3000);
  };

  const handleRecalculateTrigger = () => {
    onRecalculateAll(monthFilter);
    setRecalcSuccess(true);
    setTimeout(() => setRecalcSuccess(false), 3000);
  };

  const filteredBills = bills.filter(b => {
    const matchesSearch = 
      b.studentName.toLowerCase().includes(billSearch.toLowerCase()) ||
      b.rollNumber.toLowerCase().includes(billSearch.toLowerCase()) ||
      b.roomNumber.includes(billSearch);
    
    const matchesMonth = b.month === monthFilter;

    return matchesSearch && matchesMonth;
  });

  // Helper to fetch student scan history sorted by date/time desc
  const getStudentScanHistory = (studentId: string, rollNumber: string): Attendance[] => {
    return (attendance || []).filter(a => 
      a.studentId === studentId || 
      (a.rollNumber && a.rollNumber.trim().toUpperCase() === rollNumber.trim().toUpperCase())
    ).sort((a, b) => {
      const dComp = (b.date || '').localeCompare(a.date || '');
      if (dComp !== 0) return dComp;
      return (b.time || '').localeCompare(a.time || '');
    });
  };

  // Requirement 2: Remove Last Scan handler
  const handleRemoveLastScan = (studentId: string, rollNumber: string, studentName: string) => {
    const history = getStudentScanHistory(studentId, rollNumber);
    if (history.length === 0) {
      setFeedbackToast({
        message: `No attendance scan records found for ${studentName}.`,
        type: 'error'
      });
      setTimeout(() => setFeedbackToast(null), 3500);
      return;
    }
    const lastScan = history[0];
    setDeleteRecord(lastScan);
    setDeleteReason('Remove Last Scan correction');
  };

  // Requirement 4: Delete Attendance handler with audit logging & bill recalculation
  const confirmDeleteScan = async () => {
    if (!deleteRecord || !onDeleteAttendance) return;
    setIsDeleting(true);
    try {
      await onDeleteAttendance(deleteRecord.id, deleteReason || 'Superintendent correction');
      setFeedbackToast({
        message: `Attendance record deleted successfully. Monthly bill & meal count updated.`,
        type: 'success'
      });
      setDeleteRecord(null);
      setDeleteReason('Superintendent correction');
    } catch (err: any) {
      console.error('Failed to delete attendance record:', err);
      setFeedbackToast({
        message: err.message || 'Failed to delete attendance record.',
        type: 'error'
      });
    } finally {
      setIsDeleting(false);
      setTimeout(() => setFeedbackToast(null), 4000);
    }
  };

  // Edit Attendance Submit handler
  const handleSaveEditAttendance = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editStudent || !onRecordAttendance) return;
    setIsSavingEdit(true);
    try {
      await onRecordAttendance(
        editStudent.id,
        editType,
        editStatus,
        'manual',
        editNotes || `Superintendent manual edit for ${editDate}`
      );
      setFeedbackToast({
        message: `Attendance record for ${editStudent.name} (${editType.toUpperCase()}) saved successfully. Bill recomputed.`,
        type: 'success'
      });
      setEditStudent(null);
      setEditNotes('');
    } catch (err: any) {
      console.error('Failed to save attendance edit:', err);
      setFeedbackToast({
        message: err.message || 'Failed to save attendance entry.',
        type: 'error'
      });
    } finally {
      setIsSavingEdit(false);
      setTimeout(() => setFeedbackToast(null), 4000);
    }
  };

  return (
    <div className="space-y-6 animate-fade-in relative">
      
      {/* Toast Notification Banner */}
      {feedbackToast && (
        <div className={`fixed top-5 right-5 z-50 px-4 py-3 rounded-2xl shadow-xl border flex items-center gap-3 text-xs font-bold animate-bounce ${
          feedbackToast.type === 'success' 
            ? 'bg-emerald-900 text-white border-emerald-500 shadow-emerald-950/20' 
            : 'bg-rose-900 text-white border-rose-500 shadow-rose-950/20'
        }`}>
          {feedbackToast.type === 'success' ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          ) : (
            <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
          )}
          <span>{feedbackToast.message}</span>
          <button onClick={() => setFeedbackToast(null)} className="ml-2 hover:opacity-80">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Rate Config & Engine triggers */}
        <div className="space-y-6">
          {/* Price edit form */}
          <div className="bg-white border border-gray-100 rounded-2xl shadow-sm p-6 space-y-4">
            <div className="border-b border-gray-50 pb-3">
              <h3 className="font-bold text-gray-900 text-sm flex items-center gap-2">
                <DollarSign className="w-4 h-4 text-slate-800" /> Meal Rate Protocols
              </h3>
              <p className="text-xs text-gray-500">Configure standard pricing per meal</p>
            </div>

            <form onSubmit={handleRatesSubmit} className="space-y-4 text-xs">
              <div className="space-y-1">
                <label className="text-[10px] text-gray-400 uppercase font-bold">Standard Lunch Tariff (₹)</label>
                <input 
                  id="lunch_price_input"
                  type="number" 
                  required
                  value={lunchPrice}
                  onChange={(e) => setLunchPrice(Number(e.target.value))}
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2.5 outline-none focus:border-slate-800 font-bold transition"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] text-gray-400 uppercase font-bold">Standard Dinner Tariff (₹)</label>
                <input 
                  id="dinner_price_input"
                  type="number" 
                  required
                  value={dinnerPrice}
                  onChange={(e) => setDinnerPrice(Number(e.target.value))}
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2.5 outline-none focus:border-slate-800 font-bold transition"
                />
              </div>

              <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 flex justify-between font-bold text-slate-850 text-xs font-mono">
                <span>Combined Daily Tariff:</span>
                <span>₹{lunchPrice + dinnerPrice} / Day</span>
              </div>

              {ratesSuccess && (
                <div className="bg-emerald-50 text-emerald-800 p-2 rounded-xl border border-emerald-100 flex items-center gap-1.5 font-medium animate-pulse">
                  <Check className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>Tariffs successfully modified in database!</span>
                </div>
              )}

              <button 
                id="update_rates_submit"
                type="submit"
                className="w-full bg-slate-900 hover:bg-slate-850 text-white py-2 rounded-xl font-semibold cursor-pointer transition shadow-xs"
              >
                Update Meal Prices
              </button>
            </form>
          </div>

          {/* Recalculate billing panel */}
          <div className="bg-white border border-gray-100 rounded-2xl shadow-sm p-6 space-y-4">
            <div className="border-b border-gray-50 pb-3">
              <h3 className="font-bold text-gray-900 text-sm flex items-center gap-2">
                <Calculator className="w-4 h-4 text-slate-800" /> Automated Bill Evaluator
              </h3>
              <p className="text-xs text-gray-500">Recalculate complete college mess logs</p>
            </div>

            <div className="space-y-4 text-xs">
              <div className="space-y-1">
                <label className="text-[10px] text-gray-400 uppercase font-bold">Select Billing Cycle Month</label>
                <select 
                  id="billing_cycle_month"
                  value={monthFilter}
                  onChange={(e) => setMonthFilter(e.target.value)}
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 outline-none focus:border-slate-800 transition font-medium cursor-pointer"
                >
                  {Array.from(new Set([currentMonthStr, '2026-08', '2026-07', '2026-06', ...bills.map(b => b.month)])).sort().reverse().map(m => (
                    <option key={m} value={m}>
                      {m === currentMonthStr ? `${m} (Current Month)` : m}
                    </option>
                  ))}
                </select>
              </div>

              {recalcSuccess && (
                <div className="bg-emerald-50 text-emerald-800 p-2 rounded-xl border border-emerald-100 flex items-center gap-1.5 font-medium animate-pulse">
                  <Check className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>All student accounts recalculated successfully!</span>
                </div>
              )}

              <button 
                id="recalculate_all_bills_trigger"
                onClick={handleRecalculateTrigger}
                className="w-full bg-gray-50 hover:bg-gray-100 border border-gray-200 text-gray-700 py-2 rounded-xl font-semibold cursor-pointer transition flex items-center justify-center gap-2"
              >
                <RefreshCw className="w-3.5 h-3.5" /> Recompute Month Accounts
              </button>
            </div>
          </div>
        </div>

        {/* Monthly Bills List Table */}
        <div className="lg:col-span-2 space-y-4">
          {/* Filters and search */}
          <div className="bg-white border border-gray-100 p-4 rounded-2xl shadow-sm flex flex-col md:flex-row gap-3">
            <div className="relative flex-1 text-xs">
              <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input 
                id="bill_search_input"
                type="text"
                placeholder="Search bills by Student Name, Roll Number or Room..."
                value={billSearch}
                onChange={(e) => setBillSearch(e.target.value)}
                className="w-full bg-gray-50 border border-gray-200 rounded-xl pl-9 pr-3 py-2 outline-none focus:border-slate-800 text-xs transition"
              />
            </div>
          </div>

          {/* Bills list */}
          <div className="bg-white border border-gray-100 rounded-2xl shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100 bg-gray-50/50 flex items-center justify-between">
              <h3 className="font-bold text-gray-900 text-sm">Monthly Mess Ledger ({monthFilter})</h3>
              <span className="text-[10px] bg-slate-900 text-white font-mono px-2 py-0.5 rounded-full font-bold">
                {filteredBills.length} Accounts
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-gray-100 text-gray-400 uppercase font-bold tracking-wider">
                    <th className="py-2.5 px-4">Student details</th>
                    <th className="py-2.5 px-3 text-center">Lunch</th>
                    <th className="py-2.5 px-3 text-center">Dinner</th>
                    <th className="py-2.5 px-3 text-center">Leaves</th>
                    <th className="py-2.5 px-4">Total Amount</th>
                    <th className="py-2.5 px-4 text-center">Status</th>
                    {/* Requirement 1: Add Action column */}
                    <th className="py-2.5 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {filteredBills.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-8 text-center text-gray-400 font-medium">
                        No billing receipts found matching search.
                      </td>
                    </tr>
                  ) : (
                    filteredBills.map((b, i) => {
                      const matchedStudent = students.find(s => 
                        s.id === b.studentId || 
                        (s.rollNumber && s.rollNumber.trim().toUpperCase() === b.rollNumber.trim().toUpperCase())
                      ) || {
                        id: b.studentId,
                        rollNumber: b.rollNumber,
                        name: b.studentName,
                        department: b.department || 'General',
                        semester: '4th',
                        phone: '',
                        guardianPhone: '',
                        hostelName: b.hostelName || '',
                        roomNumber: b.roomNumber,
                        bedNumber: 'A',
                        qrId: `QR-${b.rollNumber}`,
                        messStatus: 'active',
                        hostelStatus: 'present',
                        leaveStatus: 'none',
                        admissionDate: '2024-08-01'
                      } as Student;

                      return (
                        <tr key={b.id || `bill-${b.studentId || b.rollNumber}-${b.month}-${i}`} className="hover:bg-gray-50/50 transition">
                          <td className="py-3 px-4">
                            <div className="flex flex-col">
                              <span className="font-bold text-gray-950 text-xs">{b.studentName}</span>
                              <span className="text-[10px] text-gray-400 font-mono">Rm {b.roomNumber} • {b.rollNumber}</span>
                            </div>
                          </td>
                          <td className="py-3 px-3 text-center font-semibold font-mono text-slate-800">
                            {b.lunchCount}
                          </td>
                          <td className="py-3 px-3 text-center font-semibold font-mono text-slate-800">
                            {b.dinnerCount}
                          </td>
                          <td className="py-3 px-3 text-center font-semibold font-mono text-amber-600">
                            {b.leaveDays} d
                          </td>
                          <td className="py-3 px-4">
                            <span className="font-extrabold text-gray-900 text-sm">₹{b.totalAmount}</span>
                          </td>
                          <td className="py-3 px-4 text-center">
                            <div className="inline-flex items-center gap-1.5">
                              <span className={`px-2 py-0.5 rounded-full text-[9px] uppercase font-bold tracking-wider ${
                                b.status === 'paid' ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' : 'bg-rose-50 text-rose-800 border border-rose-200'
                              }`}>
                                {b.status}
                              </span>
                              <button 
                                id={`toggle_paid_${b.id}`}
                                onClick={() => onMarkPaid(b.id, b.status === 'paid' ? 'unpaid' : 'paid')}
                                className="text-[10px] font-bold text-slate-600 hover:text-slate-950 hover:underline cursor-pointer transition"
                              >
                                Toggle
                              </button>
                            </div>
                          </td>

                          {/* Requirement 2: Each student row must include: View History, Remove Last Scan, Edit Attendance */}
                          <td className="py-3 px-4 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              {/* 1. View Attendance History */}
                              <button 
                                id={`view_history_${b.studentId}`}
                                title="View Attendance History"
                                onClick={() => setHistoryStudent(matchedStudent)}
                                className="p-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-[11px] font-semibold flex items-center gap-1 transition cursor-pointer"
                              >
                                <History className="w-3.5 h-3.5 text-slate-700" />
                                <span className="hidden xl:inline">History</span>
                              </button>

                              {/* 2. Remove Last Scan */}
                              <button 
                                id={`remove_last_scan_${b.studentId}`}
                                title="Remove Last Scan"
                                onClick={() => handleRemoveLastScan(b.studentId, b.rollNumber, b.studentName)}
                                className="p-1.5 bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 rounded-lg text-[11px] font-semibold flex items-center gap-1 transition cursor-pointer"
                              >
                                <RotateCcw className="w-3.5 h-3.5 text-amber-700" />
                                <span className="hidden xl:inline">Undo Scan</span>
                              </button>

                              {/* 3. Edit Attendance */}
                              <button 
                                id={`edit_attendance_${b.studentId}`}
                                title="Edit Attendance"
                                onClick={() => {
                                  setEditStudent(matchedStudent);
                                  setEditType('lunch');
                                  setEditStatus('present');
                                  setEditDate(new Date().toISOString().split('T')[0]);
                                }}
                                className="p-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-[11px] font-semibold flex items-center gap-1 transition cursor-pointer shadow-xs"
                              >
                                <Edit className="w-3.5 h-3.5 text-slate-200" />
                                <span className="hidden xl:inline">Edit</span>
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
      </div>

      {/* Requirement 3: Attendance History Dialog */}
      {historyStudent && (
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center z-50 p-4 animate-fade-in">
          <div className="bg-white rounded-3xl max-w-2xl w-full p-6 shadow-2xl border border-slate-200 space-y-4 max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3 shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-2xl bg-slate-900 text-white flex items-center justify-center font-bold text-sm">
                  <History className="w-4 h-4 text-emerald-400" />
                </div>
                <div>
                  <h4 className="font-extrabold text-slate-900 text-base">
                    Attendance Scan History
                  </h4>
                  <p className="text-xs text-slate-500 font-medium">
                    {historyStudent.name} • Roll: {historyStudent.rollNumber} • Rm {historyStudent.roomNumber}
                  </p>
                </div>
              </div>
              <button 
                onClick={() => setHistoryStudent(null)}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-100 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* List of every scan with required fields: Date, Time, Meal Type, Student Name, QR Scan ID, Delete button */}
            <div className="overflow-y-auto flex-1 pr-1 space-y-2">
              {getStudentScanHistory(historyStudent.id, historyStudent.rollNumber).length === 0 ? (
                <div className="py-12 text-center text-slate-400 font-medium space-y-2">
                  <Clock className="w-8 h-8 text-slate-300 mx-auto" />
                  <p className="text-xs">No attendance scan records logged yet for this student.</p>
                </div>
              ) : (
                getStudentScanHistory(historyStudent.id, historyStudent.rollNumber).map((scan) => (
                  <div 
                    key={scan.id}
                    className="bg-slate-50 border border-slate-200 rounded-2xl p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:border-slate-300 transition"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase font-mono tracking-wider ${
                          scan.type === 'lunch' ? 'bg-amber-100 text-amber-900 border border-amber-300' :
                          scan.type === 'dinner' ? 'bg-indigo-100 text-indigo-900 border border-indigo-300' :
                          'bg-emerald-100 text-emerald-900 border border-emerald-300'
                        }`}>
                          {scan.type}
                        </span>
                        <span className="text-xs font-bold text-slate-900">{scan.date}</span>
                        <span className="text-xs font-mono text-slate-500">{scan.time}</span>
                      </div>

                      <div className="text-[11px] text-slate-600 flex items-center gap-2 flex-wrap">
                        <span>Name: <strong className="text-slate-900">{scan.studentName || historyStudent.name}</strong></span>
                        <span>•</span>
                        <span>ID/QR: <code className="bg-slate-200/70 text-slate-800 px-1.5 py-0.5 rounded text-[10px] font-mono">{scan.id}</code></span>
                      </div>
                    </div>

                    {/* Requirement 3 & 4: Delete Button for each scan item */}
                    <div className="shrink-0 flex items-center justify-end">
                      <button 
                        id={`delete_scan_${scan.id}`}
                        onClick={() => {
                          setDeleteRecord(scan);
                          setDeleteReason('Manual deletion from Attendance History');
                        }}
                        className="bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5 text-rose-600" />
                        <span>Delete Record</span>
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="border-t border-slate-100 pt-3 flex justify-between items-center text-xs text-slate-500 font-medium">
              <span>Total Scans: {getStudentScanHistory(historyStudent.id, historyStudent.rollNumber).length}</span>
              <button 
                onClick={() => setHistoryStudent(null)}
                className="bg-slate-900 hover:bg-slate-800 text-white px-4 py-2 rounded-xl font-bold cursor-pointer transition"
              >
                Close History
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Requirement 4: Delete Confirmation Dialog */}
      {deleteRecord && (
        <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center z-50 p-4 animate-fade-in">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center gap-3 text-rose-600 border-b border-slate-100 pb-3">
              <div className="w-10 h-10 rounded-2xl bg-rose-100 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-5 h-5 text-rose-600" />
              </div>
              <div>
                <h4 className="font-extrabold text-slate-900 text-sm">Confirm Attendance Deletion</h4>
                <p className="text-[11px] text-slate-500">Action will be logged to audit_logs</p>
              </div>
            </div>

            <div className="bg-rose-50/60 border border-rose-100 rounded-2xl p-3.5 text-xs text-slate-700 space-y-1.5 font-medium">
              <div>Student: <strong className="text-slate-900">{deleteRecord.studentName}</strong> ({deleteRecord.rollNumber})</div>
              <div>Scan Date & Time: <strong className="text-slate-900">{deleteRecord.date} at {deleteRecord.time}</strong></div>
              <div>Meal Type: <strong className="uppercase font-mono text-slate-900">{deleteRecord.type}</strong></div>
              <div>Record ID: <code className="bg-white px-1.5 py-0.5 rounded text-[10px] font-mono">{deleteRecord.id}</code></div>
            </div>

            <div className="space-y-1 text-xs">
              <label className="font-bold text-slate-700">Reason for Deletion (Audit Trail):</label>
              <input 
                type="text" 
                value={deleteReason}
                onChange={(e) => setDeleteReason(e.target.value)}
                placeholder="e.g. Duplicate scan correction, Undo scan..."
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 outline-none focus:border-slate-800 text-xs font-medium"
              />
            </div>

            <div className="text-[11px] text-slate-500 leading-relaxed bg-slate-50 p-3 rounded-xl border border-slate-200/60">
              ✓ Document deleted from Firestore<br/>
              ✓ Monthly bill automatically recalculated<br/>
              ✓ Student meal count updated<br/>
              ✓ Audit log created with superintendent ID & timestamp
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button 
                disabled={isDeleting}
                onClick={() => setDeleteRecord(null)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold cursor-pointer transition"
              >
                Cancel
              </button>

              <button 
                id="confirm_delete_attendance_btn"
                disabled={isDeleting}
                onClick={confirmDeleteScan}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-extrabold cursor-pointer transition shadow-sm flex items-center gap-1.5"
              >
                {isDeleting ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Deleting...</span>
                  </>
                ) : (
                  <>
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Confirm Delete</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Dialog 3: Edit / Manual Add Attendance */}
      {editStudent && (
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center z-50 p-4 animate-fade-in">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-2xl bg-slate-900 text-white flex items-center justify-center font-bold">
                  <Edit className="w-4 h-4 text-emerald-400" />
                </div>
                <div>
                  <h4 className="font-extrabold text-slate-900 text-sm">Edit Attendance Entry</h4>
                  <p className="text-xs text-slate-500">{editStudent.name} ({editStudent.rollNumber})</p>
                </div>
              </div>
              <button 
                onClick={() => setEditStudent(null)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-100 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveEditAttendance} className="space-y-4 text-xs">
              <div className="space-y-1">
                <label className="font-bold text-slate-700">Meal / Attendance Type</label>
                <select 
                  value={editType}
                  onChange={(e) => setEditType(e.target.value as any)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 outline-none focus:border-slate-800 font-medium cursor-pointer"
                >
                  <option value="lunch">Lunch Mess Scan</option>
                  <option value="dinner">Dinner Mess Scan</option>
                  <option value="hostel">Hostel Gate Roll-call</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="font-bold text-slate-700">Date</label>
                <input 
                  type="date" 
                  value={editDate}
                  onChange={(e) => setEditDate(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 outline-none focus:border-slate-800 font-medium"
                />
              </div>

              <div className="space-y-1">
                <label className="font-bold text-slate-700">Status</label>
                <select 
                  value={editStatus}
                  onChange={(e) => setEditStatus(e.target.value as any)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 outline-none focus:border-slate-800 font-medium cursor-pointer"
                >
                  <option value="present">Present (Count Meal)</option>
                  <option value="absent">Absent</option>
                  <option value="leave">On Leave</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="font-bold text-slate-700">Correction Notes</label>
                <input 
                  type="text" 
                  value={editNotes}
                  onChange={(e) => setEditNotes(e.target.value)}
                  placeholder="e.g. Manual correction by Superintendent"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 outline-none focus:border-slate-800 font-medium"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button 
                  type="button"
                  onClick={() => setEditStudent(null)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold cursor-pointer transition"
                >
                  Cancel
                </button>

                <button 
                  type="submit"
                  disabled={isSavingEdit}
                  className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-extrabold cursor-pointer transition shadow-sm flex items-center gap-1.5"
                >
                  {isSavingEdit ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      <span>Saving...</span>
                    </>
                  ) : (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-400" />
                      <span>Save Record</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
