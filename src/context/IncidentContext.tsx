import React, { createContext, useContext } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { Incident, Ward } from '../types';
import { apiFetchIncidents, apiCreateIncident, apiUpdateIncident } from '../services/apiClient';
import { useAuth } from './AuthContext';
import confetti from 'canvas-confetti';

interface IncidentContextType {
  incidents: Incident[];
  isLoading: boolean;
  isError: boolean;
  refetchIncidents: () => void;
  createIncident: (inc: Incident) => Promise<Incident>;
  updateIncident: (id: string, updates: Partial<Incident>) => Promise<Incident>;
}

const IncidentContext = createContext<IncidentContextType | undefined>(undefined);

export const IncidentProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAuthenticated } = useAuth();
  const queryClient = useQueryClient();

  // 1. On application startup / auth: Automatically fetch GET /api/v1/incidents
  const {
    data: incidents = [],
    isLoading,
    isError,
    refetch: refetchIncidents,
  } = useQuery<Incident[]>({
    queryKey: ['incidents'],
    queryFn: apiFetchIncidents,
    enabled: isAuthenticated,
    refetchInterval: 4000, // Real-time background sync from backend database
    staleTime: 0,
  });

  // 4. Mutation for POST /api/v1/incidents: Automatically refreshes global incident store
  const createMutation = useMutation({
    mutationFn: apiCreateIncident,
    onSuccess: async (savedInc) => {
      queryClient.invalidateQueries({ queryKey: ['incidents'] });
      await queryClient.refetchQueries({ queryKey: ['incidents'] });
      queryClient.setQueryData(['wards'], (oldWards: Ward[] | undefined) => {
        if (!oldWards) return [];
        return oldWards.map((w) =>
          w.id === savedInc.wardId
            ? { ...w, openComplaints: w.openComplaints + 1, overallScore: Math.max(45, w.overallScore - 1) }
            : w
        );
      });
      confetti({ particleCount: 80, spread: 60, origin: { y: 0.7 } });
    },
  });

  // Mutation for PUT /api/v1/incidents/{id}
  const updateMutation = useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: Partial<Incident> }) => apiUpdateIncident(id, updates),
    onSuccess: async () => {
      queryClient.invalidateQueries({ queryKey: ['incidents'] });
      await queryClient.refetchQueries({ queryKey: ['incidents'] });
    },
  });

  const createIncident = async (inc: Incident): Promise<Incident> => {
    return await createMutation.mutateAsync(inc);
  };

  const updateIncident = async (id: string, updates: Partial<Incident>): Promise<Incident> => {
    return await updateMutation.mutateAsync({ id, updates });
  };

  return (
    <IncidentContext.Provider
      value={{
        incidents,
        isLoading,
        isError,
        refetchIncidents,
        createIncident,
        updateIncident,
      }}
    >
      {children}
    </IncidentContext.Provider>
  );
};

export const useIncidents = (): IncidentContextType => {
  const context = useContext(IncidentContext);
  if (!context) {
    throw new Error('useIncidents must be used within an IncidentProvider');
  }
  return context;
};
