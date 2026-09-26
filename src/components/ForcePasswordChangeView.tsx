import React, { useState } from 'react';
import { Lock, Eye, EyeOff, Loader2, CheckCircle2, ShieldAlert, LogOut, ShieldCheck, Sparkles } from 'lucide-react';
import { Student } from '../types';

interface ForcePasswordChangeViewProps {
  student: Student;
  onPasswordChanged: (newPassword: string) => Promise<void>;
  onLogout: () => Promise<void>;
}

export default function ForcePasswordChangeView({
  student,
  onPasswordChanged,
  onLogout
}: ForcePasswordChangeViewProps) {
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');

    if (newPassword.length < 6) {
      setErrorMsg('Password must be at least 6 characters long for security.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setErrorMsg('Passwords do not match. Please verify.');
      return;
    }

    // Prevent reuse of temporary password
    const firstName = student.name.trim().split(' ')[0];
    const defaultTemp = `${firstName}@2026`;
    if (newPassword === defaultTemp || newPassword === student.temporaryPassword) {
      setErrorMsg('For security, you cannot reuse your temporary password. Please select a unique password.');
      return;
    }

    setLoading(true);
    try {
      await onPasswordChanged(newPassword);
      setSuccessMsg('Your secure password was successfully registered! Loading your student dashboard...');
    } catch (err: any) {
      console.error('Password change error:', err);
      setErrorMsg(err.message || 'Failed to update password. Please check your network and try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] flex flex-col items-center justify-center p-4 font-sans selection:bg-emerald-100 selection:text-emerald-900">
      <div className="max-w-md w-full bg-white border border-slate-200 rounded-[20px] p-8 shadow-xs space-y-6">
        
        {/* Header Icon & Branding */}
        <div className="text-center space-y-2">
          <div className="mx-auto bg-emerald-550/10 text-emerald-600 h-12 w-12 rounded-full flex items-center justify-center shadow-xs">
            <ShieldCheck className="w-6 h-6" />
          </div>
          <h2 className="text-xl font-black text-slate-900 tracking-tight">First-Time Setup</h2>
          <p className="text-xs text-slate-500 font-medium leading-relaxed">
            Welcome to IRA Campus, <strong className="text-slate-800">{student.name}</strong>! For security compliance, you must change your temporary password before accessing the student dashboard.
          </p>
        </div>

        {/* Credentials Summary Badge */}
        <div className="bg-slate-50 border border-slate-200 p-3.5 rounded-xl space-y-1.5 text-xs">
          <div className="flex justify-between">
            <span className="text-slate-400 font-bold uppercase text-[9px]">Roll Number:</span>
            <span className="text-slate-800 font-extrabold">{student.rollNumber}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-400 font-bold uppercase text-[9px]">Room Allocation:</span>
            <span className="text-slate-800 font-extrabold">Room {student.roomNumber || 'N/A'}-{student.bedNumber || 'N/A'}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-400 font-bold uppercase text-[9px]">Portal Email:</span>
            <span className="text-slate-800 font-mono text-[10px]">{student.email}</span>
          </div>
        </div>

        {/* Status Alerts */}
        {errorMsg && (
          <div className="bg-red-50 border border-red-100 text-red-700 p-3.5 rounded-xl flex items-start gap-2.5 text-xs font-semibold animate-fade-in">
            <ShieldAlert className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
            <span>{errorMsg}</span>
          </div>
        )}

        {successMsg && (
          <div className="bg-emerald-50 border border-emerald-100 text-emerald-800 p-3.5 rounded-xl flex items-start gap-2.5 text-xs font-semibold animate-fade-in">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
            <span>{successMsg}</span>
          </div>
        )}

        {/* Change Password Form */}
        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          {/* New Password Field */}
          <div className="space-y-1.5">
            <label className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">
              Choose New Password
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                <Lock className="w-4 h-4" />
              </div>
              <input
                id="force_new_password"
                type={showPassword ? 'text' : 'password'}
                required
                placeholder="Enter at least 6 characters"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="w-full bg-slate-50/50 border border-slate-200 rounded-xl pl-10 pr-10 py-3 text-xs outline-none focus:bg-white focus:border-emerald-500 focus:ring-4 focus:ring-emerald-50 transition font-medium text-slate-800"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* Confirm Password Field */}
          <div className="space-y-1.5">
            <label className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">
              Confirm New Password
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                <Lock className="w-4 h-4" />
              </div>
              <input
                id="force_confirm_password"
                type={showPassword ? 'text' : 'password'}
                required
                placeholder="Re-enter your password to verify"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full bg-slate-50/50 border border-slate-200 rounded-xl pl-10 pr-10 py-3 text-xs outline-none focus:bg-white focus:border-emerald-500 focus:ring-4 focus:ring-emerald-50 transition font-medium text-slate-800"
              />
            </div>
          </div>

          {/* Submit Action Buttons */}
          <div className="pt-2 space-y-2">
            <button
              id="confirm_password_change_btn"
              type="submit"
              disabled={loading}
              className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold py-3.5 px-4 rounded-xl text-xs transition uppercase tracking-wider shadow-sm flex items-center justify-center gap-2 disabled:bg-emerald-400 cursor-pointer font-sans"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Registering security credentials...</span>
                </>
              ) : (
                <>
                  <span>Save Password & Continue</span>
                </>
              )}
            </button>

            <button
              id="force_logout_btn"
              type="button"
              onClick={onLogout}
              className="w-full bg-white hover:bg-gray-50 border border-slate-200 text-slate-650 font-bold py-2.5 rounded-xl text-xs transition flex items-center justify-center gap-1.5 cursor-pointer font-sans"
            >
              <LogOut className="w-4 h-4" />
              <span>Cancel & Sign Out</span>
            </button>
          </div>
        </form>

        {/* Footer Security Note */}
        <div className="text-center text-[10px] text-slate-400 font-semibold tracking-wide uppercase border-t border-slate-100 pt-4 flex items-center justify-center gap-1">
          <Sparkles className="w-3.5 h-3.5 text-emerald-600 shrink-0" /> End-To-End Security Compliant Session
        </div>

      </div>
    </div>
  );
}
