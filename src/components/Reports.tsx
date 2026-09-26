import React, { useState } from 'react';
import { Student, Attendance, LeaveRequest, MonthlyBill, Hostel } from '../types';
import { FileSpreadsheet, FileText, Calendar, Filter, ArrowRight, Download, Printer, ShieldAlert } from 'lucide-react';

interface ReportsProps {
  students: Student[];
  attendance: Attendance[];
  leaves: LeaveRequest[];
  bills: MonthlyBill[];
  hostels?: Hostel[];
}

export default function Reports({ students, attendance, leaves, bills, hostels = [] }: ReportsProps) {
  
  const currentMonthStr = new Date().toISOString().substring(0, 7);
  const [reportType, setReportType] = useState<'attendance' | 'mess' | 'students' | 'leave'>('attendance');
  const [selectedHostel, setSelectedHostel] = useState('all');
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [selectedMonth, setSelectedMonth] = useState(currentMonthStr);

  // Helper: Export to CSV (Excel format)
  const handleExportExcel = () => {
    let csvContent = '';
    let fileName = '';

    if (reportType === 'attendance') {
      fileName = `IRA_Hostel_Attendance_${selectedDate}.csv`;
      csvContent = "StudentName,RollNumber,Hostel,Room,Date,Time,Type,Status,RecordedBy\n";
      
      const filteredAtt = attendance.filter(a => 
        a.date === selectedDate && 
        (selectedHostel === 'all' || a.hostelName === selectedHostel)
      );

      filteredAtt.forEach(a => {
        csvContent += `"${a.studentName}","${a.rollNumber}","${a.hostelName}","${a.roomNumber}","${a.date}","${a.time}","${a.type}","${a.status}","${a.recordedBy}"\n`;
      });
    } 
    else if (reportType === 'mess') {
      fileName = `IRA_Mess_Bills_${selectedMonth}.csv`;
      csvContent = "StudentName,RollNumber,Department,Room,Month,LunchScans,DinnerScans,LeaveDays,TotalAmount,Status\n";

      const filteredBills = bills.filter(b => b.month === selectedMonth);
      filteredBills.forEach(b => {
        csvContent += `"${b.studentName}","${b.rollNumber}","${b.department}","${b.roomNumber}","${b.month}",${b.lunchCount},${b.dinnerCount},${b.leaveDays},${b.totalAmount},"${b.status}"\n`;
      });
    } 
    else if (reportType === 'students') {
      fileName = `IRA_Student_Registry.csv`;
      csvContent = "Name,RollNumber,Department,Semester,Phone,GuardianPhone,Hostel,Room,Bed,MessStatus,GateStatus\n";

      const filteredStudents = students.filter(s => selectedHostel === 'all' || s.hostelName === selectedHostel);
      filteredStudents.forEach(s => {
        csvContent += `"${s.name}","${s.rollNumber}","${s.department}","${s.semester}","${s.phone}","${s.guardianPhone}","${s.hostelName}","${s.roomNumber}","${s.bedNumber}","${s.messStatus}","${s.hostelStatus}"\n`;
      });
    } 
    else if (reportType === 'leave') {
      fileName = `IRA_Leave_Passes.csv`;
      csvContent = "StudentName,RollNumber,Department,Hostel,Room,StartDate,EndDate,Reason,Status,ProcessedBy\n";

      leaves.forEach(l => {
        csvContent += `"${l.studentName}","${l.rollNumber}","${l.department}","${l.hostelName}","${l.roomNumber}","${l.startDate}","${l.endDate}","${l.reason}","${l.status}","${l.processedBy || 'System'}"\n`;
      });
    }

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', fileName);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Helper: Print Preview document (Save as PDF trigger)
  const handlePrintPDF = () => {
    const win = window.open('', '', 'width=800,height=600');
    if (!win) return;

    let contentHtml = '';
    let reportTitle = '';

    if (reportType === 'attendance') {
      reportTitle = `Gate Attendance Registry Report (${selectedDate})`;
      const filteredAtt = attendance.filter(a => 
        a.date === selectedDate && 
        (selectedHostel === 'all' || a.hostelName === selectedHostel)
      );

      contentHtml = `
        <h3>Hostel: ${selectedHostel === 'all' ? 'All Buildings' : selectedHostel}</h3>
        <table>
          <thead>
            <tr>
              <th>Student Name</th>
              <th>Roll Number</th>
              <th>Room</th>
              <th>Type</th>
              <th>Status</th>
              <th>Time</th>
              <th>Method</th>
            </tr>
          </thead>
          <tbody>
            ${filteredAtt.map(a => `
              <tr>
                <td>${a.studentName}</td>
                <td class="mono">${a.rollNumber}</td>
                <td>Room ${a.roomNumber}</td>
                <td>${a.type.toUpperCase()}</td>
                <td class="bold ${a.status}">${a.status.toUpperCase()}</td>
                <td>${a.time}</td>
                <td>${a.recordedBy.toUpperCase()}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      `;
    } 
    else if (reportType === 'mess') {
      reportTitle = `Mess Charges Statement (${selectedMonth})`;
      const filteredBills = bills.filter(b => b.month === selectedMonth);

      contentHtml = `
        <table>
          <thead>
            <tr>
              <th>Student Name</th>
              <th>Roll Number</th>
              <th>Room</th>
              <th>Lunch Scans</th>
              <th>Dinner Scans</th>
              <th>Leave Days</th>
              <th>Total Amount</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            ${filteredBills.map(b => `
              <tr>
                <td>${b.studentName}</td>
                <td class="mono">${b.rollNumber}</td>
                <td>${b.roomNumber}</td>
                <td>${b.lunchCount} (₹${b.lunchCount * 35})</td>
                <td>${b.dinnerCount} (₹${b.dinnerCount * 35})</td>
                <td>${b.leaveDays} d</td>
                <td class="bold">₹${b.totalAmount}</td>
                <td class="bold ${b.status}">${b.status.toUpperCase()}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      `;
    } 
    else if (reportType === 'students') {
      reportTitle = `College Student Hostel Placement Register`;
      const filteredStudents = students.filter(s => selectedHostel === 'all' || s.hostelName === selectedHostel);

      contentHtml = `
        <h3>Hostel: ${selectedHostel === 'all' ? 'All Buildings' : selectedHostel}</h3>
        <table>
          <thead>
            <tr>
              <th>Student Name</th>
              <th>Roll Number</th>
              <th>Department</th>
              <th>Room & Bed</th>
              <th>Phone</th>
              <th>Mess Board</th>
              <th>Gate Status</th>
            </tr>
          </thead>
          <tbody>
            ${filteredStudents.map(s => `
              <tr>
                <td>${s.name}</td>
                <td class="mono">${s.rollNumber}</td>
                <td>${s.department}</td>
                <td>Rm ${s.roomNumber} - ${s.bedNumber}</td>
                <td>+91 ${s.phone}</td>
                <td>${s.messStatus.toUpperCase()}</td>
                <td class="bold ${s.hostelStatus}">${s.hostelStatus.toUpperCase()}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      `;
    } 
    else if (reportType === 'leave') {
      reportTitle = `Official Student Gate Leaves Log`;
      contentHtml = `
        <table>
          <thead>
            <tr>
              <th>Student Name</th>
              <th>Roll Number</th>
              <th>Room</th>
              <th>Start Date</th>
              <th>End Date</th>
              <th>Reason Pass</th>
              <th>Status</th>
              <th>Authorized By</th>
            </tr>
          </thead>
          <tbody>
            ${leaves.map(l => `
              <tr>
                <td>${l.studentName}</td>
                <td class="mono">${l.rollNumber}</td>
                <td>Room ${l.roomNumber}</td>
                <td>${l.startDate}</td>
                <td>${l.endDate}</td>
                <td>${l.reason}</td>
                <td class="bold ${l.status}">${l.status.toUpperCase()}</td>
                <td>${l.processedBy || 'System Admin'}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      `;
    }

    win.document.write(`
      <html>
        <head>
          <title>${reportTitle}</title>
          <style>
            body { font-family: system-ui, sans-serif; padding: 40px; color: #1e293b; }
            .header-block { border-bottom: 2px solid #0f172a; padding-bottom: 16px; margin-bottom: 24px; display: flex; justify-content: space-between; align-items: flex-end; }
            h1 { font-size: 24px; font-weight: 800; color: #0f172a; margin: 0; text-transform: uppercase; letter-spacing: 0.5px; }
            h3 { font-size: 14px; font-weight: 600; color: #64748b; margin: 4px 0 0; }
            .date-stamp { font-size: 11px; font-family: monospace; color: #94a3b8; text-align: right; }
            table { width: 100%; border-collapse: collapse; margin-top: 16px; font-size: 12px; }
            th { background: #f8fafc; border-bottom: 2px solid #cbd5e1; text-align: left; padding: 10px; color: #475569; font-weight: bold; }
            td { border-bottom: 1px solid #e2e8f0; padding: 10px; color: #334155; }
            tr:hover { background: #f8fafc; }
            .bold { font-weight: bold; }
            .mono { font-family: monospace; }
            .present { color: #059669; }
            .absent { color: #dc2626; }
            .leave { color: #d97706; }
            .paid { color: #059669; }
            .unpaid { color: #dc2626; }
            .approved { color: #059669; }
            .pending { color: #d97706; }
            .footer-block { border-top: 1px dashed #cbd5e1; padding-top: 16px; margin-top: 40px; text-align: center; font-size: 10px; color: #94a3b8; font-weight: 500; }
          </style>
        </head>
        <body>
          <div class="header-block">
            <div>
              <h1>IRA CAMPUS: HOSTEL REGISTRY</h1>
              <h3>${reportTitle}</h3>
            </div>
            <div class="date-stamp">
              Generated: ${new Date().toLocaleString()}<br />
              Authorized Portal Report
            </div>
          </div>
          ${contentHtml}
          <div class="footer-block">
            Official Academic Document • Powered by IRA Campus intelligence system
          </div>
          <script>window.print();</script>
        </body>
      </html>
    `);
    win.document.close();
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-4 gap-8 animate-fade-in">
      {/* Selector Panels */}
      <div className="space-y-4">
        <div className="bg-white border border-gray-100 rounded-2xl p-4 shadow-sm space-y-1.5 text-xs font-semibold">
          <p className="text-[10px] text-gray-400 uppercase font-bold px-3 pb-2 border-b border-gray-50">Select Report Type</p>
          
          <button 
            id="report_opt_att"
            onClick={() => setReportType('attendance')}
            className={`w-full flex items-center justify-between px-3.5 py-3 rounded-xl cursor-pointer transition ${
              reportType === 'attendance' ? 'bg-slate-900 text-white shadow-xs font-bold' : 'hover:bg-gray-50 text-gray-700'
            }`}
          >
            <span>Daily Gate Attendance</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>

          <button 
            id="report_opt_mess"
            onClick={() => setReportType('mess')}
            className={`w-full flex items-center justify-between px-3.5 py-3 rounded-xl cursor-pointer transition ${
              reportType === 'mess' ? 'bg-slate-900 text-white shadow-xs font-bold' : 'hover:bg-gray-50 text-gray-700'
            }`}
          >
            <span>Monthly Mess Accounts</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>

          <button 
            id="report_opt_stud"
            onClick={() => setReportType('students')}
            className={`w-full flex items-center justify-between px-3.5 py-3 rounded-xl cursor-pointer transition ${
              reportType === 'students' ? 'bg-slate-900 text-white shadow-xs font-bold' : 'hover:bg-gray-50 text-gray-700'
            }`}
          >
            <span>Student Room Placements</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>

          <button 
            id="report_opt_leave"
            onClick={() => setReportType('leave')}
            className={`w-full flex items-center justify-between px-3.5 py-3 rounded-xl cursor-pointer transition ${
              reportType === 'leave' ? 'bg-slate-900 text-white shadow-xs font-bold' : 'hover:bg-gray-50 text-gray-700'
            }`}
          >
            <span>Approved Gate Leaves</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Main Report generator interface */}
      <div className="lg:col-span-3 space-y-6">
        {/* Filter Menus */}
        <div className="bg-white border border-gray-100 p-5 rounded-2xl shadow-sm grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
          {reportType === 'attendance' && (
            <div className="space-y-1 text-xs">
              <label className="text-[10px] text-gray-400 uppercase font-bold">Select Registry Date</label>
              <input 
                id="report_date_select"
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3.5 py-2 outline-none focus:border-slate-800 transition"
              />
            </div>
          )}

          {reportType === 'mess' && (
            <div className="space-y-1 text-xs">
              <label className="text-[10px] text-gray-400 uppercase font-bold">Select Billing Cycle Month</label>
              <select 
                id="report_month_select"
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(e.target.value)}
                className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 outline-none focus:border-slate-800 cursor-pointer"
              >
                {Array.from(new Set([currentMonthStr, '2026-08', '2026-07', '2026-06', ...bills.map(b => b.month)])).sort().reverse().map(m => (
                  <option key={m} value={m}>
                    {m === currentMonthStr ? `${m} (Current Month)` : m}
                  </option>
                ))}
              </select>
            </div>
          )}

          {(reportType === 'attendance' || reportType === 'students') && (
            <div className="space-y-1 text-xs">
              <label className="text-[10px] text-gray-400 uppercase font-bold">Filter Hostel Building</label>
              <select 
                id="report_hostel_filter"
                value={selectedHostel}
                onChange={(e) => setSelectedHostel(e.target.value)}
                className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 outline-none focus:border-slate-800 cursor-pointer"
              >
                <option value="all">All Buildings</option>
                {hostels.map((h, i) => (
                  <option key={h.id || `rep-h-${h.name}-${i}`} value={h.name}>{h.name}</option>
                ))}
              </select>
            </div>
          )}

          <div className="md:col-start-3 flex justify-end gap-2 text-xs">
            <button 
              id="export_excel_btn"
              onClick={handleExportExcel}
              className="bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-850 font-bold px-4 py-2.5 rounded-xl cursor-pointer flex items-center gap-1.5 transition"
            >
              <FileSpreadsheet className="w-4 h-4" /> Excel (CSV)
            </button>
            <button 
              id="print_pdf_btn"
              onClick={handlePrintPDF}
              className="bg-slate-900 hover:bg-slate-850 text-white font-bold px-4 py-2.5 rounded-xl cursor-pointer flex items-center gap-1.5 shadow-sm transition"
            >
              <Printer className="w-4 h-4" /> Print / PDF
            </button>
          </div>
        </div>

        {/* Live report simulation grid */}
        <div className="bg-white border border-gray-100 rounded-2xl shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100 bg-gray-50/50 flex justify-between items-center">
            <h3 className="font-bold text-gray-950 text-sm uppercase tracking-wider font-sans">
              Interactive Report Preview
            </h3>
            <span className="text-[11px] font-mono text-gray-400 font-medium bg-white border border-gray-100 px-2 py-0.5 rounded-md">COLLEGIATE STAMPED</span>
          </div>

          <div className="p-4 overflow-x-auto text-xs max-h-[450px] overflow-y-auto">
            {reportType === 'attendance' && (
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-gray-100 text-gray-400 uppercase font-bold tracking-wider">
                    <th className="py-2 px-3">Student Name</th>
                    <th className="py-2 px-3">Roll Number</th>
                    <th className="py-2 px-3">Room</th>
                    <th className="py-2 px-3">Scan Type</th>
                    <th className="py-2 px-3">Time</th>
                    <th className="py-2 px-3 text-right">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50 font-medium text-gray-700">
                  {attendance.filter(a => a.date === selectedDate && (selectedHostel === 'all' || a.hostelName === selectedHostel)).length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-8 text-center text-gray-400 italic">No attendance records today in selected hostel</td>
                    </tr>
                  ) : (
                    attendance.filter(a => a.date === selectedDate && (selectedHostel === 'all' || a.hostelName === selectedHostel)).map((a, i) => (
                      <tr key={a.id || `att-rep-${a.studentId || ''}-${a.date || ''}-${a.type || ''}-${i}`} className="hover:bg-gray-50/50">
                        <td className="py-2.5 px-3 font-semibold text-gray-900">{a.studentName}</td>
                        <td className="py-2.5 px-3 font-mono">{a.rollNumber}</td>
                        <td className="py-2.5 px-3">Room {a.roomNumber}</td>
                        <td className="py-2.5 px-3 uppercase text-[10px]">{a.type}</td>
                        <td className="py-2.5 px-3 text-gray-500 font-mono">{a.time}</td>
                        <td className={`py-2.5 px-3 text-right font-bold uppercase ${
                          a.status === 'present' ? 'text-emerald-600' :
                          a.status === 'absent' ? 'text-rose-600' :
                          'text-amber-500'
                        }`}>{a.status}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            )}

            {reportType === 'mess' && (
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-gray-100 text-gray-400 uppercase font-bold tracking-wider">
                    <th className="py-2 px-3">Student Name</th>
                    <th className="py-2 px-3">Roll Number</th>
                    <th className="py-2 px-3 text-center">Lunch Scans</th>
                    <th className="py-2 px-3 text-center">Dinner Scans</th>
                    <th className="py-2 px-3 text-center">Leave Days</th>
                    <th className="py-2 px-3">Total Tariff</th>
                    <th className="py-2 px-3 text-right">Receipt</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50 font-medium text-gray-700">
                  {bills.filter(b => b.month === selectedMonth).length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-8 text-center text-gray-400 italic">No billing accounts compiled for this month</td>
                    </tr>
                  ) : (
                    bills.filter(b => b.month === selectedMonth).map((b, i) => (
                      <tr key={b.id || `bill-rep-${b.studentId || b.rollNumber}-${b.month}-${i}`} className="hover:bg-gray-50/50">
                        <td className="py-2.5 px-3 font-semibold text-gray-900">{b.studentName}</td>
                        <td className="py-2.5 px-3 font-mono">{b.rollNumber}</td>
                        <td className="py-2.5 px-3 text-center">{b.lunchCount}</td>
                        <td className="py-2.5 px-3 text-center">{b.dinnerCount}</td>
                        <td className="py-2.5 px-3 text-center">{b.leaveDays} d</td>
                        <td className="py-2.5 px-3 font-extrabold text-gray-950">₹{b.totalAmount}</td>
                        <td className={`py-2.5 px-3 text-right font-bold uppercase ${b.status === 'paid' ? 'text-emerald-600' : 'text-rose-600'}`}>{b.status}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            )}

            {reportType === 'students' && (
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-gray-100 text-gray-400 uppercase font-bold tracking-wider">
                    <th className="py-2 px-3">Student Name</th>
                    <th className="py-2 px-3">Roll Number</th>
                    <th className="py-2 px-3">Department</th>
                    <th className="py-2 px-3">Placement</th>
                    <th className="py-2 px-3">Phone</th>
                    <th className="py-2 px-3 text-right">Mess</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50 font-medium text-gray-700">
                  {students.filter(s => selectedHostel === 'all' || s.hostelName === selectedHostel).length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-8 text-center text-gray-400 italic">No student profiles enrolled in selected hostel building</td>
                    </tr>
                  ) : (
                    students.filter(s => selectedHostel === 'all' || s.hostelName === selectedHostel).map((s, i) => (
                      <tr key={s.id || `stud-rep-${s.rollNumber}-${i}`} className="hover:bg-gray-50/50">
                        <td className="py-2.5 px-3 font-semibold text-gray-900">{s.name}</td>
                        <td className="py-2.5 px-3 font-mono">{s.rollNumber}</td>
                        <td className="py-2.5 px-3">{s.department}</td>
                        <td className="py-2.5 px-3">{s.hostelName.split(' ')[0]} - Room {s.roomNumber}</td>
                        <td className="py-2.5 px-3 font-mono">+91 {s.phone}</td>
                        <td className="py-2.5 px-3 text-right uppercase font-bold text-[10px]">{s.messStatus}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            )}

            {reportType === 'leave' && (
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-gray-100 text-gray-400 uppercase font-bold tracking-wider">
                    <th className="py-2 px-3">Student Name</th>
                    <th className="py-2 px-3">Roll Number</th>
                    <th className="py-2 px-3">Duration</th>
                    <th className="py-2 px-3">Leave Reason Pass</th>
                    <th className="py-2 px-3 text-right">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50 font-medium text-gray-700">
                  {leaves.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-8 text-center text-gray-400 italic">No approved gate leave passes recorded in database</td>
                    </tr>
                  ) : (
                    leaves.map((l, i) => (
                      <tr key={l.id || `leave-rep-${l.studentId || ''}-${l.startDate || ''}-${i}`} className="hover:bg-gray-50/50">
                        <td className="py-2.5 px-3 font-semibold text-gray-900">{l.studentName}</td>
                        <td className="py-2.5 px-3 font-mono">{l.rollNumber}</td>
                        <td className="py-2.5 px-3">{l.startDate} to {l.endDate}</td>
                        <td className="py-2.5 px-3 italic text-gray-500">"{l.reason}"</td>
                        <td className={`py-2.5 px-3 text-right font-bold uppercase ${
                          l.status === 'approved' ? 'text-emerald-600' :
                          l.status === 'rejected' ? 'text-rose-600' :
                          'text-amber-500'
                        }`}>{l.status}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
