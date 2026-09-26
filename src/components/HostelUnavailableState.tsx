import React from 'react';
import { Building2, ShieldAlert, AlertCircle, RefreshCw, LogOut } from 'lucide-react';
import { Hostel } from '../types';

interface HostelUnavailableStateProps {
  userRole?: string;
  availableHostels?: Hostel[];
  onSelectHostel?: (hostelId: string) => void;
  onLogout?: () => void;
  onRefresh?: () => void;
}

export default function HostelUnavailableState({
  userRole,
  availableHostels = [],
  onSelectHostel,
  onLogout,
  onRefresh
}: HostelUnavailableStateProps) {
  const isSuperAdmin = userRole === 'super_admin';

  return (
    <div className="min-h-[70vh] flex flex-col items-center justify-center p-6 text-center max-w-lg mx-auto">
      <div className="w-16 h-16 rounded-2xl bg-amber-50 border border-amber-200 text-amber-600 flex items-center justify-center mb-6 shadow-xs">
        <Building2 className="w-8 h-8" />
      </div>

      <h2 className="text-xl font-bold text-slate-900 tracking-tight mb-2">
        Hostel Context Unavailable
      </h2>

      <p className="text-sm text-slate-600 leading-relaxed mb-6">
        {isSuperAdmin
          ? 'No active hostel is currently selected. Please select a hostel from the list below or access the central platform overview to manage institutional units.'
          : 'Your account is currently not assigned to an active hostel unit or the hostel configuration could not be resolved.'}
      </p>

      {/* Super Admin: Direct Selection Picker */}
      {isSuperAdmin && availableHostels.length > 0 && onSelectHostel && (
        <div className="w-full bg-slate-50 border border-slate-200 rounded-xl p-4 mb-6 text-left">
          <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-2">
            Select an Institutional Hostel to Inspect:
          </label>
          <div className="space-y-2">
            {availableHostels.map((h) => (
              <button
                key={h.id}
                onClick={() => onSelectHostel(h.id)}
                className="w-full flex items-center justify-between p-3 bg-white hover:bg-emerald-50 hover:border-emerald-300 border border-slate-200 rounded-lg text-xs font-medium text-slate-800 transition cursor-pointer group shadow-2xs"
              >
                <div className="flex items-center gap-2.5">
                  <Building2 className="w-4 h-4 text-emerald-600" />
                  <span className="font-semibold">{h.name}</span>
                </div>
                <span className="text-[11px] text-slate-400 group-hover:text-emerald-700 font-mono">
                  {h.district || 'Campus'} →
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Non-SuperAdmin Notice */}
      {!isSuperAdmin && (
        <div className="w-full bg-amber-50/70 border border-amber-200 rounded-xl p-4 mb-6 text-left flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
          <div className="text-xs text-amber-900 space-y-1">
            <p className="font-semibold">Next Steps:</p>
            <p className="text-amber-800 leading-relaxed">
              Please contact your College Administrator or Hostel Superintendent to verify your hostel allocation in the system registry.
            </p>
          </div>
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex items-center justify-center gap-3">
        {onRefresh && (
          <button
            onClick={onRefresh}
            className="inline-flex items-center gap-2 px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-semibold transition cursor-pointer shadow-2xs"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Retry Connection</span>
          </button>
        )}
        {onLogout && (
          <button
            onClick={onLogout}
            className="inline-flex items-center gap-2 px-4 py-2 bg-white hover:bg-slate-50 border border-slate-300 text-slate-700 rounded-lg text-xs font-semibold transition cursor-pointer shadow-2xs"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Sign Out</span>
          </button>
        )}
      </div>
    </div>
  );
}
