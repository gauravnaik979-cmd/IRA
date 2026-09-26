import React, { useState, useEffect } from 'react';
import { Notice, Student } from '../types';
import { 
  subscribeToHostelNotices, 
  publishNotice, 
  updateNotice, 
  deleteNotice, 
  togglePinNotice,
  DEFAULT_HOSTEL_ID 
} from '../services/noticeService';
import { 
  BellRing, 
  Send, 
  Paperclip, 
  FileText, 
  Image as ImageIcon, 
  Pin, 
  Trash2, 
  Edit, 
  Search, 
  Filter, 
  CheckCircle2, 
  AlertTriangle, 
  Clock, 
  Users, 
  Building, 
  GraduationCap, 
  DoorClosed, 
  User, 
  X, 
  Download, 
  Sparkles,
  Calendar
} from 'lucide-react';

interface NoticeManagementProps {
  hostelId?: string;
  hostelName?: string;
  superintendentName?: string;
  students?: Student[];
}

const QUICK_TEMPLATES = [
  { title: 'Mess Closed Tomorrow', desc: 'The mess facility will remain closed tomorrow for annual sanitation and maintenance.', priority: 'important' as const, audienceType: 'all' as const },
  { title: 'Water Supply Interrupted', desc: 'Water supply will be temporarily halted from 10:00 AM to 2:00 PM due to tank cleaning.', priority: 'emergency' as const, audienceType: 'all' as const },
  { title: 'Electricity Maintenance', desc: 'Power backup testing scheduled today between 3:00 PM and 5:00 PM.', priority: 'important' as const, audienceType: 'all' as const },
  { title: 'Monthly Bill Generated', desc: 'Mess bills for the current month have been published. Please check your mess balance.', priority: 'normal' as const, audienceType: 'all' as const },
  { title: 'Gate Closing Time Updated', desc: 'In accordance with Odisha State Hostel Guidelines, main gate strictly closes at 8:00 PM daily.', priority: 'important' as const, audienceType: 'all' as const },
  { title: 'Room Allocation Updated', desc: 'Please consult the hostel warden office regarding room bed reallocations.', priority: 'normal' as const, audienceType: 'room' as const },
];

