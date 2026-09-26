import React from 'react';
import { useHostel } from '../contexts/HostelContext';
import { useAuth } from '../contexts/AuthContext';
import { Building2, ChevronDown, Plus, ShieldAlert, Sparkles, MapPin, Users, Utensils } from 'lucide-react';

interface HostelSwitcherBarProps {
  onOpenSuperAdminOverview?: () => void;
  onOpenAddHostelModal?: () => void;
}

export default function HostelSwitcherBar({ onOpenSuperAdminOverview, onOpenAddHostelModal }: HostelSwitcherBarProps) {
  const { role } = useAuth();
  const { activeHostelId, activeHostel, availableHostels, setActiveHostelId } = useHostel();

  // Switcher is strictly for Super Admin
  if (role !== 'super_admin') {
    return null;
  }

  return (
    <div className="bg-slate-900 text-white border-b border-slate-800 px-4 py-2 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs shadow-md">
      {/* Active Hostel Dropdown */}
      <div className="flex items-center gap-3 w-full sm:w-auto">
        <div className="flex items-center gap-1.5 px-2.5 py-1 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded font-semibold text-[11px] uppercase tracking-wider">
          <ShieldAlert className="w-3.5 h-3.5" />
          <span>Super Admin Mode</span>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-slate-400 font-medium">Hostel Scope:</span>
          <div className="relative">
            <select
              value={activeHostelId}
              onChange={(e) => setActiveHostelId(e.target.value)}
              className="appearance-none bg-slate-800 hover:bg-slate-700/80 text-white text-xs font-semibold py-1 pl-3 pr-8 rounded-lg border border-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-500 cursor-pointer transition-colors"
            >
              {availableHostels.map((h) => (
                <option key={h.id} value={h.id} className="bg-slate-900 text-white">
                  🏢 {h.name} ({h.code || 'GBH'}) — {h.district || 'Sundargarh'}
                </option>
              ))}
            </select>
            <ChevronDown className="w-3.5 h-3.5 text-slate-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          </div>
        </div>
      </div>

      {/* Active Hostel Stats & Quick Actions */}
      <div className="flex items-center gap-4 w-full sm:w-auto justify-between sm:justify-end">
        {activeHostel && (
          <div className="hidden md:flex items-center gap-4 text-[11px] text-slate-300">
            <span className="flex items-center gap-1">
              <Users className="w-3.5 h-3.5 text-emerald-400" />
              <strong className="text-white">{activeHostel.studentCount || 0}</strong> students
            </span>
            <span className="flex items-center gap-1">
              <MapPin className="w-3.5 h-3.5 text-blue-400" />
              {activeHostel.district || 'Sundargarh'}
            </span>
            <span className="flex items-center gap-1">
              <Utensils className="w-3.5 h-3.5 text-amber-400" />
              ₹{activeHostel.mealRates?.lunchPrice || 35} L / ₹{activeHostel.mealRates?.dinnerPrice || 35} D
            </span>
          </div>
        )}

        {onOpenSuperAdminOverview && (
          <button
            onClick={onOpenSuperAdminOverview}
            className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-md transition-colors flex items-center gap-1 font-medium text-[11px]"
          >
            <Building2 className="w-3.5 h-3.5 text-emerald-400" />
            <span>Master Platform Overview</span>
          </button>
        )}
      </div>
    </div>
  );
}
