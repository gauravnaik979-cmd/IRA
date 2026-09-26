import React, { useState, useEffect, useRef } from 'react';
import { Student, Attendance, Hostel, MealSession, DailyMealReport } from '../types';
import { 
  CheckCircle2, 
  RotateCcw, 
  Utensils, 
  Moon, 
  ShieldCheck, 
  Camera, 
  AlertCircle, 
  QrCode, 
  RefreshCw, 
  Users, 
  IndianRupee, 
  Clock, 
  Keyboard,
  Building2,
  Check,
  Play,
  Lock,
  FileText,
  Download,
  Printer,
  X,
  Sliders,
  CheckSquare,
  BarChart2,
  Calendar,
  UserCheck
} from 'lucide-react';
import { Html5Qrcode, Html5QrcodeSupportedFormats } from 'html5-qrcode';
import { 
  subscribeToMealSession, 
  openMealSession, 
  closeMealSession, 
  prepareNextMealSession 
} from '../services/mealSessionService';

interface AttendanceCorrectionProps {
  students: Student[];
  attendance: Attendance[];
  hostels?: Hostel[];
  onRecordAttendance: (
    studentId: string, 
    type: 'hostel' | 'lunch' | 'dinner', 
    status: 'present' | 'absent' | 'leave', 
    recordedBy: 'scanner' | 'manual',
    notes?: string
  ) => Promise<any>;
  onDeleteAttendance?: (attendanceId: string, reason?: string) => Promise<void>;
}

