import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { api, reportSessionStart, reportSessionEnd } from '../utils/api';
import { useAuthStore } from './authStore';

interface Session {
  id: string;
  projectName: string;
  crewName: string;
  notes?: string;
  createdAt?: string;
}

export interface BatchRecord {
  batchNumber: number;
  fileCount: number;
  completedFiles: number;
  failedFiles: number;
  totalBytes: number;
  startedAt: string;
  completedAt: string;
}

interface SessionState {
  session: Session | null;
  isLoading: boolean;
  error: string | null;
  batches: BatchRecord[];
  currentBatchNumber: number;
  isBatchActive: boolean;
  createSession: (projectName: string, crewName: string, notes?: string) => Promise<boolean>;
  completeBatch: (stats: Omit<BatchRecord, 'batchNumber'>) => void;
  startBatch: () => void;
  startNewBatch: () => void;
  clearSession: () => void;
  clearError: () => void;
}

export const useSessionStore = create<SessionState>()(
  persist(
    (set, get) => ({
      session: null,
      isLoading: false,
      error: null,
      batches: [],
      currentBatchNumber: 1,
      isBatchActive: false,

      createSession: async (projectName: string, crewName: string, notes?: string) => {
        set({ isLoading: true, error: null });
        try {
          const token = useAuthStore.getState().token;
          const response = await api.post('/api/session/create', { projectName, crewName, notes }, token!);
          const sessionData = {
            id: response.session.id,
            projectName: response.session.projectName,
            crewName: response.session.crewName,
            createdAt: new Date().toISOString(),
            notes
          };
          set({
            session: sessionData,
            isLoading: false,
            batches: [],
            currentBatchNumber: 1
          });

          // Report session start to backend for live monitoring
          console.log('[Session] About to report session start:', sessionData.id);
          reportSessionStart({
            session_id: sessionData.id,
            project_name: sessionData.projectName,
            crew_name: sessionData.crewName
          }).then(result => {
            console.log('[Session] Session start reported, result:', result);
          }).catch(err => {
            console.error('[Session] Failed to report session start:', err);
          });

          return true;
        } catch (error: any) {
          set({
            error: error.message || 'Failed to create session',
            isLoading: false
          });
          return false;
        }
      },

      completeBatch: (stats) => {
        const { currentBatchNumber, batches } = get();
        const batchRecord: BatchRecord = {
          batchNumber: currentBatchNumber,
          ...stats
        };
        set({
          batches: [...batches, batchRecord],
          currentBatchNumber: currentBatchNumber + 1,
          isBatchActive: false
        });
      },

      startBatch: () => {
        set({ isBatchActive: true });
      },

      startNewBatch: () => {
        // currentBatchNumber is already incremented by completeBatch
      },

      clearSession: () => {
        const currentSession = useSessionStore.getState().session;
        if (currentSession) {
          // Report session end to backend for live monitoring
          reportSessionEnd(currentSession.id);
        }
        set({
          session: null,
          batches: [],
          currentBatchNumber: 1,
          isBatchActive: false
        });
        // Clear persisted storage so a new session is created next time
        useSessionStore.persist.clearStorage();
      },
      clearError: () => set({ error: null })
    }),
    {
      name: 'crew-upload-session',
      partialize: (state) => ({
        session: state.session,
        batches: state.batches,
        currentBatchNumber: state.currentBatchNumber,
        isBatchActive: state.isBatchActive
      })
    }
  )
);
