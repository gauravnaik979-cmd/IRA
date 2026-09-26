import React, { useState, useEffect } from 'react';
import { Notice, Student } from '../types';
import { 
  subscribeToHostelNotices, 
  filterNoticesForStudent, 
  markNoticeAsRead, 
  DEFAULT_HOSTEL_ID 
} from '../services/noticeService';
import { requestNotificationPermission } from '../services/fcmService';
import { 
  Bell, 
  BellRing, 
  X, 
  Check, 
  CheckCheck, 
  RefreshCw, 
  Trash2, 
  Download, 
  FileText, 
  Image as ImageIcon, 
  Clock, 
  AlertTriangle, 
  Pin,
  Sparkles,
  ExternalLink
} from 'lucide-react';

interface StudentNotificationBellProps {
  student: Student;
  hostelId?: string;
}

export default function StudentNotificationBell({
  student,
  hostelId = DEFAULT_HOSTEL_ID
}: StudentNotificationBellProps) {
  const [allNotices, setAllNotices] = useState<Notice[]>([]);
  const [showInbox, setShowInbox] = useState<boolean>(false);
  const [selectedNotice, setSelectedNotice] = useState<Notice | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<'all' | 'emergency' | 'important' | 'general' | 'personal'>('all');
  const [hiddenNoticeIds, setHiddenNoticeIds] = useState<string[]>(() => {
    try {
      return JSON.parse(localStorage.getItem(`ira_deleted_notices_${student?.id}`) || '[]');
    } catch {
      return [];
    }
  });
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [permissionState, setPermissionState] = useState<string | null>(null);

  // 1. Realtime Firestore listener for Notices
  useEffect(() => {
    if (!student) return;
    const effectiveHostelId = student.hostelId || hostelId;

    const unsubscribe = subscribeToHostelNotices(effectiveHostelId, (notices) => {
      setAllNotices(notices);
    });

    return () => unsubscribe();
  }, [student, hostelId]);

  // Request Push Permission on first mount
  useEffect(() => {
    requestNotificationPermission().then((res) => {
      if (res) setPermissionState(res);
    });
  }, []);

  // Filter notices relevant for this student
  const studentNotices = filterNoticesForStudent(allNotices, student).filter(
    (n) => !hiddenNoticeIds.includes(n.id)
  );

  // Unread Count Calculation
  const unreadCount = studentNotices.filter(
    (n) => !(n.readBy || []).includes(student?.id)
  ).length;

  // Category Filter logic
  const filteredNotices = studentNotices.filter((n) => {
    if (selectedCategory === 'all') return true;
    if (selectedCategory === 'emergency') return n.priority === 'emergency';
    if (selectedCategory === 'important') return n.priority === 'important';
    if (selectedCategory === 'general') return n.priority === 'normal' && n.audienceType === 'all';
    if (selectedCategory === 'personal') return n.audienceType === 'individual' || n.audienceType === 'room';
    return true;
  });

  // Action: Mark as Read
  const handleMarkAsRead = async (notice: Notice) => {
    await markNoticeAsRead(student.hostelId || hostelId, notice.id, student.id, notice.readBy || []);
  };

  // Action: Mark All as Read
  const handleMarkAllAsRead = async () => {
    const unread = studentNotices.filter((n) => !(n.readBy || []).includes(student.id));
    for (const n of unread) {
      await markNoticeAsRead(student.hostelId || hostelId, n.id, student.id, n.readBy || []);
    }
  };

  // Action: Delete Notice Locally
  const handleDeleteLocally = (noticeId: string) => {
    const updated = [...hiddenNoticeIds, noticeId];
    setHiddenNoticeIds(updated);
    localStorage.setItem(`ira_deleted_notices_${student?.id}`, JSON.stringify(updated));
  };

  // Action: Refresh
  const handleRefresh = () => {
    setIsRefreshing(true);
    setTimeout(() => {
      setIsRefreshing(false);
    }, 600);
  };

  return (
    <>
      {/* BELL BUTTON WITH UNREAD BADGE */}
      <button
        id="student_notification_bell_btn"
        onClick={() => setShowInbox(!showInbox)}
        className="relative p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 transition cursor-pointer flex items-center justify-center"
        title="Notice Board & Push Alerts"
      >
        {unreadCount > 0 ? (
          <BellRing className="w-5 h-5 text-slate-900 animate-pulse" />
        ) : (
          <Bell className="w-5 h-5 text-slate-600" />
        )}

        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 bg-red-600 text-white font-extrabold text-[10px] h-5 min-w-[20px] px-1 rounded-full flex items-center justify-center border-2 border-white shadow-xs animate-bounce">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {/* NOTIFICATION INBOX DRAWER / MODAL */}
      {showInbox && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-xs flex items-start justify-end z-50 p-4 md:p-6 animate-fade-in">
          <div className="bg-white rounded-2xl w-full max-w-md max-h-[90vh] flex flex-col shadow-2xl border border-slate-200 overflow-hidden">
            
            {/* INBOX HEADER */}
            <div className="bg-slate-900 text-white p-4 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2">
                <BellRing className="w-5 h-5 text-amber-400" />
                <div>
                  <h3 className="font-extrabold text-sm tracking-tight">Hostel Notice Inbox</h3>
                  <p className="text-[10px] text-slate-300 font-medium">
                    {student.hostelName} • {unreadCount} unread alert{unreadCount !== 1 ? 's' : ''}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-1">
                <button
                  onClick={handleRefresh}
                  title="Pull-to-refresh"
                  className={`p-1.5 text-slate-300 hover:text-white rounded-lg transition cursor-pointer ${
                    isRefreshing ? 'animate-spin' : ''
                  }`}
                >
                  <RefreshCw className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setShowInbox(false)}
                  className="p-1.5 text-slate-300 hover:text-white rounded-lg cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* QUICK ACTIONS & CATEGORIES FILTER */}
            <div className="bg-slate-50 border-b border-slate-200 p-3 shrink-0 space-y-2 text-xs">
              
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Categories</span>
                {unreadCount > 0 && (
                  <button
                    onClick={handleMarkAllAsRead}
                    className="text-[11px] font-bold text-slate-800 hover:underline flex items-center gap-1 cursor-pointer"
                  >
                    <CheckCheck className="w-3.5 h-3.5 text-emerald-600" /> Mark All as Read
                  </button>
                )}
              </div>

              {/* Category Chips */}
              <div className="flex flex-wrap gap-1.5 text-[11px]">
                <button
                  onClick={() => setSelectedCategory('all')}
                  className={`px-2.5 py-1 rounded-lg font-bold transition cursor-pointer ${
                    selectedCategory === 'all'
                      ? 'bg-slate-900 text-white shadow-xs'
                      : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  All ({studentNotices.length})
                </button>

                <button
                  onClick={() => setSelectedCategory('emergency')}
                  className={`px-2 py-1 rounded-lg font-bold transition cursor-pointer ${
                    selectedCategory === 'emergency'
                      ? 'bg-red-600 text-white shadow-xs'
                      : 'bg-white text-slate-600 border border-slate-200 hover:text-red-600'
                  }`}
                >
                  🔴 Emergency
                </button>

                <button
                  onClick={() => setSelectedCategory('important')}
                  className={`px-2 py-1 rounded-lg font-bold transition cursor-pointer ${
                    selectedCategory === 'important'
                      ? 'bg-amber-600 text-white shadow-xs'
                      : 'bg-white text-slate-600 border border-slate-200 hover:text-amber-600'
                  }`}
                >
                  🟠 Important
                </button>

                <button
                  onClick={() => setSelectedCategory('general')}
                  className={`px-2 py-1 rounded-lg font-bold transition cursor-pointer ${
                    selectedCategory === 'general'
                      ? 'bg-blue-600 text-white shadow-xs'
                      : 'bg-white text-slate-600 border border-slate-200 hover:text-blue-600'
                  }`}
                >
                  🔵 General
                </button>

                <button
                  onClick={() => setSelectedCategory('personal')}
                  className={`px-2 py-1 rounded-lg font-bold transition cursor-pointer ${
                    selectedCategory === 'personal'
                      ? 'bg-emerald-600 text-white shadow-xs'
                      : 'bg-white text-slate-600 border border-slate-200 hover:text-emerald-600'
                  }`}
                >
                  🟢 Personal
                </button>
              </div>

            </div>

            {/* NOTIFICATIONS LIST */}
            <div className="flex-1 overflow-y-auto p-3 space-y-2.5">
              {filteredNotices.length === 0 ? (
                <div className="p-8 text-center text-slate-400 space-y-2">
                  <Bell className="w-10 h-10 text-slate-300 mx-auto" />
                  <p className="text-xs font-semibold">No notifications in this category.</p>
                </div>
              ) : (
                filteredNotices.map((notice) => {
                  const isRead = (notice.readBy || []).includes(student.id);

                  return (
                    <div
                      key={notice.id}
                      onClick={() => {
                        setSelectedNotice(notice);
                        handleMarkAsRead(notice);
                      }}
                      className={`p-3.5 rounded-xl border transition cursor-pointer relative space-y-2 ${
                        !isRead
                          ? 'bg-blue-50/40 border-blue-200 shadow-xs'
                          : 'bg-white border-slate-200 hover:border-slate-300'
                      }`}
                    >
                      
                      {/* Top Bar */}
                      <div className="flex items-center justify-between text-[10px]">
                        <div className="flex items-center gap-1.5">
                          {!isRead && (
                            <span className="w-2 h-2 rounded-full bg-blue-600 shrink-0 animate-ping"></span>
                          )}

                          <span className={`font-bold uppercase tracking-wider px-2 py-0.5 rounded-md ${
                            notice.priority === 'emergency'
                              ? 'bg-red-100 text-red-700'
                              : notice.priority === 'important'
                              ? 'bg-amber-100 text-amber-800'
                              : 'bg-blue-100 text-blue-800'
                          }`}>
                            {notice.priority === 'emergency' ? '🔴 Emergency' : notice.priority === 'important' ? '🟠 Important' : '🔵 General'}
                          </span>

                          {notice.audienceType === 'individual' && (
                            <span className="bg-emerald-100 text-emerald-800 font-bold px-2 py-0.5 rounded-md">
                              🟢 Personal
                            </span>
                          )}

                          {notice.isPinned && (
                            <span className="bg-amber-100 text-amber-800 font-bold px-1.5 py-0.5 rounded-md flex items-center gap-1">
                              <Pin className="w-2.5 h-2.5" /> Pinned
                            </span>
                          )}
                        </div>

                        <span className="text-slate-400 font-mono">
                          {new Date(notice.createdAt).toLocaleDateString([], { month: 'short', day: 'numeric' })}
                        </span>
                      </div>

                      {/* Title & Excerpt */}
                      <div className="space-y-0.5">
                        <h4 className={`text-xs tracking-tight ${!isRead ? 'font-extrabold text-slate-900' : 'font-bold text-slate-800'}`}>
                          {notice.title}
                        </h4>
                        <p className="text-[11px] text-slate-600 line-clamp-2 leading-snug">
                          {notice.description}
                        </p>
                      </div>

                      {/* Footer & Delete Local Button */}
                      <div className="flex items-center justify-between text-[10px] text-slate-400 pt-1 border-t border-slate-100">
                        <span className="truncate">By {notice.createdBy}</span>
                        
                        <div className="flex items-center gap-2">
                          {notice.attachmentURL && (
                            <span className="text-blue-600 font-bold flex items-center gap-0.5">
                              <FileText className="w-3 h-3" /> Attachment
                            </span>
                          )}
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteLocally(notice.id);
                            }}
                            title="Delete notification locally"
                            className="p-1 hover:bg-slate-100 text-slate-400 hover:text-red-600 rounded-md transition cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>

                    </div>
                  );
                })
              )}
            </div>

          </div>
        </div>
      )}

      {/* FULL NOTICE DETAIL MODAL */}
      {selectedNotice && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center z-50 p-4 animate-fade-in">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 space-y-4 max-h-[90vh] overflow-y-auto">
            
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <span className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider ${
                selectedNotice.priority === 'emergency'
                  ? 'bg-red-100 text-red-700'
                  : selectedNotice.priority === 'important'
                  ? 'bg-amber-100 text-amber-800'
                  : 'bg-blue-100 text-blue-800'
              }`}>
                {selectedNotice.priority === 'emergency' ? '🔴 Emergency Notice' : selectedNotice.priority === 'important' ? '🟠 Important Notice' : '🔵 Official Announcement'}
              </span>

              <button
                onClick={() => setSelectedNotice(null)}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-2">
              <h3 className="text-base font-black text-slate-900 tracking-tight leading-snug">
                {selectedNotice.title}
              </h3>
              <div className="flex items-center gap-2 text-[11px] text-slate-500 font-medium">
                <Clock className="w-3.5 h-3.5 text-slate-400" />
                <span>Published on {new Date(selectedNotice.createdAt).toLocaleString()}</span>
                <span>• By {selectedNotice.createdBy}</span>
              </div>
            </div>

            <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
              <p className="text-xs text-slate-800 whitespace-pre-wrap leading-relaxed">
                {selectedNotice.description}
              </p>
            </div>

            {/* Attachment Download */}
            {selectedNotice.attachmentURL && (
              <div className="pt-2">
                {selectedNotice.attachmentType === 'image' ? (
                  <div className="space-y-2">
                    <img
                      src={selectedNotice.attachmentURL}
                      alt="Attachment"
                      className="rounded-xl border border-slate-200 max-h-60 w-full object-cover"
                      referrerPolicy="no-referrer"
                    />
                    <a
                      href={selectedNotice.attachmentURL}
                      download={selectedNotice.attachmentName || 'notice-attachment.jpg'}
                      className="inline-flex items-center gap-1.5 bg-slate-900 text-white px-4 py-2 rounded-xl text-xs font-bold hover:bg-slate-800 transition"
                    >
                      <Download className="w-4 h-4" /> Download Attached Image
                    </a>
                  </div>
                ) : (
                  <a
                    href={selectedNotice.attachmentURL}
                    download={selectedNotice.attachmentName || 'notice-document.pdf'}
                    className="inline-flex items-center gap-2 bg-slate-900 text-white px-4 py-2.5 rounded-xl text-xs font-bold hover:bg-slate-800 transition shadow-xs"
                  >
                    <FileText className="w-4 h-4 text-red-400" />
                    <span>Download Attached PDF ({selectedNotice.attachmentName || 'Official Document'})</span>
                    <Download className="w-4 h-4 ml-1 text-slate-300" />
                  </a>
                )}
              </div>
            )}

            <div className="flex justify-end pt-3 border-t border-slate-100">
              <button
                onClick={() => setSelectedNotice(null)}
                className="bg-slate-900 hover:bg-slate-800 text-white font-bold px-5 py-2 rounded-xl text-xs cursor-pointer"
              >
                Close Notice
              </button>
            </div>

          </div>
        </div>
      )}
    </>
  );
}
