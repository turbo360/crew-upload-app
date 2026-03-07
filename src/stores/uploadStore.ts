import { create } from 'zustand';
import { useAuthStore } from './authStore';
import { useSessionStore } from './sessionStore';
import { API_BASE_URL, reportUploadProgress } from '../utils/api';

export interface UploadFile {
  id: string;
  path: string;
  name: string;
  relativePath?: string;
  size: number;
  type: string;
  progress: number;
  status: 'pending' | 'uploading' | 'completed' | 'error' | 'paused';
  error?: string;
  uploadedBytes: number;
  startTime?: number;
  speed?: number; // Average speed
  instantSpeed?: number; // Current/instant speed (last update)
  emaSpeed?: number; // Smoothed speed (EMA)
  lastUpdateTime?: number;
  lastUpdateBytes?: number;
  lastHeartbeat?: number;
  isStalled?: boolean;
}

interface UploadState {
  files: UploadFile[];
  isUploading: boolean;
  addFiles: (files: FileInfo[]) => void;
  removeFile: (id: string) => void;
  startUpload: (id: string) => void;
  pauseUpload: (id: string) => void;
  resumeUpload: (id: string) => void;
  retryUpload: (id: string) => void;
  retryAllFailed: () => void;
  startAllUploads: () => void;
  pauseAllUploads: () => void;
  clearCompleted: () => void;
  clearAll: () => void;
  clearForNewBatch: () => void;
  handleProgress: (uploadId: string, bytesUploaded: number, bytesTotal: number) => void;
  handleComplete: (uploadId: string) => void;
  handleError: (uploadId: string, error: string) => void;
}

// Initialize event listeners once
let listenersInitialized = false;
let progressReportInterval: ReturnType<typeof setInterval> | null = null;
let sessionStartTime: string | null = null;

// Function to report progress to backend
async function sendProgressReport(files: UploadFile[]) {
  const session = useSessionStore.getState().session;
  console.log('[Progress Report] Session:', session?.id, 'Files:', files.length);
  if (!session || files.length === 0) {
    console.log('[Progress Report] Skipping - no session or files');
    return;
  }

  // Only report if there are active uploads
  const hasActiveUploads = files.some(f =>
    f.status === 'uploading' || f.status === 'pending' || f.status === 'paused'
  );
  if (!hasActiveUploads && files.every(f => f.status === 'completed')) {
    // All done - send final update then stop
    await reportUploadProgress({
      session_id: session.id,
      project_name: session.projectName,
      crew_name: session.crewName,
      started_at: sessionStartTime || undefined,
      files: files.map(f => ({
        id: f.id,
        name: f.name,
        size: f.size,
        uploadedBytes: f.uploadedBytes,
        progress: f.progress,
        status: f.status,
        speed: f.speed
      }))
    });
    return;
  }

  await reportUploadProgress({
    session_id: session.id,
    project_name: session.projectName,
    crew_name: session.crewName,
    started_at: sessionStartTime || undefined,
    files: files.map(f => ({
      id: f.id,
      name: f.name,
      size: f.size,
      uploadedBytes: f.uploadedBytes,
      progress: f.progress,
      status: f.status,
      speed: f.speed
    }))
  });
}

// Start progress reporting interval
function startProgressReporting(getFiles: () => UploadFile[]) {
  if (progressReportInterval) return; // Already running

  sessionStartTime = new Date().toISOString();

  // Report every 2 seconds
  progressReportInterval = setInterval(() => {
    sendProgressReport(getFiles());
  }, 2000);

  // Send initial report immediately
  sendProgressReport(getFiles());
}

// Stop progress reporting interval
function stopProgressReporting(getFiles: () => UploadFile[]) {
  if (progressReportInterval) {
    // Send final report
    sendProgressReport(getFiles());
    clearInterval(progressReportInterval);
    progressReportInterval = null;
    sessionStartTime = null;
  }
}