export default function AttendanceCorrection({
  students,
  attendance,
  hostels = [],
  onRecordAttendance,
  onDeleteAttendance
}: AttendanceCorrectionProps) {
  // Real-time Meal Session Control State
  const [session, setSession] = useState<MealSession>({
    id: 'current',
    currentMeal: 'Lunch',
    status: 'NOT_STARTED',
    openedAt: null,
    closedAt: null,
    openedBy: 'Hostel Superintendent',
    date: new Date().toISOString().split('T')[0]
  });

  // Local state for active meal mode ('lunch' | 'dinner')
  const [mealMode, setMealMode] = useState<'lunch' | 'dinner'>('lunch');
  const mealModeRef = useRef<'lunch' | 'dinner'>('lunch');
  const sessionRef = useRef<MealSession>(session);

  // Modals and Dialogs
  const [showOpenConfirm, setShowOpenConfirm] = useState(false);
  const [showCloseConfirm, setShowCloseConfirm] = useState(false);
  const [showReportModal, setShowReportModal] = useState(false);
  const [latestReport, setLatestReport] = useState<DailyMealReport | null>(null);
  const [isProcessingAction, setIsProcessingAction] = useState(false);

  // Subscribe to Firestore mealSessions/current
  useEffect(() => {
    const unsub = subscribeToMealSession((updatedSession) => {
      setSession(updatedSession);
      sessionRef.current = updatedSession;
      if (updatedSession.currentMeal) {
        const mode = updatedSession.currentMeal.toLowerCase() === 'dinner' ? 'dinner' : 'lunch';
        setMealMode(mode);
        mealModeRef.current = mode;
      }
    });
    return () => unsub();
  }, []);

  // Sync mealModeRef
  useEffect(() => {
    mealModeRef.current = mealMode;
  }, [mealMode]);

  // Camera & Scanner State
  const [cameraActive, setCameraActive] = useState<boolean>(false);
  const [cameraError, setCameraError] = useState<string>('');
  const [warningMessage, setWarningMessage] = useState<string>('');
  const [hardwareMode, setHardwareMode] = useState<boolean>(false);
  const [availableCameras, setAvailableCameras] = useState<Array<{ id: string; label: string }>>([]);
  const [selectedCameraId, setSelectedCameraId] = useState<string>('');

  // Toast Notification
  const [successToast, setSuccessToast] = useState<{
    studentName: string;
    mealLabel: 'Lunch' | 'Dinner';
    timeStr: string;
  } | null>(null);

  // Undo tracking per scan
  const [undoingIds, setUndoingIds] = useState<Record<string, boolean>>({});

  // Memory maps & refs
  const studentMapRef = useRef<Map<string, Student>>(new Map());
  const lastScansRef = useRef<Record<string, number>>({});
  const html5QrcodeRef = useRef<Html5Qrcode | null>(null);
  const isTransitioningRef = useRef<boolean>(false);
  const keyBufferRef = useRef<string>('');
  const keyTimeoutRef = useRef<any>(null);

  // Preload student profiles
  useEffect(() => {
    const map = new Map<string, Student>();
    students.forEach(s => {
      if (!s) return;
      if (s.id) map.set(s.id.toLowerCase(), s);
      if (s.qrId) map.set(s.qrId.toLowerCase(), s);
      if (s.rollNumber) {
        map.set(s.rollNumber.toLowerCase(), s);
        map.set(`qr-${s.rollNumber.toLowerCase()}`, s);
      }
    });
    studentMapRef.current = map;
  }, [students]);

  // USB/Bluetooth Barcode Scanner Hardware Listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const targetTag = (e.target as HTMLElement)?.tagName?.toLowerCase();
      if (targetTag === 'input' || targetTag === 'textarea' || targetTag === 'select') {
        return;
      }

      if (e.key === 'Enter') {
        const code = keyBufferRef.current.trim();
        keyBufferRef.current = '';
        if (code.length >= 3) {
          setHardwareMode(true);
          handleDecodedText(code);
        }
      } else if (e.key.length === 1) {
        keyBufferRef.current += e.key;
        clearTimeout(keyTimeoutRef.current);
        keyTimeoutRef.current = setTimeout(() => {
          keyBufferRef.current = '';
        }, 100);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      clearTimeout(keyTimeoutRef.current);
    };
  }, [students]);

  // Audio Feedback
  const playBeep = (type: 'success' | 'error') => {
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);

      if (type === 'success') {
        osc.type = 'sine';
        osc.frequency.setValueAtTime(880, ctx.currentTime);
        gain.gain.setValueAtTime(0.12, ctx.currentTime);
        osc.start();
        osc.stop(ctx.currentTime + 0.1);

        const osc2 = ctx.createOscillator();
        const gain2 = ctx.createGain();
        osc2.connect(gain2);
        gain2.connect(ctx.destination);
        osc2.type = 'sine';
        osc2.frequency.setValueAtTime(1320, ctx.currentTime + 0.11);
        gain2.gain.setValueAtTime(0.12, ctx.currentTime + 0.11);
        osc2.start(ctx.currentTime + 0.11);
        osc2.stop(ctx.currentTime + 0.22);
      } else {
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(180, ctx.currentTime);
        gain.gain.setValueAtTime(0.15, ctx.currentTime);
        osc.start();
        osc.stop(ctx.currentTime + 0.25);
      }
    } catch (e) {
      console.warn('Audio feedback failed:', e);
    }
  };

  // Undo Handler
  const handleUndo = async (attendanceId: string) => {
    if (!onDeleteAttendance) return;
    setUndoingIds(prev => ({ ...prev, [attendanceId]: true }));
    try {
      await onDeleteAttendance(attendanceId, 'Superintendent Undo');
      playBeep('success');
    } catch (err: any) {
      console.error('Failed to undo scan:', err);
    } finally {
      setUndoingIds(prev => {
        const next = { ...prev };
        delete next[attendanceId];
        return next;
      });
    }
  };

  // Decode QR Text
  const handleDecodedText = async (text: string) => {
    const clean = text.trim().toLowerCase();
    if (!clean) return;

    // Check Session Lock Rule FIRST
    const curSession = sessionRef.current;
    if (curSession.status !== 'OPEN') {
      playBeep('error');
      setCameraError('🔴 Meal Session Closed. Attendance is currently locked. Please contact the Hostel Superintendent.');
      setTimeout(() => setCameraError(''), 4000);
      return;
    }

    const selectedMode = mealModeRef.current; // 'lunch' or 'dinner'
    const mealLabel = selectedMode === 'lunch' ? 'Lunch' : 'Dinner';

    // Verify session meal matches selected mode
    if (curSession.currentMeal && curSession.currentMeal.toLowerCase() !== selectedMode) {
      playBeep('error');
      setCameraError(`🔴 Active Session is for ${curSession.currentMeal}. Please switch mode.`);
      setTimeout(() => setCameraError(''), 4000);
      return;
    }

    const now = Date.now();
    // 5s duplicate protection
    const lastTime = lastScansRef.current[clean];
    if (lastTime && (now - lastTime < 5000)) {
      setWarningMessage('Duplicate scan prevented. 5s protection active.');
      setTimeout(() => setWarningMessage(''), 2500);
      return;
    }

    // Lookup student
    const matched = studentMapRef.current.get(clean) || 
      students.find(s => 
        (s.qrId && s.qrId.toLowerCase() === clean) ||
        (s.rollNumber && s.rollNumber.toLowerCase() === clean) ||
        (s.id && s.id.toLowerCase() === clean) ||
        (clean.startsWith('qr-') && s.rollNumber && s.rollNumber.toLowerCase() === clean.slice(3))
      );

    if (!matched) {
      playBeep('error');
      setCameraError(`Unregistered Student QR Code (${text.trim()})`);
      setTimeout(() => setCameraError(''), 3000);
      return;
    }

    setCameraError('');
    setWarningMessage('');

    const formattedTime = new Date().toLocaleTimeString([], { 
      hour: '2-digit', 
      minute: '2-digit', 
      second: '2-digit' 
    });

    try {
      await onRecordAttendance(
        matched.id,
        selectedMode,
        matched.hostelStatus === 'leave' ? 'leave' : 'present',
        'scanner',
        `Controlled Meal Session [${mealLabel}]`
      );

      lastScansRef.current[clean] = now;
      if (matched.rollNumber) lastScansRef.current[matched.rollNumber.toLowerCase()] = now;
      if (matched.qrId) lastScansRef.current[matched.qrId.toLowerCase()] = now;

      playBeep('success');

      setSuccessToast({
        studentName: matched.name,
        mealLabel: mealLabel,
        timeStr: formattedTime
      });

      setTimeout(() => {
        setSuccessToast(null);
      }, 1000);

    } catch (err: any) {
      console.error('[Scan Transaction Failed]', err);
      playBeep('error');

      let errorMessage = 'Attendance not saved. Please scan again.';
      if (err?.message?.includes('Meal Session Closed')) {
        errorMessage = err.message;
      } else if (err?.message?.includes('Ledger Update Failed')) {
        errorMessage = 'Ledger Update Failed';
      } else if (err?.message?.includes('Data Sync Failed')) {
        errorMessage = 'Data Sync Failed';
      }

      setCameraError(errorMessage);
      setTimeout(() => setCameraError(''), 4000);
    }
  };

  // Stop Camera
  const stopCamera = async () => {
    if (html5QrcodeRef.current) {
      try {
        if (html5QrcodeRef.current.isScanning) {
          await html5QrcodeRef.current.stop();
        }
        await html5QrcodeRef.current.clear();
      } catch (err) {
        console.warn('Camera cleanup note:', err);
      }
      html5QrcodeRef.current = null;
    }
    setCameraActive(false);
  };

  // Start Camera
  const startCamera = async (overrideCameraId?: string) => {
    if (isTransitioningRef.current) return;
    isTransitioningRef.current = true;

    await stopCamera();
    setCameraError('');

    const containerId = 'gov-qr-viewport';
    const container = document.getElementById(containerId);
    if (!container) {
      isTransitioningRef.current = false;
      return;
    }

    try {
      const scanner = new Html5Qrcode(containerId, {
        formatsToSupport: [Html5QrcodeSupportedFormats.QR_CODE],
        verbose: false
      });
      html5QrcodeRef.current = scanner;

      try {
        const devices = await Html5Qrcode.getCameras();
        if (devices && devices.length > 0) {
          setAvailableCameras(devices.map(d => ({ id: d.id, label: d.label || `Camera ${d.id}` })));
        }
      } catch (e) {
        console.warn('Could not enumerate cameras:', e);
      }

      const config = {
        fps: 25,
        qrbox: (viewfinderWidth: number, viewfinderHeight: number) => ({
          width: Math.min(viewfinderWidth, viewfinderHeight) * 0.85,
          height: Math.min(viewfinderWidth, viewfinderHeight) * 0.85
        }),
        aspectRatio: 1.0,
        disableFlip: true,
        experimentalFeatures: {
          useBarCodeDetectorIfSupported: true
        }
      };

      const handleSuccess = (decodedText: string) => {
        handleDecodedText(decodedText);
      };

      const camToUse = overrideCameraId || selectedCameraId || localStorage.getItem('gov_qr_camera_id');

      if (camToUse) {
        await scanner.start(camToUse, config, handleSuccess, () => {});
      } else {
        try {
          await scanner.start({ facingMode: 'environment' }, config, handleSuccess, () => {});
        } catch (envErr) {
          try {
            await scanner.start({ facingMode: 'user' }, config, handleSuccess, () => {});
          } catch (userErr) {
            const devices = await Html5Qrcode.getCameras();
            if (devices && devices.length > 0) {
              await scanner.start(devices[0].id, config, handleSuccess, () => {});
            } else {
              throw userErr;
            }
          }
        }
      }

      setCameraActive(true);
    } catch (err: any) {
      console.error('Camera startup error:', err);
      setCameraError('Unable to access camera. Please check permissions.');
    } finally {
      isTransitioningRef.current = false;
    }
  };

  // Manage camera auto-start/stop according to session status
  useEffect(() => {
    if (session.status === 'OPEN') {
      startCamera();
    } else {
      stopCamera();
    }
    return () => {
      stopCamera();
    };
  }, [session.status]);

  // Statistics Calculations
  const todayStr = new Date().toISOString().split('T')[0];
  const todayAttendance = attendance.filter(a => a.date === todayStr);

  const todayLunchCount = todayAttendance.filter(a => a.type === 'lunch' && a.status === 'present').length;
  const todayDinnerCount = todayAttendance.filter(a => a.type === 'dinner' && a.status === 'present').length;

  const activeStudents = students.filter(s => s.messStatus !== 'inactive');
  const todayMealScannedIds = new Set(
    todayAttendance
      .filter(a => a.type === mealMode && a.status === 'present')
      .map(a => a.studentId)
  );
  
  const currentMealScannedCount = mealMode === 'lunch' ? todayLunchCount : todayDinnerCount;
  const totalActiveStudentsCount = activeStudents.length || 1;
  const pendingStudentsCount = Math.max(0, activeStudents.length - todayMealScannedIds.size);
  const progressPercent = Math.min(100, Math.round((currentMealScannedCount / totalActiveStudentsCount) * 100));

  const todayMessRevenue = (todayLunchCount * 35) + (todayDinnerCount * 35);

  const recentScans = [...todayAttendance]
    .filter(a => a.type === 'lunch' || a.type === 'dinner')
    .sort((a, b) => (b.time || '').localeCompare(a.time || ''))
    .slice(0, 10);

  // Workflow Handlers
  const handleConfirmOpen = async () => {
    setIsProcessingAction(true);
    try {
      const meal = mealMode === 'lunch' ? 'Lunch' : 'Dinner';
      await openMealSession(meal, 'Hostel Superintendent');
      setShowOpenConfirm(false);
      playBeep('success');
    } catch (err: any) {
      console.error('Failed to open meal session:', err);
      alert('Failed to open meal session. Please try again.');
    } finally {
      setIsProcessingAction(false);
    }
  };

  const handleConfirmClose = async () => {
    setIsProcessingAction(true);
    try {
      const meal = mealMode === 'lunch' ? 'Lunch' : 'Dinner';
      const report = await closeMealSession(meal, 'Hostel Superintendent', {
        lunchCount: todayLunchCount,
        dinnerCount: todayDinnerCount,
        pendingStudents: pendingStudentsCount,
        totalRevenue: todayMessRevenue
      });
      setLatestReport(report);
      setShowCloseConfirm(false);
      setShowReportModal(true); // Automatically show summary/report
      playBeep('success');
    } catch (err: any) {
      console.error('Failed to close meal session:', err);
      alert('Failed to close meal session. Please try again.');
    } finally {
      setIsProcessingAction(false);
    }
  };

  const handleOpenNextMeal = async () => {
    setIsProcessingAction(true);
    try {
      const nextMeal = mealMode === 'lunch' ? 'Dinner' : 'Lunch';
      await prepareNextMealSession(nextMeal, 'Hostel Superintendent');
      setMealMode(nextMeal.toLowerCase() as 'lunch' | 'dinner');
      playBeep('success');
    } catch (err: any) {
      console.error('Failed to switch next meal:', err);
    } finally {
      setIsProcessingAction(false);
    }
  };

  // Export CSV Excel
  const handleExportExcel = () => {
    const meal = mealMode === 'lunch' ? 'Lunch' : 'Dinner';
    const csvContent = [
      ['IRA HOSTEL - MEAL SESSION REPORT'],
      ['Date', todayStr],
      ['Meal Session', meal],
      ['Session Status', session.status],
      ['Opened At', session.openedAt ? new Date(session.openedAt).toLocaleTimeString() : 'N/A'],
      ['Closed At', session.closedAt ? new Date(session.closedAt).toLocaleTimeString() : 'N/A'],
      ['Opened By', session.openedBy || 'Hostel Superintendent'],
      ['Closed By', session.closedBy || 'N/A'],
      ['Total Active Students', activeStudents.length],
      ['Scanned Boarders', currentMealScannedCount],
      ['Pending Boarders', pendingStudentsCount],
      ['Session Revenue (INR)', (currentMealScannedCount * 35)],
      [],
      ['Roll Number', 'Student Name', 'Room', 'Scan Time', 'Status']
    ];

    todayAttendance
      .filter(a => a.type === mealMode && a.status === 'present')
      .forEach(a => {
        csvContent.push([
          a.rollNumber || '',
          a.studentName || '',
          a.roomNumber || '',
          a.time || '',
          a.status || ''
        ]);
      });

    const csvString = csvContent.map(row => row.join(',')).join('\n');
    const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `Meal_Report_${todayStr}_${meal}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Export Printable PDF
  const handleExportPDF = () => {
    window.print();
  };

  // Time format helpers
  const formatTimeStr = (iso?: string | null) => {
    if (!iso) return 'Not Recorded';
    try {
      return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true });
    } catch {
      return iso;
    }
  };

  const calculateDuration = (startIso?: string | null, endIso?: string | null) => {
    if (!startIso) return '0 Mins';
    const start = new Date(startIso).getTime();
    const end = endIso ? new Date(endIso).getTime() : Date.now();
    const diffMins = Math.max(1, Math.round((end - start) / (1000 * 60)));
    if (diffMins < 60) return `${diffMins} Minutes`;
    const hours = Math.floor(diffMins / 60);
    const mins = diffMins % 60;
    return `${hours}h ${mins}m`;
  };

  return (
    <div className="w-full max-w-6xl mx-auto space-y-6 pb-12 animate-fade-in font-sans text-slate-900 print:p-0">
      
      {/* 1. Header Section & Meal Session Control Panel */}
      <div className="bg-white text-slate-900 rounded-2xl p-5 border border-slate-200 shadow-sm space-y-3.5">
        
        {/* Title Bar & Status Badges */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-slate-100 pb-3.5">
          <div>
            <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-700 uppercase tracking-wider mb-0.5">
              <Building2 className="w-3.5 h-3.5 text-emerald-600" />
              <span>Odisha Government Hostels • IRA Mess Operations</span>
            </div>
            <h1 className="text-2xl font-black tracking-tight text-slate-900">
              Mess Attendance
            </h1>
            <p className="text-xs font-medium text-slate-500 mt-0.5">
              Digital QR Attendance System & Real-Time Monthly Mess Ledger
            </p>
          </div>

          {/* Current Meal & Session Status Badges */}
          <div className="flex flex-wrap items-center gap-2 shrink-0">
            {/* Meal Mode Badge */}
            <div className={`px-3 py-1.5 rounded-xl font-bold text-xs flex items-center gap-1.5 border ${
              mealMode === 'lunch'
                ? 'bg-amber-50 text-amber-900 border-amber-200'
                : 'bg-indigo-50 text-indigo-900 border-indigo-200'
            }`}>
              <span className="text-xs">{mealMode === 'lunch' ? '🟢' : '🌙'}</span>
              <span className="uppercase tracking-wide text-[11px]">{mealMode === 'lunch' ? 'Lunch Mode' : 'Dinner Mode'}</span>
            </div>

            {/* Session Status Badge */}
            <div className={`px-3 py-1.5 rounded-xl font-bold text-xs flex items-center gap-1.5 border uppercase tracking-wide text-[11px] ${
              session.status === 'OPEN'
                ? 'bg-emerald-50 text-emerald-800 border-emerald-200/80 animate-pulse'
                : session.status === 'CLOSED'
                ? 'bg-rose-50 text-rose-800 border-rose-200/80'
                : 'bg-amber-50 text-amber-800 border-amber-200/80'
            }`}>
              <span className="text-xs">
                {session.status === 'OPEN' ? '🟢' : session.status === 'CLOSED' ? '🔴' : '🟡'}
              </span>
              <span>{session.status === 'OPEN' ? 'Open' : session.status === 'CLOSED' ? 'Closed' : 'Not Started'}</span>
            </div>
          </div>
        </div>

        {/* Compact Details & Action Buttons Bar */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 bg-slate-50/80 rounded-xl p-3 sm:px-4 border border-slate-200/80">
          
          {/* Metadata Info in Single Compact Row */}
          <div className="flex flex-wrap items-center gap-x-5 gap-y-1.5 text-xs">
            <div className="flex items-center gap-1.5">
              <span className="text-slate-400 font-semibold text-[11px] uppercase tracking-wider">Open:</span>
              <span className="font-mono font-bold text-slate-800">{formatTimeStr(session.openedAt)}</span>
            </div>
            <span className="text-slate-300 hidden sm:inline">•</span>
            <div className="flex items-center gap-1.5">
              <span className="text-slate-400 font-semibold text-[11px] uppercase tracking-wider">Close:</span>
              <span className="font-mono font-bold text-slate-800">
                {session.status === 'CLOSED' ? formatTimeStr(session.closedAt) : session.status === 'OPEN' ? 'Active' : '—'}
              </span>
            </div>
            <span className="text-slate-300 hidden sm:inline">•</span>
            <div className="flex items-center gap-1.5">
              <span className="text-slate-400 font-semibold text-[11px] uppercase tracking-wider">Duration:</span>
              <span className="font-mono font-bold text-slate-800">
                {session.status === 'NOT_STARTED' ? '0m' : calculateDuration(session.openedAt, session.closedAt)}
              </span>
            </div>
            <span className="text-slate-300 hidden sm:inline">•</span>
            <div className="flex items-center gap-1.5">
              <span className="text-slate-400 font-semibold text-[11px] uppercase tracking-wider">Operator:</span>
              <span className="font-bold text-slate-800 truncate max-w-[150px]">{session.openedBy || 'Superintendent'}</span>
            </div>
          </div>

          {/* Action Buttons Aligned Right */}
          <div className="flex flex-wrap items-center gap-2 shrink-0 pt-2 lg:pt-0 border-t lg:border-t-0 border-slate-200">
            {session.status === 'NOT_STARTED' && (
              <button
                type="button"
                onClick={() => setShowOpenConfirm(true)}
                className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-lg flex items-center gap-1.5 shadow-sm transition cursor-pointer active:scale-95"
              >
                <Play className="w-3.5 h-3.5 fill-current" />
                <span>Open {mealMode === 'lunch' ? 'Lunch' : 'Dinner'}</span>
              </button>
            )}

            {session.status === 'OPEN' && (
              <>
                <button
                  type="button"
                  onClick={() => setShowCloseConfirm(true)}
                  className="px-3.5 py-1.5 bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs rounded-lg flex items-center gap-1.5 shadow-sm transition cursor-pointer active:scale-95"
                >
                  <Lock className="w-3.5 h-3.5" />
                  <span>Close Meal</span>
                </button>

                <button
                  type="button"
                  onClick={() => setShowReportModal(true)}
                  className="px-3 py-1.5 bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 font-bold text-xs rounded-lg flex items-center gap-1.5 shadow-sm transition cursor-pointer"
                >
                  <Sliders className="w-3.5 h-3.5 text-amber-600" />
                  <span>Interim Report</span>
                </button>
              </>
            )}

            {session.status === 'CLOSED' && (
              <>
                <button
                  type="button"
                  onClick={() => setShowReportModal(true)}
                  className="px-3 py-1.5 bg-white hover:bg-slate-100 text-slate-800 border border-slate-300 font-bold text-xs rounded-lg flex items-center gap-1.5 shadow-sm transition cursor-pointer"
                >
                  <FileText className="w-3.5 h-3.5 text-emerald-600" />
                  <span>View Summary</span>
                </button>

                <button
                  type="button"
                  onClick={handleExportPDF}
                  className="px-3 py-1.5 bg-white hover:bg-slate-100 text-slate-800 border border-slate-300 font-bold text-xs rounded-lg flex items-center gap-1.5 shadow-sm transition cursor-pointer"
                >
                  <Printer className="w-3.5 h-3.5 text-slate-600" />
                  <span>PDF</span>
                </button>

                <button
                  type="button"
                  onClick={handleExportExcel}
                  className="px-3 py-1.5 bg-white hover:bg-slate-100 text-slate-800 border border-slate-300 font-bold text-xs rounded-lg flex items-center gap-1.5 shadow-sm transition cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5 text-slate-600" />
                  <span>Excel</span>
                </button>

                <button
                  type="button"
                  onClick={handleOpenNextMeal}
                  className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-lg flex items-center gap-1.5 shadow-sm transition cursor-pointer active:scale-95"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>Open {mealMode === 'lunch' ? 'Dinner' : 'Lunch'}</span>
                </button>
              </>
            )}
          </div>
        </div>

        {/* Live Session Progress Bar (Visible during OPEN session) */}
        {session.status === 'OPEN' && (
          <div className="bg-slate-50 rounded-xl p-3 border border-slate-200/80 space-y-1.5">
            <div className="flex items-center justify-between text-xs font-bold">
              <span className="text-slate-700 flex items-center gap-1.5">
                <BarChart2 className="w-4 h-4 text-emerald-600" />
                <span>Today's Attendance Progress ({mealMode === 'lunch' ? 'Lunch' : 'Dinner'})</span>
              </span>
              <span className="text-emerald-700 font-mono">
                {currentMealScannedCount} / {totalActiveStudentsCount} Students ({progressPercent}%)
              </span>
            </div>
            <div className="w-full h-2.5 bg-slate-200 rounded-full overflow-hidden p-0.5 border border-slate-200">
              <div 
                className="h-full bg-emerald-500 rounded-full transition-all duration-500 shadow-sm"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
          </div>
        )}

      </div>

      {/* 2. Four Compact Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Today's Lunch Count */}
        <div className="bg-white border border-slate-200/80 rounded-2xl p-4.5 shadow-sm hover:shadow-md transition">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-bold uppercase tracking-wider">Today's Lunch</span>
            <div className="p-2 rounded-xl bg-amber-50 text-amber-600">
              <Utensils className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black text-slate-900 tracking-tight">{todayLunchCount}</div>
          <p className="text-[11px] font-semibold text-slate-400 mt-1">Verified Boarder Scans</p>
        </div>

        {/* Today's Dinner Count */}
        <div className="bg-white border border-slate-200/80 rounded-2xl p-4.5 shadow-sm hover:shadow-md transition">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-bold uppercase tracking-wider">Today's Dinner</span>
            <div className="p-2 rounded-xl bg-indigo-50 text-indigo-600">
              <Moon className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black text-slate-900 tracking-tight">{todayDinnerCount}</div>
          <p className="text-[11px] font-semibold text-slate-400 mt-1">Verified Boarder Scans</p>
        </div>

        {/* Pending Students */}
        <div className="bg-white border border-slate-200/80 rounded-2xl p-4.5 shadow-sm hover:shadow-md transition">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-bold uppercase tracking-wider">Pending ({mealMode === 'lunch' ? 'Lunch' : 'Dinner'})</span>
            <div className="p-2 rounded-xl bg-rose-50 text-rose-600">
              <Users className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black text-slate-900 tracking-tight">{pendingStudentsCount}</div>
          <p className="text-[11px] font-semibold text-slate-400 mt-1">Remaining Mess Boarders</p>
        </div>

        {/* Today's Mess Revenue */}
        <div className="bg-white border border-slate-200/80 rounded-2xl p-4.5 shadow-sm hover:shadow-md transition">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-bold uppercase tracking-wider">Today's Revenue</span>
            <div className="p-2 rounded-xl bg-emerald-50 text-emerald-600">
              <IndianRupee className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black text-slate-900 tracking-tight">₹{todayMessRevenue}</div>
          <p className="text-[11px] font-semibold text-slate-400 mt-1">Calculated at ₹35/meal</p>
        </div>
      </div>

      {/* 3. Main Operational Grid: Scanner / Summary Card + Recent Activity Feed */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        
        {/* Left Column: Scanner Card or Meal Completed Card (lg:col-span-5) */}
        <div className="lg:col-span-5 bg-white border border-slate-200 rounded-3xl p-5 shadow-sm space-y-4">
          
          {session.status === 'CLOSED' ? (
            /* Dashboard Summary Card when Session is CLOSED */
            <div className="bg-slate-50 text-slate-900 rounded-2xl p-5 text-center space-y-3.5 border border-slate-200 shadow-sm my-1">
              <div className="w-11 h-11 rounded-2xl bg-emerald-100 text-emerald-700 border border-emerald-200 flex items-center justify-center mx-auto">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <div>
                <span className="px-3 py-1 bg-emerald-100 text-emerald-800 border border-emerald-200 rounded-full font-bold text-[10px] uppercase tracking-wider">
                  Meal Completed
                </span>
                <h3 className="text-base font-extrabold text-slate-900 mt-2">
                  {mealMode === 'lunch' ? 'Lunch' : 'Dinner'} Closed Successfully
                </h3>
                <p className="text-xs text-slate-500 mt-1">
                  Attendance is locked. Daily Meal Summary report generated.
                </p>
              </div>

              <div className="grid grid-cols-3 gap-2 bg-white p-3 rounded-xl border border-slate-200 text-xs shadow-xs">
                <div>
                  <div className="text-[10px] text-slate-400 font-bold uppercase">Served</div>
                  <div className="font-black text-slate-900 text-base mt-0.5">{currentMealScannedCount}</div>
                </div>
                <div>
                  <div className="text-[10px] text-slate-400 font-bold uppercase">Remaining</div>
                  <div className="font-black text-rose-600 text-base mt-0.5">{pendingStudentsCount}</div>
                </div>
                <div>
                  <div className="text-[10px] text-slate-400 font-bold uppercase">Revenue</div>
                  <div className="font-black text-emerald-700 text-base mt-0.5">₹{currentMealScannedCount * 35}</div>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setShowReportModal(true)}
                className="w-full py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl flex items-center justify-center gap-2 transition cursor-pointer shadow-sm"
              >
                <FileText className="w-4 h-4" />
                <span>View Full Summary Report</span>
              </button>
            </div>
          ) : session.status === 'NOT_STARTED' ? (
            /* Session NOT STARTED Card */
            <div className="bg-slate-50 border border-slate-200 rounded-2xl p-8 text-center space-y-4 my-2">
              <div className="w-12 h-12 rounded-2xl bg-amber-100 text-amber-700 border border-amber-200 flex items-center justify-center mx-auto">
                <Lock className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-black text-slate-900">
                  {mealMode === 'lunch' ? 'Lunch' : 'Dinner'} Session Not Started
                </h3>
                <p className="text-xs text-slate-500 mt-1">
                  Click "Open Meal" in the top bar to enable QR & hardware scanner recording.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowOpenConfirm(true)}
                className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-slate-950 font-black text-xs rounded-xl inline-flex items-center gap-2 shadow-md transition cursor-pointer"
              >
                <Play className="w-4 h-4 fill-slate-950" />
                <span>Open {mealMode === 'lunch' ? 'Lunch' : 'Dinner'} Session</span>
              </button>
            </div>
          ) : (
            /* OPEN Session Active QR Viewport */
            <>
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2">
                  <QrCode className="w-4 h-4 text-slate-700" />
                  <h2 className="text-sm font-extrabold text-slate-900 tracking-tight">QR Code Scanner</h2>
                </div>

                <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-extrabold bg-slate-100 text-slate-700 border border-slate-200">
                  <span className={`w-2 h-2 rounded-full ${cameraActive ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'}`} />
                  <span>{hardwareMode ? '🟢 Scanner Connected' : cameraActive ? '🟢 Camera Mode' : '⚪ Standby'}</span>
                </div>
              </div>

              {/* Viewport Frame */}
              <div className="relative bg-slate-950 rounded-2xl border-2 border-slate-900 overflow-hidden aspect-square flex items-center justify-center shadow-inner">
                <div id="gov-qr-viewport" className="w-full h-full object-cover"></div>

                {cameraActive && (
                  <div className="absolute inset-0 pointer-events-none flex flex-col items-center justify-center">
                    <div className="w-[75%] aspect-square border-2 border-dashed border-emerald-400/80 rounded-2xl relative shadow-[0_0_25px_rgba(16,185,129,0.2)]">
                      <div className="absolute top-0 left-0 w-5 h-5 border-t-4 border-l-4 border-emerald-400 rounded-tl-md" />
                      <div className="absolute top-0 right-0 w-5 h-5 border-t-4 border-r-4 border-emerald-400 rounded-tr-md" />
                      <div className="absolute bottom-0 left-0 w-5 h-5 border-b-4 border-l-4 border-emerald-400 rounded-bl-md" />
                      <div className="absolute bottom-0 right-0 w-5 h-5 border-b-4 border-r-4 border-emerald-400 rounded-br-md" />
                    </div>
                    <div className="mt-3 px-3 py-1 bg-slate-900/80 backdrop-blur-md rounded-full border border-slate-700 text-white font-semibold text-[11px] tracking-wide">
                      Waiting for Student QR...
                    </div>
                  </div>
                )}

                {!cameraActive && (
                  <div className="absolute inset-0 bg-slate-900 text-slate-300 p-6 flex flex-col items-center justify-center text-center space-y-3">
                    <Camera className="w-10 h-10 text-slate-500" />
                    <p className="text-xs font-extrabold text-white">
                      {cameraError || "Camera Standby"}
                    </p>
                    <p className="text-[11px] text-slate-400 max-w-xs">
                      {cameraError ? cameraError : "Click below to initialize lens or connect USB scanner."}
                    </p>
                    <button
                      onClick={() => startCamera()}
                      className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-xs font-bold transition cursor-pointer border border-slate-700 mt-1"
                    >
                      Start Scanner
                    </button>
                  </div>
                )}

                {warningMessage && (
                  <div className="absolute top-3 left-1/2 -translate-x-1/2 bg-amber-500 text-slate-950 font-black text-[11px] px-3 py-1.5 rounded-full shadow-lg border border-amber-300 animate-fade-in z-20">
                    {warningMessage}
                  </div>
                )}

                {cameraError && cameraActive && (
                  <div className="absolute top-3 left-1/2 -translate-x-1/2 bg-rose-600 text-white font-black text-[11px] px-3 py-1.5 rounded-full shadow-lg border border-rose-400 animate-fade-in z-20 text-center max-w-[90%]">
                    {cameraError}
                  </div>
                )}
              </div>

              {/* Hardware Info Footer */}
              <div className="flex items-center justify-between text-xs text-slate-500 pt-1">
                <div className="flex items-center gap-1.5 font-medium">
                  <Keyboard className="w-3.5 h-3.5 text-slate-400" />
                  <span>USB 2D Scanner Active</span>
                </div>

                {availableCameras.length > 1 && (
                  <select
                    value={selectedCameraId}
                    onChange={(e) => {
                      setSelectedCameraId(e.target.value);
                      localStorage.setItem('gov_qr_camera_id', e.target.value);
                      startCamera(e.target.value);
                    }}
                    className="text-[11px] font-semibold bg-slate-50 border border-slate-200 rounded-lg px-2 py-1 outline-none text-slate-700 cursor-pointer max-w-[150px] truncate"
                  >
                    <option value="">Default Lens</option>
                    {availableCameras.map(c => (
                      <option key={c.id} value={c.id}>{c.label}</option>
                    ))}
                  </select>
                )}
              </div>
            </>
          )}

        </div>

        {/* Right Column: Recent Activity Feed (lg:col-span-7) */}
        <div className="lg:col-span-7 bg-white border border-slate-200 rounded-3xl p-5 shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-slate-700" />
              <h2 className="text-sm font-extrabold text-slate-900 tracking-tight">Recent Scans Today</h2>
            </div>
            <span className="text-[11px] font-extrabold text-slate-400 font-mono">
              Showing Last {recentScans.length} Scans
            </span>
          </div>

          {recentScans.length > 0 ? (
            <div className="divide-y divide-slate-100 max-h-[420px] overflow-y-auto pr-1 space-y-1">
              {recentScans.map((record) => {
                const student = students.find(s => s.id === record.studentId);
                const isUndoing = undoingIds[record.id];

                return (
                  <div key={record.id} className="py-2.5 flex items-center justify-between gap-3 hover:bg-slate-50/80 px-2 rounded-2xl transition">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-10 h-10 rounded-xl overflow-hidden border border-slate-200 bg-slate-100 flex items-center justify-center shrink-0">
                        {student?.photoURL || student?.photoUrl ? (
                          <img 
                            src={student.photoURL || student.photoUrl} 
                            alt={record.studentName}
                            className="w-full h-full object-cover"
                            referrerPolicy="no-referrer"
                            onError={(e) => {
                              (e.target as HTMLImageElement).src = 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 24 24" fill="%23cbd5e1" stroke="%23475569" stroke-width="1.5"><circle cx="12" cy="7" r="4"/><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/></svg>';
                            }}
                          />
                        ) : (
                          <span className="text-xs font-black text-slate-600">
                            {(record.studentName || 'S').charAt(0)}
                          </span>
                        )}
                      </div>

                      <div className="min-w-0">
                        <div className="text-xs font-black text-slate-900 truncate">
                          {record.studentName}
                        </div>
                        <div className="text-[11px] font-mono text-slate-500 font-medium truncate">
                          {record.rollNumber} • Room {record.roomNumber || student?.roomNumber || '—'}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2.5 shrink-0">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase border ${
                        record.type === 'lunch' 
                          ? 'bg-amber-50 text-amber-800 border-amber-200' 
                          : 'bg-indigo-50 text-indigo-800 border-indigo-200'
                      }`}>
                        {record.type}
                      </span>

                      <span className="text-[11px] font-mono text-slate-500 font-semibold">
                        {record.time}
                      </span>

                      <span className="inline-flex items-center gap-1 text-[11px] font-extrabold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                        <Check className="w-3 h-3 text-emerald-600" />
                        <span>Recorded</span>
                      </span>

                      {onDeleteAttendance && session.status === 'OPEN' && (
                        <button
                          type="button"
                          disabled={isUndoing}
                          onClick={() => handleUndo(record.id)}
                          title="Undo this scan"
                          className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition cursor-pointer disabled:opacity-50"
                        >
                          <RotateCcw className={`w-3.5 h-3.5 ${isUndoing ? 'animate-spin' : ''}`} />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="py-16 text-center text-slate-400 text-xs font-medium italic">
              No scans logged yet today. Point student QR code at scanner to begin logging attendance.
            </div>
          )}
        </div>
      </div>

      {/* 4. Small Green Toast Notification */}
      {successToast && (
        <div className="fixed bottom-6 right-6 z-50 bg-slate-950 text-white border-2 border-emerald-500 rounded-2xl px-4 py-3 shadow-2xl flex items-center gap-3 animate-slide-up">
          <div className="w-8 h-8 rounded-xl bg-emerald-500 text-slate-950 flex items-center justify-center shrink-0 font-black">
            <CheckCircle2 className="w-5 h-5 text-slate-950" />
          </div>
          <div>
            <div className="text-[11px] font-black uppercase tracking-wider text-emerald-400">
              ✓ Attendance Recorded
            </div>
            <div className="text-xs font-black text-white">{successToast.studentName}</div>
            <div className="text-[10px] text-slate-300 font-medium">
              {successToast.mealLabel} Recorded • {successToast.timeStr}
            </div>
          </div>
        </div>
      )}

      {/* 5. MODAL: Open Meal Confirmation */}
      {showOpenConfirm && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 space-y-5 border border-slate-200 shadow-2xl">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
                <Play className="w-5 h-5 fill-emerald-700" />
              </div>
              <div>
                <h3 className="text-lg font-black text-slate-900">
                  Open {mealMode === 'lunch' ? 'Lunch' : 'Dinner'} Session?
                </h3>
                <p className="text-xs text-slate-500">IRA Hostel Mess Control System</p>
              </div>
            </div>

            <div className="bg-slate-50 rounded-2xl p-4 border border-slate-200 space-y-2 text-xs text-slate-700">
              <div className="font-bold text-slate-900">Opening this session will:</div>
              <ul className="space-y-1.5 text-slate-600 font-medium">
                <li className="flex items-center gap-2">
                  <CheckSquare className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Enable QR attendance recording</span>
                </li>
                <li className="flex items-center gap-2">
                  <CheckSquare className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Enable USB & Bluetooth 2D Scanners</span>
                </li>
                <li className="flex items-center gap-2">
                  <CheckSquare className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Enable Mobile Back Camera Scanner</span>
                </li>
                <li className="flex items-center gap-2">
                  <CheckSquare className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Begin live monthly mess ledger sync</span>
                </li>
              </ul>
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setShowOpenConfirm(false)}
                disabled={isProcessingAction}
                className="px-4 py-2.5 text-slate-600 font-bold text-xs rounded-xl hover:bg-slate-100 transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmOpen}
                disabled={isProcessingAction}
                className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-slate-950 font-black text-xs rounded-xl transition cursor-pointer shadow-md disabled:opacity-50"
              >
                {isProcessingAction ? 'Opening...' : 'Open Meal Session'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 6. MODAL: Close Meal Confirmation */}
      {showCloseConfirm && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 space-y-5 border border-slate-200 shadow-2xl">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-rose-100 text-rose-700 flex items-center justify-center shrink-0">
                <Lock className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-lg font-black text-slate-900">
                  Close {mealMode === 'lunch' ? 'Lunch' : 'Dinner'} Session?
                </h3>
                <p className="text-xs text-slate-500">IRA Hostel Mess Control System</p>
              </div>
            </div>

            <div className="bg-slate-900 text-white rounded-2xl p-4 space-y-3 text-xs border border-slate-800">
              <div className="font-extrabold text-amber-400 uppercase tracking-wider text-[11px]">
                Today's Progress Summary
              </div>
              <div className="grid grid-cols-3 gap-2 text-center pt-1">
                <div className="bg-slate-950 p-2.5 rounded-xl border border-slate-800">
                  <div className="text-[10px] text-slate-400 font-bold">Students Scanned</div>
                  <div className="text-base font-black text-emerald-400 mt-0.5">{currentMealScannedCount}</div>
                </div>
                <div className="bg-slate-950 p-2.5 rounded-xl border border-slate-800">
                  <div className="text-[10px] text-slate-400 font-bold">Remaining</div>
                  <div className="text-base font-black text-rose-400 mt-0.5">{pendingStudentsCount}</div>
                </div>
                <div className="bg-slate-950 p-2.5 rounded-xl border border-slate-800">
                  <div className="text-[10px] text-slate-400 font-bold">Revenue</div>
                  <div className="text-base font-black text-amber-300 mt-0.5">₹{currentMealScannedCount * 35}</div>
                </div>
              </div>
              <p className="text-[11px] text-slate-400 italic pt-1">
                Closing will stop scanners, finalize attendance as read-only, and generate official report.
              </p>
            </div>

            <div className="flex items-center justify-end gap-3 pt-1">
              <button
                type="button"
                onClick={() => setShowCloseConfirm(false)}
                disabled={isProcessingAction}
                className="px-4 py-2.5 text-slate-600 font-bold text-xs rounded-xl hover:bg-slate-100 transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmClose}
                disabled={isProcessingAction}
                className="px-5 py-2.5 bg-rose-600 hover:bg-rose-500 text-white font-black text-xs rounded-xl transition cursor-pointer shadow-md disabled:opacity-50"
              >
                {isProcessingAction ? 'Finalizing...' : 'Close Meal Session'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 7. MODAL: Daily Meal Summary Report */}
      {showReportModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-white rounded-3xl max-w-2xl w-full p-6 sm:p-8 space-y-6 border border-slate-200 shadow-2xl max-h-[90vh] overflow-y-auto">
            
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-slate-200 pb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-emerald-100 text-emerald-800 flex items-center justify-center font-black">
                  <FileText className="w-5 h-5" />
                </div>
                <div>
                  <div className="text-[10px] font-black uppercase tracking-widest text-emerald-700">
                    Official Government Report
                  </div>
                  <h2 className="text-xl font-black text-slate-900">
                    Daily Meal Summary Report
                  </h2>
                </div>
              </div>
              <button
                onClick={() => setShowReportModal(false)}
                className="p-2 text-slate-400 hover:text-slate-900 rounded-xl hover:bg-slate-100 transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Printable Report Body */}
            <div className="space-y-6 text-slate-900">
              
              <div className="bg-slate-900 text-white rounded-2xl p-5 border border-slate-800 space-y-3">
                <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                  <div>
                    <h3 className="font-extrabold text-white text-sm">IRA Hostel Mess Operations</h3>
                    <p className="text-xs text-slate-400">GANGPUR_BOYS_HOSTEL • Odisha Govt Hostels</p>
                  </div>
                  <span className="px-3 py-1 bg-emerald-500/20 text-emerald-300 font-mono font-bold text-xs rounded-full border border-emerald-500/30">
                    {session.status === 'CLOSED' ? 'FINALIZED' : 'INTERIM REPORT'}
                  </span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs pt-1">
                  <div>
                    <span className="text-[10px] text-slate-400 font-bold uppercase">Date</span>
                    <div className="font-mono font-bold text-white">{todayStr}</div>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 font-bold uppercase">Meal Session</span>
                    <div className="font-mono font-bold text-amber-300 uppercase">{mealMode}</div>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 font-bold uppercase">Opened At</span>
                    <div className="font-mono font-bold text-white">{formatTimeStr(session.openedAt)}</div>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 font-bold uppercase">Closed At</span>
                    <div className="font-mono font-bold text-white">{formatTimeStr(session.closedAt)}</div>
                  </div>
                </div>
              </div>

              {/* Stat Summary Boxes */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
                <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-200">
                  <div className="text-[10px] font-bold text-slate-500 uppercase">Total Boarders</div>
                  <div className="text-xl font-black text-slate-900 mt-0.5">{totalActiveStudentsCount}</div>
                </div>
                <div className="bg-emerald-50 p-3.5 rounded-2xl border border-emerald-200">
                  <div className="text-[10px] font-bold text-emerald-800 uppercase">Boarders Served</div>
                  <div className="text-xl font-black text-emerald-900 mt-0.5">{currentMealScannedCount}</div>
                </div>
                <div className="bg-rose-50 p-3.5 rounded-2xl border border-rose-200">
                  <div className="text-[10px] font-bold text-rose-800 uppercase">Pending Boarders</div>
                  <div className="text-xl font-black text-rose-900 mt-0.5">{pendingStudentsCount}</div>
                </div>
                <div className="bg-amber-50 p-3.5 rounded-2xl border border-amber-200">
                  <div className="text-[10px] font-bold text-amber-800 uppercase">Total Revenue</div>
                  <div className="text-xl font-black text-amber-900 mt-0.5">₹{currentMealScannedCount * 35}</div>
                </div>
              </div>

              {/* Scanned Attendees Table Preview */}
              <div className="space-y-2">
                <div className="text-xs font-extrabold text-slate-900 flex items-center justify-between">
                  <span>Verified Attendees ({todayAttendance.filter(a => a.type === mealMode && a.status === 'present').length})</span>
                  <span className="text-[11px] text-slate-500 font-normal">Rate: ₹35 / meal</span>
                </div>
                
                <div className="border border-slate-200 rounded-2xl overflow-hidden max-h-52 overflow-y-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-100 text-slate-700 font-bold uppercase text-[10px] border-b border-slate-200">
                      <tr>
                        <th className="p-2.5">Roll No</th>
                        <th className="p-2.5">Student Name</th>
                        <th className="p-2.5">Room</th>
                        <th className="p-2.5">Time</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 font-medium">
                      {todayAttendance
                        .filter(a => a.type === mealMode && a.status === 'present')
                        .map(a => (
                          <tr key={a.id} className="hover:bg-slate-50">
                            <td className="p-2.5 font-mono text-slate-600">{a.rollNumber}</td>
                            <td className="p-2.5 font-bold text-slate-900">{a.studentName}</td>
                            <td className="p-2.5 text-slate-600">{a.roomNumber || '—'}</td>
                            <td className="p-2.5 font-mono text-slate-500">{a.time}</td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
              </div>

            </div>

            {/* Modal Actions */}
            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 pt-4">
              <button
                type="button"
                onClick={() => setShowReportModal(false)}
                className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition cursor-pointer"
              >
                Close View
              </button>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleExportPDF}
                  className="px-4 py-2.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-900 border border-indigo-200 font-bold text-xs rounded-xl flex items-center gap-1.5 transition cursor-pointer"
                >
                  <Printer className="w-4 h-4 text-indigo-600" />
                  <span>Print PDF</span>
                </button>

                <button
                  type="button"
                  onClick={handleExportExcel}
                  className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-slate-950 font-black text-xs rounded-xl flex items-center gap-1.5 transition cursor-pointer shadow-md"
                >
                  <Download className="w-4 h-4" />
                  <span>Export Excel</span>
                </button>
              </div>
            </div>

          </div>
        </div>
      )}

    </div>
  );
}
