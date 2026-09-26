import React, { useState } from 'react';
import { LeaveRequest } from '../types';
import { Check, X, Clock, HelpCircle, User, CalendarDays, Filter, ChevronRight } from 'lucide-react';

interface LeaveManagementProps {
  leaves: LeaveRequest[];
  onProcessLeave: (id: string, status: 'approved' | 'rejected' | 'pending', processor: string) => void;
}

export default function LeaveManagement({ leaves, onProcessLeave }: LeaveManagementProps) {
  
  // Filtering state
  const [filterStatus, setFilterStatus] = useState<'all' | 'pending' | 'approved' | 'rejected'>('pending');

  const handleProcess = (id: string, status: 'approved' | 'rejected') => {
    onProcessLeave(id, status, 'Nirmal Naik (Hostel In-charge)');
  };

  const getLeaveDurationDays = (start: string, end: string) => {
    const s = new Date(start);
    const e = new Date(end);
    const diffTime = Math.abs(e.getTime() - s.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
    return diffDays;
  };

  const filteredLeaves = leaves.filter(l => {
    if (filterStatus === 'all') return true;
    return l.status === filterStatus;
  });

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Tab Filter selectors */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 bg-white border border-gray-100 p-5 rounded-2xl shadow-sm">
        <div>
          <h3 className="font-bold text-gray-900 text-base">Student Leave Applications</h3>
          <p className="text-xs text-gray-500">Review gate leave passes and automatically toggle mess off status</p>
        </div>

        <div className="flex gap-1.5 bg-gray-50 p-1 rounded-xl border border-gray-100">
          <button 
            id="leave_filter_pending"
            onClick={() => setFilterStatus('pending')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold cursor-pointer transition ${
              filterStatus === 'pending' ? 'bg-white text-slate-900 shadow-xs border border-slate-200 font-bold' : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            Pending ({leaves.filter(l => l.status === 'pending').length})
          </button>
          <button 
            id="leave_filter_approved"
            onClick={() => setFilterStatus('approved')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold cursor-pointer transition ${
              filterStatus === 'approved' ? 'bg-white text-emerald-800 shadow-xs border border-gray-100' : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            Approved
          </button>
          <button 
            id="leave_filter_rejected"
            onClick={() => setFilterStatus('rejected')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold cursor-pointer transition ${
              filterStatus === 'rejected' ? 'bg-white text-rose-800 shadow-xs border border-gray-100' : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            Rejected
          </button>
          <button 
            id="leave_filter_all"
            onClick={() => setFilterStatus('all')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold cursor-pointer transition ${
              filterStatus === 'all' ? 'bg-white text-gray-800 shadow-xs border border-gray-100' : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            All History
          </button>
        </div>
      </div>

      {/* Main requests queue */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {filteredLeaves.length === 0 ? (
          <div className="bg-white border border-gray-100 p-12 rounded-2xl text-center md:col-span-2 text-gray-400 font-medium">
            No leave requests found matching status: <span className="font-bold text-gray-600 uppercase">"{filterStatus}"</span>
          </div>
        ) : (
          filteredLeaves.map((l, idx) => {
            const daysCount = getLeaveDurationDays(l.startDate, l.endDate);
            return (
              <div key={l.id || `leave-${l.studentId || ''}-${l.startDate || ''}-${idx}`} className="bg-white border border-gray-100 rounded-2xl shadow-sm hover:shadow-md hover:border-gray-200 transition-all duration-300 p-6 flex flex-col justify-between space-y-4">
                <div className="space-y-3">
                  {/* Top Bar: Applicant Info */}
                  <div className="flex items-start justify-between border-b border-gray-50 pb-3">
                    <div className="flex items-center gap-3">
                      <div className="bg-slate-50 p-2.5 rounded-full text-slate-800 border border-slate-100">
                        <User className="w-5 h-5" />
                      </div>
                      <div>
                        <h4 className="font-bold text-gray-900 text-sm">{l.studentName}</h4>
                        <p className="text-[10px] font-mono text-gray-400">{l.rollNumber} • Rm {l.roomNumber}</p>
                      </div>
                    </div>

                    <span className={`px-2.5 py-0.5 rounded-full text-[9px] uppercase font-bold tracking-wider ${
                      l.status === 'approved' ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' :
                      l.status === 'rejected' ? 'bg-rose-50 text-rose-700 border border-rose-100' :
                      'bg-amber-50 text-amber-700 border border-amber-100'
                    }`}>
                      {l.status}
                    </span>
                  </div>

                  {/* Body: Dates and Duration */}
                  <div className="grid grid-cols-2 gap-4 text-xs bg-gray-50/50 p-3 rounded-xl border border-gray-100/50">
                    <div>
                      <span className="text-[10px] text-gray-400 uppercase font-bold block">Gate Out / Mess Off</span>
                      <p className="font-semibold text-gray-800 mt-0.5">{l.startDate}</p>
                    </div>
                    <div>
                      <span className="text-[10px] text-gray-400 uppercase font-bold block">Expected Return</span>
                      <p className="font-semibold text-gray-800 mt-0.5">{l.endDate}</p>
                    </div>
                    <div className="col-span-2 border-t border-gray-100 pt-1.5 flex items-center justify-between text-gray-500 font-semibold text-[11px]">
                      <span className="flex items-center gap-1.5">
                        <CalendarDays className="w-3.5 h-3.5 text-slate-600" /> Duration:
                      </span>
                      <span className="text-slate-800 font-bold font-mono bg-slate-50 border border-slate-200 px-2 py-0.5 rounded-md">
                        {daysCount} {daysCount === 1 ? 'Day' : 'Days'} Total
                      </span>
                    </div>
                  </div>

                  {/* Body: Reason text */}
                  <div className="space-y-1">
                    <span className="text-[10px] text-gray-400 uppercase font-bold block">Reason Statement</span>
                    <p className="text-gray-600 text-xs italic bg-gray-50/20 px-3 py-2 rounded-xl border border-dashed border-gray-100 leading-relaxed">
                      "{l.reason}"
                    </p>
                  </div>
                </div>

                {/* Bottom Bar: Action options */}
                <div className="border-t border-gray-50 pt-3 flex items-center justify-between gap-2">
                  <span className="text-[10px] text-gray-400 font-semibold font-mono">
                    ID: {l.id}
                  </span>
                  
                  {l.status === 'pending' ? (
                    <div className="flex gap-2">
                      <button 
                        id={`reject_leave_${l.id}`}
                        onClick={() => handleProcess(l.id, 'rejected')}
                        className="bg-rose-50 hover:bg-rose-100 border border-rose-100 text-rose-800 font-bold text-xs px-3.5 py-1.5 rounded-xl cursor-pointer transition flex items-center gap-1"
                      >
                        <X className="w-3.5 h-3.5" /> Reject
                      </button>
                      <button 
                        id={`approve_leave_${l.id}`}
                        onClick={() => handleProcess(l.id, 'approved')}
                        className="bg-slate-900 hover:bg-slate-850 text-white font-bold text-xs px-3.5 py-1.5 rounded-xl cursor-pointer transition flex items-center gap-1 shadow-xs"
                      >
                        <Check className="w-3.5 h-3.5" /> Approve Leave
                      </button>
                    </div>
                  ) : (
                    <p className="text-[11px] text-gray-400">
                      Processed by: <span className="font-semibold">{l.processedBy || "System Admin"}</span>
                    </p>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