export const useUploadStore = create<UploadState>((set, get) => {
  // Set up IPC event listeners when store is created
  if (!listenersInitialized && window.electronAPI) {
    listenersInitialized = true;

    window.electronAPI.onUploadProgress((data) => {
      get().handleProgress(data.uploadId, data.bytesUploaded, data.bytesTotal);
    });

    window.electronAPI.onUploadComplete((data) => {
      get().handleComplete(data.uploadId);
    });

    window.electronAPI.onUploadError((data) => {
      get().handleError(data.uploadId, data.error);
    });

    window.electronAPI.onUploadHeartbeat((data) => {
      set(state => ({
        files: state.files.map(f =>
          f.id === data.uploadId ? { ...f, lastHeartbeat: Date.now(), isStalled: false } : f
        )
      }));
    });

    window.electronAPI.onUploadPausedBySystem((data) => {
      set(state => ({
        files: state.files.map(f =>
          f.id === data.uploadId ? { ...f, status: 'paused' } : f
        )
      }));
    });

    // Stall detection: check every 10s if any uploading file hasn't had progress or heartbeat in 30s
    setInterval(() => {
      const now = Date.now();
      const files = get().files;
      const needsUpdate = files.some(f =>
        f.status === 'uploading' &&
        f.lastUpdateTime &&
        (now - Math.max(f.lastUpdateTime, f.lastHeartbeat || 0)) > 30000 &&
        !f.isStalled
      );
      if (needsUpdate) {
        set(state => ({
          files: state.files.map(f => {
            if (f.status === 'uploading' && f.lastUpdateTime) {
              const lastActivity = Math.max(f.lastUpdateTime, f.lastHeartbeat || 0);
              if ((now - lastActivity) > 30000) {
                return { ...f, isStalled: true };
              }
            }
            return f;
          })
        }));
      }
    }, 10000);
  }

  return {
    files: [],
    isUploading: false,

    handleProgress: (uploadId: string, bytesUploaded: number, bytesTotal: number) => {
      const progress = Math.round((bytesUploaded / bytesTotal) * 100);
      const file = get().files.find(f => f.id === uploadId);
      const now = Date.now();

      // Calculate average speed
      const elapsed = (now - (file?.startTime || now)) / 1000;
      const avgSpeed = elapsed > 0 ? bytesUploaded / elapsed : 0;

      // Calculate instant speed (bytes transferred since last update)
      let instantSpeed = file?.instantSpeed || 0;
      if (file?.lastUpdateTime && file?.lastUpdateBytes !== undefined) {
        const timeDelta = (now - file.lastUpdateTime) / 1000;
        if (timeDelta > 0.1) { // At least 100ms between updates to avoid spikes
          const bytesDelta = bytesUploaded - file.lastUpdateBytes;
          instantSpeed = bytesDelta / timeDelta;
        }
      }

      // EMA smoothed speed
      const EMA_ALPHA = 0.3;
      let emaSpeed = file?.emaSpeed || 0;
      if (instantSpeed > 0) {
        emaSpeed = emaSpeed === 0 ? instantSpeed : EMA_ALPHA * instantSpeed + (1 - EMA_ALPHA) * emaSpeed;
      }

      set(state => ({
        files: state.files.map(f =>
          f.id === uploadId ? {
            ...f,
            progress,
            uploadedBytes: bytesUploaded,
            speed: avgSpeed,
            instantSpeed,
            emaSpeed,
            lastUpdateTime: now,
            lastUpdateBytes: bytesUploaded,
            lastHeartbeat: now,
            isStalled: false
          } : f
        )
      }));
    },

    handleComplete: (uploadId: string) => {
      set(state => ({
        files: state.files.map(f =>
          f.id === uploadId ? { ...f, status: 'completed', progress: 100 } : f
        )
      }));

      // Start next pending uploads to maintain 8 concurrent uploads for maximum NAS throughput
      const files = get().files;
      const activeUploads = files.filter(f => f.status === 'uploading').length;
      const pendingFiles = files.filter(f => f.status === 'pending');
      const slotsAvailable = Math.max(0, 8 - activeUploads);

      pendingFiles.slice(0, slotsAvailable).forEach(f => get().startUpload(f.id));

      if (pendingFiles.length === 0 && activeUploads === 0) {
        set({ isUploading: false });
        // Stop progress reporting when all uploads complete
        stopProgressReporting(() => get().files);
      }
    },

    handleError: (uploadId: string, error: string) => {
      set(state => ({
        files: state.files.map(f =>
          f.id === uploadId ? { ...f, status: 'error', error } : f
        ),
        isUploading: get().files.some(f => f.status === 'uploading')
      }));
    },

    addFiles: (newFiles: FileInfo[]) => {
      const existingPaths = new Set(get().files.map(f => f.path));
      const filesToAdd = newFiles
        .filter(f => !existingPaths.has(f.path))
        .map(f => ({
          id: `${Date.now()}-${Math.random().toString(36).substring(7)}`,
          path: f.path,
          name: f.name,
          relativePath: f.relativePath,
          size: f.size,
          type: f.type,
          progress: 0,
          status: 'pending' as const,
          uploadedBytes: 0
        }));

      set(state => ({
        files: [...state.files, ...filesToAdd]
      }));

      // Auto-start uploads when files are added
      if (filesToAdd.length > 0) {
        get().startAllUploads();
      }
    },

    removeFile: (id: string) => {
      const file = get().files.find(f => f.id === id);
      if (file?.status === 'uploading') {
        window.electronAPI.abortUpload(id);
      }
      set(state => ({
        files: state.files.filter(f => f.id !== id)
      }));
    },

    startUpload: async (id: string) => {
      const state = get();
      const file = state.files.find(f => f.id === id);
      if (!file || file.status === 'uploading') return;

      const token = useAuthStore.getState().token;
      const session = useSessionStore.getState().session;

      if (!token || !session) return;

      // Start progress reporting if not already running
      if (!progressReportInterval) {
        startProgressReporting(() => get().files);
      }

      set(state => ({
        files: state.files.map(f =>
          f.id === id ? { ...f, status: 'uploading', startTime: Date.now() } : f
        ),
        isUploading: true
      }));

      // Start upload in main process
      await window.electronAPI.startUpload({
        uploadId: id,
        filePath: file.path,
        endpoint: `${API_BASE_URL}/files`,
        metadata: {
          filename: file.relativePath || file.name,
          filetype: file.type,
          sessionId: session.id,
          projectName: session.projectName,
          crewName: session.crewName
        },
        token
      });
    },

    pauseUpload: (id: string) => {
      window.electronAPI.pauseUpload(id);
      set(state => ({
        files: state.files.map(f =>
          f.id === id ? { ...f, status: 'paused' } : f
        ),
        isUploading: get().files.some(f => f.status === 'uploading')
      }));
    },

    resumeUpload: async (id: string) => {
      const file = get().files.find(f => f.id === id);
      if (!file) return;

      const token = useAuthStore.getState().token;
      const session = useSessionStore.getState().session;
      if (!token || !session) return;

      set(state => ({
        files: state.files.map(f =>
          f.id === id ? { ...f, status: 'uploading' } : f
        ),
        isUploading: true
      }));

      await window.electronAPI.resumeUpload({
        uploadId: id,
        filePath: file.path,
        endpoint: `${API_BASE_URL}/files`,
        metadata: {
          filename: file.relativePath || file.name,
          filetype: file.type,
          sessionId: session.id,
          projectName: session.projectName,
          crewName: session.crewName
        },
        token
      });
    },

    retryUpload: (id: string) => {
      set(state => ({
        files: state.files.map(f =>
          f.id === id ? { ...f, status: 'pending', error: undefined, isStalled: false } : f
        )
      }));
      get().startUpload(id);
    },

    retryAllFailed: () => {
      // Reset all failed files to pending — keep progress/bytes for TUS resume
      set(state => ({
        files: state.files.map(f =>
          f.status === 'error' ? { ...f, status: 'pending', error: undefined, isStalled: false } : f
        )
      }));
      // Start uploads (respecting concurrent limit)
      get().startAllUploads();
    },

    startAllUploads: () => {
      const files = get().files;
      const pendingFiles = files.filter(f => f.status === 'pending' || f.status === 'paused');
      const activeUploads = files.filter(f => f.status === 'uploading').length;

      // Start progress reporting when uploads begin
      if (pendingFiles.length > 0 && activeUploads === 0) {
        startProgressReporting(() => get().files);
      }

      // Start up to 8 concurrent uploads for maximum throughput
      const slotsAvailable = Math.max(0, 8 - activeUploads);
      const toStart = pendingFiles.slice(0, slotsAvailable);
      toStart.forEach(f => get().startUpload(f.id));
    },

    pauseAllUploads: () => {
      get().files
        .filter(f => f.status === 'uploading')
        .forEach(f => get().pauseUpload(f.id));
    },

    clearCompleted: () => {
      set(state => ({
        files: state.files.filter(f => f.status !== 'completed')
      }));
    },

    clearAll: () => {
      // Stop progress reporting
      stopProgressReporting(() => get().files);
      // Abort all active uploads
      get().files.forEach(f => {
        if (f.status === 'uploading') {
          window.electronAPI.abortUpload(f.id);
        }
      });
      set({ files: [], isUploading: false });
    },

    clearForNewBatch: () => {
      // Stop progress reporting for this batch
      stopProgressReporting(() => get().files);
      // Clear files but do NOT end session
      set({ files: [], isUploading: false });
    }
  };
});
