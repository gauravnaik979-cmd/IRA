import React, { createContext, useContext, useState, useEffect } from 'react';
import { Hostel } from '../types';
import { getAllHostels, getHostelById } from '../services/hostelService';
import { useAuth } from './AuthContext';

interface HostelContextType {
  activeHostelId: string;
  activeHostel: Hostel | null;
  availableHostels: Hostel[];
  loadingHostels: boolean;
  setActiveHostelId: (hostelId: string) => void;
  refreshHostels: () => Promise<void>;
}

const HostelContext = createContext<HostelContextType | undefined>(undefined);

export const useHostel = () => {
  const context = useContext(HostelContext);
  if (!context) {
    throw new Error('useHostel must be used within a HostelProvider');
  }
  return context;
};

export const HostelProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { userProfile, role, adminData, studentData } = useAuth();
  
  const [availableHostels, setAvailableHostels] = useState<Hostel[]>([]);
  const [activeHostelId, setActiveHostelIdState] = useState<string>(() => {
    return localStorage.getItem('ira_active_hostel_id') || '';
  });
  const [activeHostel, setActiveHostel] = useState<Hostel | null>(null);
  const [loadingHostels, setLoadingHostels] = useState<boolean>(true);

  // Load all hostels
  const refreshHostels = async () => {
    setLoadingHostels(true);
    try {
      const list = await getAllHostels();
      setAvailableHostels(list);
    } catch (err) {
      console.error('Failed to load hostels list:', err);
      setAvailableHostels([]);
    } finally {
      setLoadingHostels(false);
    }
  };

  useEffect(() => {
    refreshHostels();
  }, []);

  // Sync active hostel ID based on user role and assigned hostel
  useEffect(() => {
    if (role === 'superintendent' || role === 'staff' || role === 'student') {
      const userAssignedHostel = userProfile?.hostelId || adminData?.hostelId || studentData?.hostelId;
      if (userAssignedHostel) {
        setActiveHostelIdState(userAssignedHostel);
        localStorage.setItem('ira_active_hostel_id', userAssignedHostel);
      }
    } else if (role === 'super_admin') {
      const stored = localStorage.getItem('ira_active_hostel_id');
      if (stored) {
        setActiveHostelIdState(stored);
      }
    }
  }, [role, userProfile, adminData, studentData]);

  // Fetch active hostel details when activeHostelId changes
  useEffect(() => {
    let isMounted = true;
    if (!activeHostelId) {
      setActiveHostel(null);
      return;
    }

    getHostelById(activeHostelId).then(hostel => {
      if (isMounted) {
        if (hostel) {
          setActiveHostel(hostel);
        } else {
          // Fallback from availableHostels list if single doc fetch returns null
          const found = availableHostels.find(h => h.id === activeHostelId);
          setActiveHostel(found || null);
        }
      }
    });

    return () => {
      isMounted = false;
    };
  }, [activeHostelId, availableHostels]);

  const setActiveHostelId = (hostelId: string) => {
    setActiveHostelIdState(hostelId);
    if (hostelId) {
      localStorage.setItem('ira_active_hostel_id', hostelId);
    } else {
      localStorage.removeItem('ira_active_hostel_id');
    }
  };

  return (
    <HostelContext.Provider value={{
      activeHostelId,
      activeHostel,
      availableHostels,
      loadingHostels,
      setActiveHostelId,
      refreshHostels
    }}>
      {children}
    </HostelContext.Provider>
  );
};