export default function NoticeManagement({
  hostelId = '',
  hostelName = 'Hostel',
  superintendentName = "Hostel Superintendent",
  students
}: NoticeManagementProps) {
  const [notices, setNotices] = useState<Notice[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  
  // Publishing Form State
  const [showPublishForm, setShowPublishForm] = useState<boolean>(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState<'normal' | 'important' | 'emergency'>('normal');
  const [audienceType, setAudienceType] = useState<'all' | 'department' | 'semester' | 'room' | 'individual'>('all');
  const [audienceValue, setAudienceValue] = useState('');
  const [expiresAt, setExpiresAt] = useState('');
  const [attachmentData, setAttachmentData] = useState<{ url: string; name: string; type: 'image' | 'pdf' } | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successToast, setSuccessToast] = useState<string | null>(null);

  // Search & Filter State
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedPriority, setSelectedPriority] = useState<'all' | 'normal' | 'important' | 'emergency'>('all');
  const [showExpired, setShowExpired] = useState(false);

  // Edit Modal State
  const [editingNotice, setEditingNotice] = useState<Notice | null>(null);

  // 1. Subscribe to Firestore Notices
  useEffect(() => {
    setLoading(true);
    const unsubscribe = subscribeToHostelNotices(hostelId, (fetchedNotices) => {
      setNotices(fetchedNotices);
      setLoading(false);
    });
    return () => unsubscribe();
  }, [hostelId]);

  // File Upload Handler
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const isPdf = file.type === 'application/pdf' || file.name.endsWith('.pdf');
    const isImg = file.type.startsWith('image/');

    if (!isPdf && !isImg) {
      alert('Please upload an image (PNG/JPG) or PDF file.');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      alert('File size exceeds 5MB limit. Please select a smaller file.');
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      setAttachmentData({
        url: reader.result as string,
        name: file.name,
        type: isPdf ? 'pdf' : 'image'
      });
    };
    reader.readAsDataURL(file);
  };

  // Form Submit Handler
  const handlePublishSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !description.trim()) return;

    try {
      setIsSubmitting(true);
      await publishNotice(
        {
          hostelId,
          title: title.trim(),
          description: description.trim(),
          priority,
          audienceType,
          audienceValue: audienceType === 'all' ? '' : audienceValue.trim(),
          expiresAt: expiresAt ? new Date(expiresAt).toISOString() : null,
          attachmentURL: attachmentData?.url || null,
          attachmentName: attachmentData?.name || null,
          attachmentType: attachmentData?.type || null,
          createdBy: superintendentName,
          isPinned: priority === 'emergency'
        },
        hostelId
      );

      // Reset form
      setTitle('');
      setDescription('');
      setPriority('normal');
      setAudienceType('all');
      setAudienceValue('');
      setExpiresAt('');
      setAttachmentData(null);
      setShowPublishForm(false);

      setSuccessToast('Notice published successfully and push alert dispatched to target students!');
      setTimeout(() => setSuccessToast(null), 4000);
    } catch (err) {
      alert('Failed to publish notice. Please check network connection and try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Quick Template Auto-fill
  const applyTemplate = (tpl: typeof QUICK_TEMPLATES[0]) => {
    setTitle(tpl.title);
    setDescription(tpl.desc);
    setPriority(tpl.priority);
    setAudienceType(tpl.audienceType);
    setShowPublishForm(true);
  };

  // Filter logic
  const filteredNotices = notices.filter(notice => {
    // Search query
    const matchesSearch = 
      notice.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      notice.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (notice.audienceValue && notice.audienceValue.toLowerCase().includes(searchQuery.toLowerCase()));

    // Priority filter
    const matchesPriority = selectedPriority === 'all' || notice.priority === selectedPriority;

    // Expiry filter
    const isExpired = notice.expiresAt && new Date(notice.expiresAt) < new Date();
    const matchesExpired = showExpired ? true : !isExpired;

    return matchesSearch && matchesPriority && matchesExpired;
  });

  // Handle Edit Submit
  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingNotice) return;

    try {
      await updateNotice(hostelId, editingNotice.id, {
        title: editingNotice.title,
        description: editingNotice.description,
        priority: editingNotice.priority,
        audienceType: editingNotice.audienceType,
        audienceValue: editingNotice.audienceValue,
        expiresAt: editingNotice.expiresAt
      });
      setEditingNotice(null);
      setSuccessToast('Notice updated successfully.');
      setTimeout(() => setSuccessToast(null), 3000);
    } catch (err) {
      alert('Failed to update notice.');
    }
  };

  // Unique lists for audience selects
  const departments = Array.from(new Set(students.map(s => s.department).filter(Boolean)));
  const semesters = Array.from(new Set(students.map(s => s.semester).filter(Boolean))).sort();
  const rooms = Array.from(new Set(students.map(s => s.roomNumber).filter(Boolean))).sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));

  return (
    <div className="space-y-6">
      
      {/* SUCCESS ALERT TOAST */}
      {successToast && (
        <div className="bg-emerald-600 text-white px-4 py-3 rounded-xl shadow-lg flex items-center justify-between text-xs font-semibold animate-fade-in">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 shrink-0" />
            <span>{successToast}</span>
          </div>
          <button onClick={() => setSuccessToast(null)} className="p-1 hover:bg-emerald-700 rounded-lg cursor-pointer">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* HEADER BAR */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <div className="p-2 bg-slate-900 text-white rounded-xl">
              <BellRing className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-black text-slate-900 tracking-tight">Hostel Notice & Broadcast Center</h2>
              <p className="text-xs text-slate-500 font-medium">
                Odisha Govt Hostel System • {hostelName} • Real-time Push Notifications
              </p>
            </div>
          </div>
        </div>

        <button
          id="publish_notice_btn"
          onClick={() => setShowPublishForm(!showPublishForm)}
          className="bg-slate-900 hover:bg-slate-800 text-white font-bold px-4 py-2.5 rounded-xl text-xs flex items-center gap-2 shadow-xs transition cursor-pointer"
        >
          {showPublishForm ? (
            <>
              <X className="w-4 h-4" /> Close Form
            </>
          ) : (
            <>
              <Send className="w-4 h-4" /> Publish New Notice
            </>
          )}
        </button>
      </div>

      {/* QUICK TEMPLATES CHIPS */}
      {!showPublishForm && (
        <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs space-y-2">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-amber-500" /> Quick Notice Templates
          </span>
          <div className="flex flex-wrap gap-2">
            {QUICK_TEMPLATES.map((tpl, idx) => (
              <button
                key={idx}
                onClick={() => applyTemplate(tpl)}
                className="bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-700 hover:text-slate-900 px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer"
              >
                <span>{tpl.priority === 'emergency' ? '🔴' : tpl.priority === 'important' ? '🟠' : '🔵'}</span>
                <span>{tpl.title}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* PUBLISH NOTICE FORM */}
      {showPublishForm && (
        <form onSubmit={handlePublishSubmit} className="bg-white border border-slate-200 rounded-2xl p-6 shadow-md space-y-5 animate-fade-in">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <Send className="w-4 h-4 text-slate-800" /> Create Official Notice & Push Alert
            </h3>
            <span className="text-[10px] bg-slate-100 text-slate-600 px-2.5 py-1 rounded-full font-mono">
              Target Hostel: {hostelName}
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            
            {/* Notice Title */}
            <div className="space-y-1 md:col-span-2">
              <label className="text-xs font-bold text-slate-700">Notice Title *</label>
              <input
                type="text"
                required
                placeholder="e.g. Mess Closed Tomorrow / Water Supply Interrupted / Monthly Bill Notice"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-xs focus:ring-2 focus:ring-slate-900 focus:bg-white focus:outline-none"
              />
            </div>

            {/* Description / Body */}
            <div className="space-y-1 md:col-span-2">
              <label className="text-xs font-bold text-slate-700">Notice Description (Multi-line) *</label>
              <textarea
                required
                rows={4}
                placeholder="Provide complete detailed notice instructions, timings, and guidelines for students..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs focus:ring-2 focus:ring-slate-900 focus:bg-white focus:outline-none"
              />
            </div>

            {/* Priority Selector */}
            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-700">Notice Priority *</label>
              <div className="grid grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => setPriority('normal')}
                  className={`py-2 px-3 rounded-xl border text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer ${
                    priority === 'normal'
                      ? 'bg-blue-50 border-blue-500 text-blue-700 shadow-xs'
                      : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  <span className="text-blue-500">🔵</span> Normal
                </button>

                <button
                  type="button"
                  onClick={() => setPriority('important')}
                  className={`py-2 px-3 rounded-xl border text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer ${
                    priority === 'important'
                      ? 'bg-amber-50 border-amber-500 text-amber-700 shadow-xs'
                      : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  <span className="text-amber-500">🟠</span> Important
                </button>

                <button
                  type="button"
                  onClick={() => setPriority('emergency')}
                  className={`py-2 px-3 rounded-xl border text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer ${
                    priority === 'emergency'
                      ? 'bg-red-50 border-red-500 text-red-700 shadow-xs'
                      : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  <span className="text-red-500">🔴</span> Emergency
                </button>
              </div>
            </div>

            {/* Audience Type Selection */}
            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-700">Target Audience Selection *</label>
              <select
                value={audienceType}
                onChange={(e) => {
                  setAudienceType(e.target.value as any);
                  setAudienceValue('');
                }}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs focus:ring-2 focus:ring-slate-900 focus:outline-none"
              >
                <option value="all">👥 All Students in Hostel</option>
                <option value="department">🏛️ Department Specific</option>
                <option value="semester">🎓 Semester Specific</option>
                <option value="room">🚪 Room Number Specific</option>
                <option value="individual">👤 Individual Student (Roll No.)</option>
              </select>
            </div>

            {/* Audience Value Sub-Selection */}
            {audienceType !== 'all' && (
              <div className="space-y-1 md:col-span-2 bg-slate-50 p-3.5 rounded-xl border border-slate-200">
                <label className="text-xs font-bold text-slate-800">
                  Select Target {audienceType === 'department' ? 'Department' : audienceType === 'semester' ? 'Semester' : audienceType === 'room' ? 'Room Number' : 'Student Roll Number'} *
                </label>

                {audienceType === 'department' && (
                  <select
                    required
                    value={audienceValue}
                    onChange={(e) => setAudienceValue(e.target.value)}
                    className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs focus:ring-2 focus:ring-slate-900 focus:outline-none"
                  >
                    <option value="">Select Department...</option>
                    {departments.map(dept => (
                      <option key={dept} value={dept}>{dept}</option>
                    ))}
                    <option value="Computer Science">Computer Science & Engineering</option>
                    <option value="Electrical Engineering">Electrical Engineering</option>
                    <option value="Mechanical Engineering">Mechanical Engineering</option>
                    <option value="Civil Engineering">Civil Engineering</option>
                  </select>
                )}

                {audienceType === 'semester' && (
                  <select
                    required
                    value={audienceValue}
                    onChange={(e) => setAudienceValue(e.target.value)}
                    className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs focus:ring-2 focus:ring-slate-900 focus:outline-none"
                  >
                    <option value="">Select Semester...</option>
                    {semesters.map(sem => (
                      <option key={sem} value={sem}>{sem}</option>
                    ))}
                    <option value="1st Semester">1st Semester</option>
                    <option value="2nd Semester">2nd Semester</option>
                    <option value="3rd Semester">3rd Semester</option>
                    <option value="4th Semester">4th Semester</option>
                    <option value="5th Semester">5th Semester</option>
                    <option value="6th Semester">6th Semester</option>
                    <option value="7th Semester">7th Semester</option>
                    <option value="8th Semester">8th Semester</option>
                  </select>
                )}

                {audienceType === 'room' && (
                  <select
                    required
                    value={audienceValue}
                    onChange={(e) => setAudienceValue(e.target.value)}
                    className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs focus:ring-2 focus:ring-slate-900 focus:outline-none"
                  >
                    <option value="">Select Room Number...</option>
                    {rooms.map(rm => (
                      <option key={rm} value={rm}>Room {rm}</option>
                    ))}
                  </select>
                )}

                {audienceType === 'individual' && (
                  <div className="space-y-2">
                    <select
                      value={audienceValue}
                      onChange={(e) => setAudienceValue(e.target.value)}
                      className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs focus:ring-2 focus:ring-slate-900 focus:outline-none"
                    >
                      <option value="">Select Student from List...</option>
                      {students.map(std => (
                        <option key={std.id} value={std.rollNumber}>
                          {std.name} ({std.rollNumber}) - Room {std.roomNumber}
                        </option>
                      ))}
                    </select>
                    <div className="flex items-center gap-2 text-[11px] text-slate-500">
                      <span>Or enter custom Roll Number:</span>
                      <input
                        type="text"
                        placeholder="e.g. OD-2024-001"
                        value={audienceValue}
                        onChange={(e) => setAudienceValue(e.target.value)}
                        className="bg-white border border-slate-200 rounded-lg px-2.5 py-1 text-xs focus:ring-1 focus:ring-slate-900"
                      />
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Optional Expiry Date */}
            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-700 flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5 text-slate-500" /> Optional Expiry Date & Time
              </label>
              <input
                type="datetime-local"
                value={expiresAt}
                onChange={(e) => setExpiresAt(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs focus:ring-2 focus:ring-slate-900 focus:outline-none"
              />
            </div>

            {/* File / Attachment Upload */}
            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-700 flex items-center gap-1">
                <Paperclip className="w-3.5 h-3.5 text-slate-500" /> Attachment (Image / PDF)
              </label>
              {attachmentData ? (
                <div className="flex items-center justify-between bg-slate-100 border border-slate-200 rounded-xl px-3 py-1.5 text-xs">
                  <div className="flex items-center gap-2 truncate">
                    {attachmentData.type === 'pdf' ? (
                      <FileText className="w-4 h-4 text-red-600 shrink-0" />
                    ) : (
                      <ImageIcon className="w-4 h-4 text-blue-600 shrink-0" />
                    )}
                    <span className="truncate font-medium text-slate-800">{attachmentData.name}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setAttachmentData(null)}
                    className="p-1 hover:bg-slate-200 rounded-lg text-slate-500 cursor-pointer"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              ) : (
                <label className="w-full bg-slate-50 hover:bg-slate-100 border border-dashed border-slate-300 rounded-xl px-3 py-2 text-xs text-slate-600 font-semibold flex items-center justify-center gap-2 cursor-pointer transition">
                  <Paperclip className="w-4 h-4 text-slate-500" />
                  <span>Choose Image or PDF File (Max 5MB)</span>
                  <input
                    type="file"
                    accept="image/*,.pdf"
                    onChange={handleFileUpload}
                    className="hidden"
                  />
                </label>
              )}
            </div>

          </div>

          <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setShowPublishForm(false)}
              className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="bg-slate-900 hover:bg-slate-850 text-white font-bold px-6 py-2.5 rounded-xl text-xs flex items-center gap-2 shadow-sm transition cursor-pointer disabled:opacity-50"
            >
              <Send className="w-4 h-4" />
              <span>{isSubmitting ? 'Publishing...' : 'Publish Notice & Dispatch Push Alerts'}</span>
            </button>
          </div>
        </form>
      )}

      {/* SEARCH AND FILTERS BAR */}
      <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 text-xs">
        
        {/* Search */}
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search notices by title, description or audience..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-9 pr-3 py-2 text-xs focus:ring-2 focus:ring-slate-900 focus:bg-white focus:outline-none"
          />
        </div>

        {/* Priority Filter Buttons */}
        <div className="flex items-center gap-1 bg-slate-100/70 p-1 rounded-xl border border-slate-200">
          <button
            onClick={() => setSelectedPriority('all')}
            className={`px-3 py-1.5 rounded-lg font-bold text-[11px] transition cursor-pointer ${
              selectedPriority === 'all' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            All ({notices.length})
          </button>
          <button
            onClick={() => setSelectedPriority('emergency')}
            className={`px-2.5 py-1.5 rounded-lg font-bold text-[11px] transition cursor-pointer flex items-center gap-1 ${
              selectedPriority === 'emergency' ? 'bg-red-600 text-white shadow-xs' : 'text-slate-600 hover:text-red-600'
            }`}
          >
            🔴 Emergency
          </button>
          <button
            onClick={() => setSelectedPriority('important')}
            className={`px-2.5 py-1.5 rounded-lg font-bold text-[11px] transition cursor-pointer flex items-center gap-1 ${
              selectedPriority === 'important' ? 'bg-amber-600 text-white shadow-xs' : 'text-slate-600 hover:text-amber-600'
            }`}
          >
            🟠 Important
          </button>
          <button
            onClick={() => setSelectedPriority('normal')}
            className={`px-2.5 py-1.5 rounded-lg font-bold text-[11px] transition cursor-pointer flex items-center gap-1 ${
              selectedPriority === 'normal' ? 'bg-blue-600 text-white shadow-xs' : 'text-slate-600 hover:text-blue-600'
            }`}
          >
            🔵 Normal
          </button>
        </div>

        {/* Show Expired Toggle */}
        <button
          onClick={() => setShowExpired(!showExpired)}
          className={`px-3 py-2 rounded-xl border font-bold text-[11px] flex items-center gap-1.5 transition cursor-pointer ${
            showExpired ? 'bg-slate-900 text-white border-slate-900' : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
          }`}
        >
          <Clock className="w-3.5 h-3.5" />
          <span>{showExpired ? 'Showing Expired' : 'Hide Expired'}</span>
        </button>

      </div>

      {/* PUBLISHED NOTICES LIST */}
      <div className="space-y-4">
        {loading ? (
          <div className="bg-white border border-slate-200 rounded-2xl p-12 text-center text-slate-500 space-y-3 shadow-xs">
            <div className="w-8 h-8 border-3 border-slate-200 border-t-slate-900 rounded-full animate-spin mx-auto"></div>
            <p className="text-xs font-semibold">Loading official hostel notices...</p>
          </div>
        ) : filteredNotices.length === 0 ? (
          <div className="bg-white border border-slate-200 rounded-2xl p-12 text-center text-slate-500 space-y-3 shadow-xs">
            <BellRing className="w-12 h-12 text-slate-300 mx-auto" />
            <h4 className="text-sm font-bold text-slate-800">No Notices Found</h4>
            <p className="text-xs text-slate-400">
              {searchQuery || selectedPriority !== 'all'
                ? 'No notices match your active search or filter parameters.'
                : 'No notices published yet. Click "Publish New Notice" above to post an announcement.'}
            </p>
          </div>
        ) : (
          filteredNotices.map((notice) => {
            const isExpired = notice.expiresAt && new Date(notice.expiresAt) < new Date();

            return (
              <div
                key={notice.id}
                className={`bg-white border rounded-2xl p-5 shadow-xs transition space-y-3 relative ${
                  notice.isPinned ? 'border-amber-400 ring-2 ring-amber-400/20 bg-amber-50/10' : 'border-slate-200'
                } ${isExpired ? 'opacity-60 bg-slate-50/50' : ''}`}
              >
                
                {/* Notice Top Metadata Header */}
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3">
                  
                  <div className="flex items-center gap-2">
                    
                    {/* Priority Badge */}
                    <span
                      className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider flex items-center gap-1 ${
                        notice.priority === 'emergency'
                          ? 'bg-red-100 text-red-700 border border-red-200'
                          : notice.priority === 'important'
                          ? 'bg-amber-100 text-amber-800 border border-amber-200'
                          : 'bg-blue-100 text-blue-800 border border-blue-200'
                      }`}
                    >
                      {notice.priority === 'emergency' ? '🔴 Emergency' : notice.priority === 'important' ? '🟠 Important' : '🔵 Normal'}
                    </span>

                    {/* Target Audience Badge */}
                    <span className="bg-slate-100 text-slate-700 border border-slate-200 px-2.5 py-1 rounded-full text-[10px] font-bold flex items-center gap-1">
                      {notice.audienceType === 'all' && <Users className="w-3 h-3 text-slate-500" />}
                      {notice.audienceType === 'department' && <Building className="w-3 h-3 text-slate-500" />}
                      {notice.audienceType === 'semester' && <GraduationCap className="w-3 h-3 text-slate-500" />}
                      {notice.audienceType === 'room' && <DoorClosed className="w-3 h-3 text-slate-500" />}
                      {notice.audienceType === 'individual' && <User className="w-3 h-3 text-slate-500" />}
                      <span>
                        Audience: {notice.audienceType === 'all' ? 'All Students' : `${notice.audienceType.toUpperCase()}: ${notice.audienceValue}`}
                      </span>
                    </span>

                    {/* Delivery Status */}
                    <span className="bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-0.5 rounded-md text-[10px] font-bold flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3 text-emerald-600" /> Delivered
                    </span>

                    {/* Pinned Badge */}
                    {notice.isPinned && (
                      <span className="bg-amber-100 text-amber-800 border border-amber-300 px-2 py-0.5 rounded-md text-[10px] font-black flex items-center gap-1">
                        <Pin className="w-3 h-3 text-amber-600" /> Pinned
                      </span>
                    )}

                    {isExpired && (
                      <span className="bg-gray-200 text-gray-700 px-2 py-0.5 rounded-md text-[10px] font-bold">
                        Expired
                      </span>
                    )}

                  </div>

                  {/* Actions for Superintendent */}
                  <div className="flex items-center gap-1">
                    
                    {/* Pin / Unpin Button */}
                    <button
                      onClick={() => togglePinNotice(hostelId, notice.id, !!notice.isPinned)}
                      title={notice.isPinned ? 'Unpin Notice' : 'Pin Notice to Top'}
                      className={`p-1.5 rounded-lg border text-xs transition cursor-pointer ${
                        notice.isPinned
                          ? 'bg-amber-100 border-amber-300 text-amber-700'
                          : 'bg-slate-50 border-slate-200 text-slate-500 hover:bg-slate-100'
                      }`}
                    >
                      <Pin className="w-3.5 h-3.5" />
                    </button>

                    {/* Edit Button */}
                    <button
                      onClick={() => setEditingNotice(notice)}
                      title="Edit Notice"
                      className="p-1.5 rounded-lg bg-slate-50 border border-slate-200 text-slate-600 hover:bg-slate-100 text-xs transition cursor-pointer"
                    >
                      <Edit className="w-3.5 h-3.5" />
                    </button>

                    {/* Delete Button */}
                    <button
                      onClick={async () => {
                        if (confirm(`Are you sure you want to delete notice "${notice.title}"?`)) {
                          await deleteNotice(hostelId, notice.id);
                        }
                      }}
                      title="Delete Notice"
                      className="p-1.5 rounded-lg bg-red-50 border border-red-200 text-red-600 hover:bg-red-100 text-xs transition cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>

                  </div>

                </div>

                {/* Notice Title & Description Body */}
                <div className="space-y-1.5">
                  <h3 className="font-extrabold text-slate-900 text-base tracking-tight leading-snug">
                    {notice.title}
                  </h3>
                  <p className="text-xs text-slate-700 whitespace-pre-wrap leading-relaxed font-sans">
                    {notice.description}
                  </p>
                </div>

                {/* Attachment Section */}
                {notice.attachmentURL && (
                  <div className="pt-2">
                    {notice.attachmentType === 'image' ? (
                      <div className="space-y-1">
                        <img
                          src={notice.attachmentURL}
                          alt="Notice Attachment"
                          className="max-h-56 rounded-xl border border-slate-200 object-cover shadow-xs"
                          referrerPolicy="no-referrer"
                        />
                        <a
                          href={notice.attachmentURL}
                          download={notice.attachmentName || 'notice-attachment.jpg'}
                          className="inline-flex items-center gap-1.5 text-xs text-slate-800 font-bold hover:underline"
                        >
                          <Download className="w-3.5 h-3.5 text-slate-700" /> Download Attached Image
                        </a>
                      </div>
                    ) : (
                      <a
                        href={notice.attachmentURL}
                        download={notice.attachmentName || 'notice-document.pdf'}
                        className="inline-flex items-center gap-2 bg-slate-100 hover:bg-slate-200 border border-slate-200 px-3.5 py-2 rounded-xl text-xs font-bold text-slate-800 transition shadow-xs"
                      >
                        <FileText className="w-4 h-4 text-red-600" />
                        <span>Download Attached Document ({notice.attachmentName || 'PDF Document'})</span>
                        <Download className="w-3.5 h-3.5 ml-1 text-slate-500" />
                      </a>
                    )}
                  </div>
                )}

                {/* Footer Info */}
                <div className="flex flex-wrap items-center justify-between gap-2 text-[10px] text-slate-400 font-medium pt-2 border-t border-slate-100">
                  <span className="flex items-center gap-1">
                    <Clock className="w-3 h-3 text-slate-400" /> Published by {notice.createdBy} on {new Date(notice.createdAt).toLocaleString()}
                  </span>
                  {notice.expiresAt && (
                    <span className="flex items-center gap-1 font-mono">
                      Expires: {new Date(notice.expiresAt).toLocaleString()}
                    </span>
                  )}
                </div>

              </div>
            );
          })
        )}
      </div>

      {/* EDIT NOTICE MODAL */}
      {editingNotice && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <form onSubmit={handleEditSubmit} className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h4 className="font-bold text-slate-900 text-sm flex items-center gap-2">
                <Edit className="w-4 h-4 text-slate-800" /> Edit Notice
              </h4>
              <button
                type="button"
                onClick={() => setEditingNotice(null)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="font-bold text-slate-700">Notice Title</label>
                <input
                  type="text"
                  required
                  value={editingNotice.title}
                  onChange={(e) => setEditingNotice({ ...editingNotice, title: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs focus:ring-2 focus:ring-slate-900 focus:outline-none"
                />
              </div>

              <div>
                <label className="font-bold text-slate-700">Notice Description</label>
                <textarea
                  required
                  rows={4}
                  value={editingNotice.description}
                  onChange={(e) => setEditingNotice({ ...editingNotice, description: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs focus:ring-2 focus:ring-slate-900 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-slate-700">Priority</label>
                  <select
                    value={editingNotice.priority}
                    onChange={(e) => setEditingNotice({ ...editingNotice, priority: e.target.value as any })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs focus:ring-2 focus:ring-slate-900"
                  >
                    <option value="normal">🔵 Normal</option>
                    <option value="important">🟠 Important</option>
                    <option value="emergency">🔴 Emergency</option>
                  </select>
                </div>

                <div>
                  <label className="font-bold text-slate-700">Audience Type</label>
                  <select
                    value={editingNotice.audienceType}
                    onChange={(e) => setEditingNotice({ ...editingNotice, audienceType: e.target.value as any })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs focus:ring-2 focus:ring-slate-900"
                  >
                    <option value="all">All Students</option>
                    <option value="department">Department</option>
                    <option value="semester">Semester</option>
                    <option value="room">Room Number</option>
                    <option value="individual">Individual Student</option>
                  </select>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setEditingNotice(null)}
                className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="bg-slate-900 hover:bg-slate-800 text-white font-bold px-5 py-2 rounded-xl text-xs cursor-pointer shadow-xs"
              >
                Save Changes
              </button>
            </div>
          </form>
        </div>
      )}

    </div>
  );
}
