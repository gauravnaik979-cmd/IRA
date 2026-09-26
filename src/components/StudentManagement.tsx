import React, { useState, useRef } from 'react';
import { Student, Hostel, Room } from '../types';
import { Search, UserPlus, FileUp, Edit2, Trash2, ArrowUpDown, Shuffle, Phone, ShieldCheck, CheckCircle2, AlertCircle, X, Download, Loader2, KeyRound, Camera, Upload, User, Image as ImageIcon, RefreshCw } from 'lucide-react';
import { auth } from '../lib/firebase';
import { sendPasswordResetEmail } from 'firebase/auth';
import { uploadStudentPhoto } from '../services/studentService';

interface StudentManagementProps {
  students: Student[];
  hostels: Hostel[];
  rooms: Room[];
  onUpsertStudent: (student: Student) => void;
  onDeleteStudent: (id: string) => void;
  onReallocateRoom: (studentId: string, hostel: string, room: string, bed: string) => void;
  onImportCSV: (csv: string) => Promise<boolean>;
}

export default function StudentManagement({
  students,
  hostels,
  rooms,
  onUpsertStudent,
  onDeleteStudent,
  onReallocateRoom,
  onImportCSV
}: StudentManagementProps) {
  
  // Search & Filtering States
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedHostel, setSelectedHostel] = useState('all');
  const [selectedDept, setSelectedDept] = useState('all');

  // Form States (Add/Edit)
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  
  const [name, setName] = useState('');
  const [rollNumber, setRollNumber] = useState('');
  const [department, setDepartment] = useState('');
  const [semester, setSemester] = useState('I');
  const [phone, setPhone] = useState('');
  const [guardianName, setGuardianName] = useState('');
  const [guardianPhone, setGuardianPhone] = useState('');
  const [hostelName, setHostelName] = useState(hostels[0]?.name || '');
  const [roomNumber, setRoomNumber] = useState('101');
  const [bedNumber, setBedNumber] = useState('A');
  const [messStatus, setMessStatus] = useState<'active' | 'inactive'>('active');

  // Photo & Camera States
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string>('');
  const [isCameraActive, setIsCameraActive] = useState<boolean>(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);

  // Form loading, error and dynamic credential popup states
  const [formLoading, setFormLoading] = useState(false);
  const [formError, setFormError] = useState('');
  const [createdCredentials, setCreatedCredentials] = useState<{ rollNumber: string; email: string; tempPass: string; name: string } | null>(null);
  const [copiedCreds, setCopiedCreds] = useState(false);

  // Room allocation helper states
  const [showAllocDrawer, setShowAllocDrawer] = useState<string | null>(null); // studentId
  const [allocHostel, setAllocHostel] = useState('');
  const [allocRoom, setAllocRoom] = useState('');
  const [allocBed, setAllocBed] = useState('A');

  // Bulk Import state
  const [showImport, setShowImport] = useState(false);
  const [csvContent, setCsvContent] = useState('');
  const [importStatus, setImportStatus] = useState<{ success?: boolean; text?: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Password reset helper states
  const [resetSuccessModal, setResetSuccessModal] = useState<{ name: string; rollNumber: string; tempPass: string } | null>(null);
  const [resetLoadingId, setResetLoadingId] = useState<string | null>(null);
  const [deleteLoadingId, setDeleteLoadingId] = useState<string | null>(null);

  const startCamera = async () => {
    try {
      setIsCameraActive(true);
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 640 } } 
      });
      mediaStreamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
    } catch (err) {
      console.error("Could not start camera:", err);
      alert("Camera access was denied or is unavailable. Please choose an image file from your device.");
      setIsCameraActive(false);
    }
  };

  const stopCamera = () => {
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach(track => track.stop());
      mediaStreamRef.current = null;
    }
    setIsCameraActive(false);
  };

  const captureCameraPhoto = () => {
    if (!videoRef.current) return;
    const canvas = document.createElement('canvas');
    canvas.width = 400;
    canvas.height = 400;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.drawImage(videoRef.current, 0, 0, 400, 400);
      const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
      setPhotoPreview(dataUrl);
      setPhotoFile(null);
    }
    stopCamera();
  };

  const handlePhotoFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setPhotoFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setPhotoPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleDeleteStudent = async (s: Student) => {
    if (!confirm(`Are you absolutely sure you want to delete ${s.name} from the records? This will vacate room ${s.roomNumber || 'unassigned'}.`)) {
      return;
    }
    setDeleteLoadingId(s.id);
    try {
      await onDeleteStudent(s.id);
      console.log(`Student ${s.name} (${s.id}) deleted successfully.`);
    } catch (err: any) {
      console.error("Failed to delete student:", err);
      alert(`Could not delete student ${s.name}: ${err?.message || err}`);
    } finally {
      setDeleteLoadingId(null);
    }
  };

  const handleResetPassword = async (student: Student) => {
    if (!confirm(`Are you sure you want to reset the password for ${student.name}? Their profile will be updated and they will be prompted to verify or update their password on next login.`)) {
      return;
    }

    setResetLoadingId(student.id);
    try {
      const firstName = student.name.trim().split(' ')[0];
      const newTempPass = `${firstName}@2026`;

      // 1. Try sending a password-reset email to the student's email directly from the client.
      if (student.email && student.email.includes('@')) {
        try {
          await sendPasswordResetEmail(auth, student.email);
          console.log(`Password reset email successfully sent to ${student.email}`);
        } catch (emailErr: any) {
          console.warn('Could not send password reset email (this is normal for sandbox demo emails):', emailErr);
        }
      }

      // 2. Update their Firestore student document so they are prompted to change their password on next login
      const updatedStudent: Student = {
        ...student,
        mustChangePassword: true,
        temporaryPassword: newTempPass
      };
      await onUpsertStudent(updatedStudent);

      // 3. Show success details
      setResetSuccessModal({
        name: student.name,
        rollNumber: student.rollNumber,
        tempPass: newTempPass
      });
    } catch (error: any) {
      console.error('Error resetting password:', error);
      alert(`Error resetting password: ${error.message || error}`);
    } finally {
      setResetLoadingId(null);
    }
  };

  // Form submit handler
  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Requirement 5 validation
    if (!name.trim()) { setFormError('Full Name is required.'); return; }
    if (!rollNumber.trim()) { setFormError('Roll Number is required.'); return; }
    if (!department.trim()) { setFormError('Academic Department is required.'); return; }
    if (!semester.trim()) { setFormError('Semester is required.'); return; }
    if (!phone.trim()) { setFormError('Student Phone Number is required.'); return; }
    if (!guardianName.trim()) { setFormError('Guardian Name is required.'); return; }
    if (!guardianPhone.trim()) { setFormError('Guardian Phone Number is required.'); return; }
    if (!hostelName.trim()) { setFormError('Hostel is required.'); return; }
    if (!roomNumber.trim()) { setFormError('Room Number is required.'); return; }
    if (!photoPreview && !photoFile) { setFormError('Student Photo is required. Please upload or take a photo.'); return; }

    setFormLoading(true);
    setFormError('');

    const formattedRoll = rollNumber.trim().toUpperCase();
    const rollNumberSlug = formattedRoll.toLowerCase().replace(/[^a-z0-9]/g, '');
    const generatedEmail = `${rollNumberSlug}@iracampus.edu`;
    const firstName = name.trim().split(' ')[0];
    const tempPassword = `${firstName}@2026`;

    const studentId = editingId || `s_${Date.now()}`;
    const targetHostel = hostels.find(h => h.name === hostelName);
    const targetHostelId = targetHostel?.id || hostelName.toLowerCase().replace(/[^a-z0-9]/g, '_');

    let photoURL = photoPreview;

    // Requirement 1 & 7: Upload photo to Firebase Storage under path: student-photos/{hostelId}/{studentId}.jpg
    if (photoFile || (photoPreview && photoPreview.startsWith('data:'))) {
      try {
        const uploadedUrl = await uploadStudentPhoto(targetHostelId, studentId, photoFile || photoPreview);
        if (uploadedUrl) {
          photoURL = uploadedUrl;
        }
      } catch (uploadErr) {
        console.warn('Photo upload error to Firebase Storage:', uploadErr);
      }
    }

    const newStudent: Student = {
      id: studentId,
      rollNumber: formattedRoll,
      name: name.trim(),
      photoUrl: photoURL,
      photoURL: photoURL,
      department: department.trim(),
      semester,
      phone: phone.trim(),
      studentPhone: phone.trim(),
      guardianName: guardianName.trim(),
      guardianPhone: guardianPhone.trim(),
      hostelName,
      hostelId: targetHostelId,
      roomNumber: roomNumber.trim(),
      bedNumber,
      qrId: `QR-${formattedRoll}`,
      messStatus,
      hostelStatus: editingId ? (students.find(s => s.id === editingId)?.hostelStatus || 'present') : 'present',
      leaveStatus: editingId ? (students.find(s => s.id === editingId)?.leaveStatus || 'none') : 'none',
      admissionDate: editingId ? (students.find(s => s.id === editingId)?.admissionDate || new Date().toISOString().split('T')[0]) : new Date().toISOString().split('T')[0],
      email: generatedEmail,
      temporaryPassword: tempPassword,
      mustChangePassword: true
    };

    try {
      await onUpsertStudent(newStudent);
      if (!editingId) {
        setCreatedCredentials({
          name: name.trim(),
          rollNumber: formattedRoll,
          email: generatedEmail,
          tempPass: tempPassword
        });
      }
      resetForm();
    } catch (error: any) {
      console.error('Failed to register student:', error);
      setFormError(error.message || 'Error occurred during student registration. Please try again.');
    } finally {
      setFormLoading(false);
    }
  };

  const resetForm = () => {
    setName('');
    setRollNumber('');
    setDepartment('');
    setSemester('I');
    setPhone('');
    setGuardianName('');
    setGuardianPhone('');
    setHostelName(hostels[0]?.name || '');
    setRoomNumber('101');
    setBedNumber('A');
    setMessStatus('active');
    setPhotoFile(null);
    setPhotoPreview('');
    setEditingId(null);
    setFormError('');
    setShowForm(false);
    stopCamera();
  };

  const handleEditClick = (student: Student) => {
    setEditingId(student.id);
    setName(student.name);
    setRollNumber(student.rollNumber);
    setDepartment(student.department);
    setSemester(student.semester);
    setPhone(student.studentPhone || student.phone || '');
    setGuardianName(student.guardianName || '');
    setGuardianPhone(student.guardianPhone || '');
    setHostelName(student.hostelName);
    setRoomNumber(student.roomNumber);
    setBedNumber(student.bedNumber);
    setMessStatus(student.messStatus);
    const existingPhoto = student.photoURL || student.photoUrl || '';
    setPhotoPreview(existingPhoto);
    setPhotoFile(null);
    setShowForm(true);
  };

  const handleReallocateSubmit = (studentId: string) => {
    if (!allocHostel || !allocRoom || !allocBed) return;
    onReallocateRoom(studentId, allocHostel, allocRoom, allocBed);
    setShowAllocDrawer(null);
  };

  const triggerAllocationSetup = (student: Student) => {
    setAllocHostel(student.hostelName);
    setAllocRoom(student.roomNumber);
    setAllocBed(student.bedNumber);
    setShowAllocDrawer(student.id);
  };

  // CSV drag/drop, import helper
  const handleCSVUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      const text = event.target?.result as string;
      setCsvContent(text);
    };
    reader.readAsText(file);
  };

  const handleBulkImportSubmit = async () => {
    if (!csvContent.trim()) {
      setImportStatus({ success: false, text: "CSV content cannot be empty." });
      return;
    }
    const ok = await onImportCSV(csvContent);
    if (ok) {
      setImportStatus({ success: true, text: "Successfully imported students to Firestore database!" });
      setCsvContent('');
      setTimeout(() => {
        setImportStatus(null);
        setShowImport(false);
      }, 3000);
    } else {
      setImportStatus({ success: false, text: "Error parsing CSV. Please review format guidelines." });
    }
  };

  const handleDownloadSample = () => {
    const sampleHeaders = "RollNumber,Name,Department,Semester,Phone,GuardianPhone,HostelName,RoomNumber,BedNumber\nCS2023010,Amit Verma,Computer Science,V,9988776655,9988776644,Gangpur Boys' Hostel,101,A";
    const blob = new Blob([sampleHeaders], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'ira_students_sample.csv';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  // List of unique departments for filter dropdown
  const departments = ['all', ...Array.from(new Set(students.map(s => s.department)))];

  // Filtering Logic
  const filteredStudents = students.filter(student => {
    const matchesSearch = 
      student.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      student.rollNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
      student.roomNumber.includes(searchQuery) ||
      student.department.toLowerCase().includes(searchQuery.toLowerCase()) ||
      student.qrId.toLowerCase().includes(searchQuery.toLowerCase()) ||
      student.phone.includes(searchQuery);

    const matchesHostel = selectedHostel === 'all' || student.hostelName === selectedHostel;
    const matchesDept = selectedDept === 'all' || student.department === selectedDept;

    return matchesSearch && matchesHostel && matchesDept;
  });

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Top action bar */}
      <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4 bg-white border border-gray-100 p-5 rounded-2xl shadow-sm">
        <div className="flex-1 flex flex-col md:flex-row gap-3">
          {/* Search Input */}
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input 
              id="student_search_input"
              type="text"
              placeholder="Search by name, roll, room, department, phone, QR..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-gray-50 border border-gray-200 focus:border-slate-800 focus:ring-2 focus:ring-slate-100 rounded-xl pl-10 pr-4 py-2.5 text-sm outline-none transition"
            />
          </div>

          {/* Filters */}
          <select 
            id="hostel_filter"
            value={selectedHostel}
            onChange={(e) => setSelectedHostel(e.target.value)}
            className="bg-gray-50 border border-gray-200 rounded-xl px-4 py-2 text-xs outline-none focus:border-slate-800 transition font-medium cursor-pointer"
          >
            <option value="all">All Hostels</option>
            {hostels.map((h, i) => (
              <option key={h.id || `sm-h1-${h.name}-${i}`} value={h.name}>{h.name}</option>
            ))}
          </select>

          <select 
            id="dept_filter"
            value={selectedDept}
            onChange={(e) => setSelectedDept(e.target.value)}
            className="bg-gray-50 border border-gray-200 rounded-xl px-4 py-2 text-xs outline-none focus:border-slate-800 transition font-medium cursor-pointer"
          >
            <option value="all">All Depts</option>
            {departments.filter(d => d !== 'all').map((d, i) => (
              <option key={`sm-dept-${d}-${i}`} value={d}>{d}</option>
            ))}
          </select>
        </div>

        <div className="flex gap-2">
          <button 
            id="bulk_import_toggle"
            onClick={() => setShowImport(!showImport)}
            className="bg-gray-50 hover:bg-gray-100 border border-gray-200 text-gray-700 font-semibold text-xs px-4 py-2.5 rounded-xl cursor-pointer flex items-center gap-2 transition"
          >
            <FileUp className="w-4 h-4" /> Bulk Import
          </button>
          
          <button 
            id="add_student_manual"
            onClick={() => { resetForm(); setShowForm(true); }}
            className="bg-slate-900 hover:bg-slate-850 text-white font-semibold text-xs px-4 py-2.5 rounded-xl cursor-pointer flex items-center gap-2 shadow-sm transition"
          >
            <UserPlus className="w-4 h-4" /> Add Student
          </button>
        </div>
      </div>

      {/* CSV Bulk Import Panel */}
      {showImport && (
        <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-6 space-y-4 animate-slide-up">
          <div className="flex items-center justify-between border-b border-gray-100 pb-3">
            <h4 className="font-bold text-slate-900 text-sm flex items-center gap-2">
              <FileUp className="w-4 h-4" /> Excel/CSV Bulk Student Enrollment
            </h4>
            <button 
              id="close_import_btn"
              onClick={() => setShowImport(false)} 
              className="p-1 text-gray-400 hover:text-gray-600 rounded-full cursor-pointer">
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-3">
              <p className="text-xs text-gray-500 leading-relaxed">
                Import thousands of student profiles in seconds. Prepare a CSV spreadsheet conforming exactly to the columns listed below.
              </p>
              
              <div className="bg-gray-50 p-4 rounded-xl space-y-2 border border-gray-100">
                <span className="text-[10px] text-gray-400 uppercase font-bold">Required Columns:</span>
                <p className="text-[11px] font-mono text-gray-600 font-medium leading-snug">
                  RollNumber, Name, Department, Semester, Phone, GuardianPhone, HostelName, RoomNumber, BedNumber
                </p>
              </div>

              <div className="flex gap-2.5 pt-1">
                <button 
                  id="dl_csv_sample"
                  onClick={handleDownloadSample}
                  className="bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-800 font-semibold text-[11px] px-3.5 py-2 rounded-xl flex items-center gap-1.5 transition cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" /> Download Sample Template
                </button>
                <button 
                  id="choose_csv_file"
                  onClick={() => fileInputRef.current?.click()}
                  className="bg-white hover:bg-gray-50 border border-gray-200 text-gray-700 font-semibold text-[11px] px-3.5 py-2 rounded-xl flex items-center gap-1.5 transition cursor-pointer"
                >
                  Upload CSV File
                </button>
                <input 
                  id="csv_file_input"
                  type="file" 
                  ref={fileInputRef} 
                  accept=".csv" 
                  className="hidden" 
                  onChange={handleCSVUpload} 
                />
              </div>
            </div>

            <div className="space-y-3">
              <label className="text-[10px] text-gray-400 uppercase font-bold">Paste CSV Rows Raw Content</label>
              <textarea 
                id="csv_text_area"
                rows={4}
                placeholder="RollNumber,Name,Department,Semester,Phone,GuardianPhone,HostelName,RoomNumber,BedNumber..."
                value={csvContent}
                onChange={(e) => setCsvContent(e.target.value)}
                className="w-full bg-gray-50 border border-gray-200 rounded-xl p-3 text-xs font-mono outline-none focus:border-slate-800 transition resize-none"
              />

              {importStatus && (
                <div className={`p-3 rounded-xl border flex items-center gap-2 text-xs font-medium ${
                  importStatus.success ? 'bg-emerald-50 text-emerald-800 border-emerald-100' : 'bg-rose-50 text-rose-800 border-rose-100'
                }`}>
                  {importStatus.success ? <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" /> : <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />}
                  <span>{importStatus.text}</span>
                </div>
              )}

              <button 
                id="submit_bulk_import"
                onClick={handleBulkImportSubmit}
                className="w-full bg-slate-900 hover:bg-slate-850 text-white font-semibold py-2 rounded-xl text-xs flex items-center justify-center cursor-pointer transition shadow-sm"
              >
                Enroll and Seed Students Now
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Student Form Panel (Add / Edit) */}
      {showForm && (
        <div className="bg-white border border-gray-100 rounded-2xl shadow-sm p-6 space-y-4 animate-slide-up">
          <div className="flex items-center justify-between border-b border-gray-100 pb-3">
            <h4 className="font-bold text-gray-900 text-sm">
              {editingId ? "Modify Student Profile Registers" : "New Student Academic Registration"}
            </h4>
            <button 
              id="cancel_form_btn"
              onClick={resetForm} 
              className="p-1 text-gray-400 hover:text-gray-600 rounded-full cursor-pointer">
              <X className="w-4.5 h-4.5" />
            </button>
          </div>

          <form onSubmit={handleFormSubmit} className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {formError && (
              <div className="md:col-span-3 bg-rose-50 border border-rose-100 text-rose-800 p-3.5 rounded-xl flex items-start gap-2 text-xs font-semibold">
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                <span>{formError}</span>
              </div>
            )}
            <div className="space-y-1">
              <label className="text-[10px] text-gray-400 uppercase font-bold">Full Name</label>
              <input 
                id="form_student_name"
                type="text" 
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-xs outline-none focus:border-slate-800 transition"
              />
            </div>

            <div className="space-y-1">
              <label className="text-[10px] text-gray-400 uppercase font-bold">Roll Number / Student ID</label>
              <input 
                id="form_student_roll"
                type="text" 
                required
                value={rollNumber}
                onChange={(e) => setRollNumber(e.target.value)}
                placeholder="E.g., CS2023001"
                className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-xs outline-none focus:border-slate-800 transition font-mono"
              />
            </div>

            <div className="space-y-1">
              <label className="text-[10px] text-gray-400 uppercase font-bold">Academic Department</label>
              <input 
                id="form_student_dept"
                type="text" 
                required
                value={department}
                onChange={(e) => setDepartment(e.target.value)}
                placeholder="E.g., Computer Science"
                className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-xs outline-none focus:border-slate-800 transition"
              />
            </div>

            <div className="space-y-1">
              <label className="text-[10px] text-gray-400 uppercase font-bold">Semester</label>
              <select 
                id="form_student_sem"
                value={semester}
                onChange={(e) => setSemester(e.target.value)}
                className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-xs outline-none focus:border-slate-800 transition"
              >
                {['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII'].map((sem) => (
                  <option key={`sem-opt-${sem}`} value={sem}>Semester {sem}</option>
                ))}
              </select>
            </div>

            <div className="space-y-1">
              <label className="text-[10px] text-gray-400 uppercase font-bold">Student Phone Number *</label>
              <input 
                id="form_student_phone"
                type="text" 
                required
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="E.g., 9876543210"
                className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-xs outline-none focus:border-slate-800 transition"
              />
            </div>

            <div className="space-y-1">
              <label className="text-[10px] text-gray-400 uppercase font-bold">Guardian Name *</label>
              <input 
                id="form_student_gname"
                type="text" 
                required
                value={guardianName}
                onChange={(e) => setGuardianName(e.target.value)}
                placeholder="Parent/Guardian Name"
                className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-xs outline-none focus:border-slate-800 transition"
              />
            </div>

            <div className="space-y-1">
              <label className="text-[10px] text-gray-400 uppercase font-bold">Guardian Emergency Phone *</label>
              <input 
                id="form_student_gphone"
                type="text" 
                required
                value={guardianPhone}
                onChange={(e) => setGuardianPhone(e.target.value)}
                placeholder="E.g., 9876543211"
                className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-xs outline-none focus:border-slate-800 transition"
              />
            </div>

            {/* Student Photo Upload & Camera Capture Field */}
            <div className="md:col-span-3 bg-slate-50/80 border border-slate-200 rounded-2xl p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <label className="text-xs font-bold text-gray-900 flex items-center gap-1.5">
                    <Camera className="w-4 h-4 text-slate-800" />
                    <span>Student Photo *</span>
                  </label>
                  <p className="text-[11px] text-gray-500">Upload an image or use camera capture. Saved to Firebase Storage.</p>
                </div>
                {photoPreview && (
                  <button 
                    type="button" 
                    onClick={() => { setPhotoPreview(''); setPhotoFile(null); }}
                    className="text-[10px] text-rose-600 hover:underline font-semibold"
                  >
                    Clear Photo
                  </button>
                )}
              </div>

              {isCameraActive ? (
                <div className="flex flex-col items-center space-y-3 bg-black/90 p-3 rounded-xl">
                  <video 
                    ref={videoRef} 
                    autoPlay 
                    playsInline 
                    className="w-48 h-48 object-cover rounded-lg border-2 border-white/20"
                  />
                  <div className="flex gap-2">
                    <button 
                      type="button" 
                      onClick={captureCameraPhoto}
                      className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs px-4 py-2 rounded-xl flex items-center gap-1.5 shadow-sm"
                    >
                      <Camera className="w-3.5 h-3.5" />
                      <span>Snap Photo</span>
                    </button>
                    <button 
                      type="button" 
                      onClick={stopCamera}
                      className="bg-gray-700 hover:bg-gray-800 text-white font-medium text-xs px-3 py-2 rounded-xl"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col sm:flex-row items-center gap-4">
                  {/* Photo Preview Thumbnail */}
                  <div className="w-24 h-24 rounded-xl border-2 border-slate-200 bg-white overflow-hidden shrink-0 flex items-center justify-center shadow-sm">
                    {photoPreview ? (
                      <img 
                        src={photoPreview} 
                        alt="Student preview" 
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="text-center p-2 text-gray-400">
                        <User className="w-8 h-8 mx-auto stroke-1" />
                        <span className="text-[9px] block font-medium">No Photo</span>
                      </div>
                    )}
                  </div>

                  {/* Upload Controls */}
                  <div className="flex flex-col sm:flex-row gap-2 w-full">
                    <label className="flex-1 bg-white border border-gray-200 hover:border-slate-800 text-slate-800 font-semibold text-xs px-3 py-2.5 rounded-xl cursor-pointer transition flex items-center justify-center gap-2 shadow-sm">
                      <Upload className="w-4 h-4 text-slate-600" />
                      <span>Select Device File</span>
                      <input 
                        id="form_student_photo_file"
                        type="file" 
                        accept="image/*" 
                        capture="environment"
                        onChange={handlePhotoFileChange}
                        className="hidden" 
                      />
                    </label>

                    <button 
                      type="button" 
                      onClick={startCamera}
                      className="flex-1 bg-slate-900 hover:bg-slate-800 text-white font-semibold text-xs px-3 py-2.5 rounded-xl cursor-pointer transition flex items-center justify-center gap-2 shadow-sm"
                    >
                      <Camera className="w-4 h-4" />
                      <span>Take Live Photo</span>
                    </button>
                  </div>
                </div>
              )}
            </div>

            <div className="space-y-1">
              <label className="text-[10px] text-gray-400 uppercase font-bold">Hostel Building</label>
              <select 
                id="form_student_hostel"
                value={hostelName}
                onChange={(e) => setHostelName(e.target.value)}
                className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-xs outline-none focus:border-slate-800 transition"
              >
                {hostels.length > 0 ? (
                  hostels.map((h, i) => (
                    <option key={h.id || `sm-h2-${h.name}-${i}`} value={h.name}>{h.name}</option>
                  ))
                ) : (
                  <option key="default-hostel-opt-1" value="">Not Configured</option>
                )}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <label className="text-[10px] text-gray-400 uppercase font-bold">Room</label>
                <input 
                  id="form_student_room"
                  type="text" 
                  required
                  value={roomNumber}
                  onChange={(e) => setRoomNumber(e.target.value)}
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-xs outline-none focus:border-slate-800 transition"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] text-gray-400 uppercase font-bold">Bed</label>
                <select 
                  id="form_student_bed"
                  value={bedNumber}
                  onChange={(e) => setBedNumber(e.target.value)}
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-xs outline-none focus:border-slate-800 transition"
                >
                  <option value="A">Bed A</option>
                  <option value="B">Bed B</option>
                  <option value="C">Bed C</option>
                </select>
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-[10px] text-gray-400 uppercase font-bold">Mess Board Status</label>
              <select 
                id="form_student_mess"
                value={messStatus}
                onChange={(e) => setMessStatus(e.target.value as 'active' | 'inactive')}
                className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-xs outline-none focus:border-slate-800 transition"
              >
                <option value="active">Active (Auto Bill meal scans)</option>
                <option value="inactive">Inactive (Suspended)</option>
              </select>
            </div>

            <div className="md:col-span-3 flex justify-end gap-2.5 border-t border-gray-50 pt-3">
              <button 
                id="cancel_form_submit"
                type="button" 
                disabled={formLoading}
                onClick={resetForm}
                className="bg-white hover:bg-gray-50 border border-gray-200 text-gray-700 font-semibold text-xs px-4 py-2 rounded-xl cursor-pointer transition disabled:opacity-50"
              >
                Cancel
              </button>
              <button 
                id="confirm_form_submit"
                type="submit"
                disabled={formLoading}
                className="bg-slate-900 hover:bg-slate-850 text-white font-semibold text-xs px-5 py-2 rounded-xl cursor-pointer transition shadow-sm disabled:opacity-50 flex items-center gap-1.5"
              >
                {formLoading ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Processing...</span>
                  </>
                ) : (
                  <span>{editingId ? "Apply Modifications" : "Confirm Enrollment"}</span>
                )}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Main Student Directory Table */}
      <div className="bg-white border border-gray-100 rounded-2xl shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100 bg-gray-50/50 flex items-center justify-between">
          <h3 className="font-bold text-gray-900 text-sm">Student Directory ({filteredStudents.length} Records)</h3>
          <span className="text-[11px] text-slate-800 font-bold font-mono bg-slate-50 border border-slate-200 px-2.5 py-1 rounded-md">Live Register</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-gray-100 text-gray-400 uppercase font-bold tracking-wider bg-gray-50/20">
                <th className="py-3 px-6">Occupant</th>
                <th className="py-3 px-6">ID & Roll Number</th>
                <th className="py-3 px-6">Academic Details</th>
                <th className="py-3 px-6">Hostel Allocation</th>
                <th className="py-3 px-6">Mess Status</th>
                <th className="py-3 px-6">Gate Status</th>
                <th className="py-3 px-6 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {students.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-gray-400 font-medium">
                    No students have been registered for this hostel.
                  </td>
                </tr>
              ) : filteredStudents.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-gray-400 font-medium">
                    No student records match the search parameters. Try expanding filters.
                  </td>
                </tr>
              ) : (
                filteredStudents.map((s, idx) => (
                  <tr key={s.id || s.rollNumber || `student-tr-${idx}`} className="hover:bg-gray-50/50 transition">
                    <td className="py-4 px-6">
                      <div className="flex items-center gap-3">
                        <img 
                          src={s.photoURL || s.photoUrl || ''} 
                          alt={s.name} 
                          className="w-10 h-10 rounded-full object-cover border border-gray-100 shrink-0 shadow-sm bg-slate-100"
                          onError={(e) => {
                            (e.target as HTMLImageElement).src = 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 24 24" fill="%23f1f5f9" stroke="%23334155" stroke-width="1.5"><circle cx="12" cy="7" r="4"/><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/></svg>';
                          }}
                        />
                        <div className="flex flex-col">
                          <span className="font-bold text-gray-900 text-sm">{s.name}</span>
                          <span className="text-[10px] text-gray-400 font-medium font-mono">{s.qrId}</span>
                        </div>
                      </div>
                    </td>
                    <td className="py-4 px-6">
                      <div className="flex flex-col">
                        <span className="font-mono text-gray-800 font-semibold">{s.rollNumber}</span>
                        <span className="text-[10px] text-gray-500 flex items-center gap-1">
                          <Phone className="w-2.5 h-2.5 shrink-0 text-emerald-600" /> {s.studentPhone || s.phone ? `+91 ${s.studentPhone || s.phone}` : 'N/A'}
                        </span>
                        {s.guardianName && (
                          <span className="text-[10px] text-gray-400">
                            Guardian: {s.guardianName} ({s.guardianPhone || 'N/A'})
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="py-4 px-6">
                      <div className="flex flex-col text-gray-700">
                        <span className="font-medium text-xs truncate max-w-[150px]">{s.department}</span>
                        <span className="text-[10px] text-gray-400">Semester {s.semester}</span>
                      </div>
                    </td>
                    <td className="py-4 px-6">
                      <div className="flex items-center justify-between gap-2 max-w-[170px]">
                        <div className="flex flex-col">
                          <span className="font-bold text-gray-800">{s.hostelName.split(' ')[0]}</span>
                          <span className="text-[10px] text-gray-500 font-mono">Rm {s.roomNumber} - Bed {s.bedNumber}</span>
                        </div>
                        <button 
                          id={`alloc_trigger_${s.id}`}
                          onClick={() => triggerAllocationSetup(s)}
                          className="p-1.5 hover:bg-slate-50 hover:text-slate-900 text-gray-400 rounded-lg cursor-pointer transition"
                          title="Change Room"
                        >
                          <Shuffle className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                    <td className="py-4 px-6">
                      <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full font-bold uppercase text-[9px] tracking-wider border ${
                        s.messStatus === 'active' 
                          ? 'bg-slate-50 text-slate-850 border-slate-200' 
                          : 'bg-gray-100 text-gray-500 border-gray-200'
                      }`}>
                        {s.messStatus}
                      </span>
                    </td>
                    <td className="py-4 px-6">
                      <span className={`inline-flex items-center gap-1.5 text-[10px] font-bold uppercase ${
                        s.hostelStatus === 'present' ? 'text-emerald-600' :
                        s.hostelStatus === 'absent' ? 'text-rose-600' :
                        'text-amber-500'
                      }`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${
                          s.hostelStatus === 'present' ? 'bg-emerald-500' :
                          s.hostelStatus === 'absent' ? 'bg-rose-500' :
                          'bg-amber-400'
                        }`}></span>
                        {s.hostelStatus}
                      </span>
                    </td>
                    <td className="py-4 px-6 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button 
                          id={`reset_password_${s.id}`}
                          onClick={() => handleResetPassword(s)}
                          disabled={resetLoadingId === s.id}
                          className="p-2 hover:bg-emerald-50 text-emerald-600 hover:text-emerald-700 rounded-xl cursor-pointer transition disabled:opacity-50"
                          title="Reset Password"
                        >
                          {resetLoadingId === s.id ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <KeyRound className="w-3.5 h-3.5" />
                          )}
                        </button>
                        <button 
                          id={`edit_student_${s.id}`}
                          onClick={() => handleEditClick(s)}
                          className="p-2 hover:bg-gray-100 text-gray-500 hover:text-slate-900 rounded-xl cursor-pointer transition"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button 
                          id={`delete_student_${s.id}`}
                          onClick={() => handleDeleteStudent(s)}
                          disabled={deleteLoadingId === s.id}
                          className="p-2 hover:bg-rose-50 text-gray-400 hover:text-rose-600 rounded-xl cursor-pointer transition disabled:opacity-50"
                          title="Delete Student Record"
                        >
                          {deleteLoadingId === s.id ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin text-rose-600" />
                          ) : (
                            <Trash2 className="w-3.5 h-3.5" />
                          )}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Room Reallocation Modal Drawer */}
      {showAllocDrawer && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-xs flex items-center justify-center z-50 animate-fade-in">
          <div className="bg-white rounded-2xl max-w-sm w-full p-6 shadow-xl border border-gray-100 space-y-4">
            <div className="flex items-center justify-between border-b border-gray-100 pb-3">
              <h4 className="font-bold text-gray-900 text-sm">Reallocate Student Room</h4>
              <button 
                id="close_alloc_modal"
                onClick={() => setShowAllocDrawer(null)} 
                className="p-1 text-gray-400 hover:text-gray-600 rounded-full cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <p className="text-gray-500">
                Update room placement for **{students.find(s => s.id === showAllocDrawer)?.name}**. This automatically modifies hostel bed occupancy registers.
              </p>

              <div className="space-y-1">
                <label className="text-[10px] text-gray-400 uppercase font-bold">Target Hostel Building</label>
                <select 
                  id="alloc_hostel_select"
                  value={allocHostel}
                  onChange={(e) => setAllocHostel(e.target.value)}
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-xs outline-none focus:border-slate-800 transition"
                >
                  {hostels.length > 0 ? (
                    hostels.map((h, i) => (
                      <option key={h.id || `sm-h3-${h.name}-${i}`} value={h.name}>{h.name}</option>
                    ))
                  ) : (
                    <option key="default-hostel-opt-2" value="">Not Configured</option>
                  )}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[10px] text-gray-400 uppercase font-bold">Room Number</label>
                  <input 
                    id="alloc_room_input"
                    type="text" 
                    value={allocRoom}
                    onChange={(e) => setAllocRoom(e.target.value)}
                    placeholder="e.g. 101"
                    className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-xs outline-none focus:border-slate-800 transition"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] text-gray-400 uppercase font-bold">Bed Letter</label>
                  <select 
                    id="alloc_bed_select"
                    value={allocBed}
                    onChange={(e) => setAllocBed(e.target.value)}
                    className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-xs outline-none focus:border-slate-800 transition"
                  >
                    <option value="A">Bed A</option>
                    <option value="B">Bed B</option>
                    <option value="C">Bed C</option>
                  </select>
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-2 border-t border-gray-100 pt-3">
              <button 
                id="cancel_realloc"
                onClick={() => setShowAllocDrawer(null)}
                className="bg-white hover:bg-gray-50 border border-gray-200 text-gray-700 px-3.5 py-1.5 rounded-xl cursor-pointer transition text-xs font-semibold"
              >
                Cancel
              </button>
              <button 
                id="confirm_realloc"
                onClick={() => handleReallocateSubmit(showAllocDrawer)}
                className="bg-slate-900 hover:bg-slate-850 text-white px-4 py-1.5 rounded-xl cursor-pointer transition text-xs font-semibold shadow-sm"
              >
                Complete Reallocation
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal to display credentials to warden */}
      {createdCredentials && (
        <div id="credentials_overlay" className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white border border-slate-200 rounded-[20px] max-w-md w-full p-6 shadow-xl space-y-5 animate-slide-up text-xs">
            <div className="text-center space-y-1.5">
              <div className="bg-emerald-50 text-emerald-600 p-2.5 rounded-full inline-flex items-center justify-center">
                <ShieldCheck className="w-6 h-6" />
              </div>
              <h4 className="text-sm font-black text-slate-900 tracking-tight">Student Enrollment Confirmed</h4>
              <p className="text-slate-400 font-medium">Automatic authentication profile initialized.</p>
            </div>

            <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-3 font-medium text-slate-700">
              <div className="flex justify-between items-center pb-2 border-b border-slate-100">
                <span className="text-slate-400 font-bold uppercase text-[10px]">Student Name:</span>
                <span className="text-slate-900 font-extrabold">{createdCredentials.name}</span>
              </div>
              <div className="flex justify-between items-center pb-2 border-b border-slate-100">
                <span className="text-slate-400 font-bold uppercase text-[10px]">Roll Number:</span>
                <span className="text-slate-900 font-mono font-bold">{createdCredentials.rollNumber}</span>
              </div>
              <div className="flex justify-between items-center pb-2 border-b border-slate-100">
                <span className="text-slate-400 font-bold uppercase text-[10px]">Email Address:</span>
                <span className="text-slate-900 font-mono text-[11px] font-bold">{createdCredentials.email}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-400 font-bold uppercase text-[10px]">Temp Password:</span>
                <span className="text-emerald-700 font-mono font-extrabold bg-emerald-50 px-2 py-0.5 rounded">{createdCredentials.tempPass}</span>
              </div>
            </div>

            <div className="space-y-2">
              <button
                id="copy_creds_btn"
                onClick={() => {
                  navigator.clipboard.writeText(`Name: ${createdCredentials.name}\nRoll Number: ${createdCredentials.rollNumber}\nEmail: ${createdCredentials.email}\nTemporary Password: ${createdCredentials.tempPass}`);
                  setCopiedCreds(true);
                  setTimeout(() => {
                    setCopiedCreds(false);
                  }, 2000);
                }}
                className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold py-3 px-4 rounded-xl text-center uppercase tracking-wider transition cursor-pointer"
              >
                {copiedCreds ? "✓ Copied to Clipboard!" : "Copy Credentials"}
              </button>
              <button
                id="dismiss_creds_btn"
                onClick={() => setCreatedCredentials(null)}
                className="w-full bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold py-2.5 px-4 rounded-xl text-center transition cursor-pointer"
              >
                Dismiss
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal to display reset success to warden */}
      {resetSuccessModal && (
        <div id="reset_success_overlay" className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-white border border-slate-200 rounded-[20px] max-w-md w-full p-6 shadow-xl space-y-5 animate-slide-up text-xs">
            <div className="text-center space-y-1.5">
              <div className="bg-emerald-50 text-emerald-600 p-2.5 rounded-full inline-flex items-center justify-center">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <h4 className="text-sm font-black text-slate-900 tracking-tight">Credentials Successfully Reset</h4>
              <p className="text-slate-400 font-medium">Temporary password reset has been configured.</p>
            </div>

            <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-3 font-medium text-slate-700">
              <div className="flex justify-between items-center pb-2 border-b border-slate-100">
                <span className="text-slate-400 font-bold uppercase text-[10px]">Student Name:</span>
                <span className="text-slate-900 font-extrabold">{resetSuccessModal.name}</span>
              </div>
              <div className="flex justify-between items-center pb-2 border-b border-slate-100">
                <span className="text-slate-400 font-bold uppercase text-[10px]">Roll Number:</span>
                <span className="text-slate-900 font-mono font-bold">{resetSuccessModal.rollNumber}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-400 font-bold uppercase text-[10px]">New Temp Password:</span>
                <span className="text-emerald-700 font-mono font-extrabold bg-emerald-50 px-2 py-0.5 rounded">{resetSuccessModal.tempPass}</span>
              </div>
            </div>

            <div className="space-y-2">
              <button
                id="copy_reset_creds_btn"
                onClick={() => {
                  navigator.clipboard.writeText(`Name: ${resetSuccessModal.name}\nRoll Number: ${resetSuccessModal.rollNumber}\nNew Temp Password: ${resetSuccessModal.tempPass}`);
                  alert("Reset details copied to clipboard!");
                }}
                className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold py-3 px-4 rounded-xl text-center uppercase tracking-wider transition cursor-pointer"
              >
                Copy Reset Details
              </button>
              <button
                id="dismiss_reset_creds_btn"
                onClick={() => setResetSuccessModal(null)}
                className="w-full bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold py-2.5 px-4 rounded-xl text-center transition cursor-pointer"
              >
                Dismiss
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
