import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('electronAPI', {
  selectFiles: () => ipcRenderer.invoke('select-files'),
  selectFolders: () => ipcRenderer.invoke('select-folders'),
  getFileSize: (filePath: string) => ipcRenderer.invoke('get-file-size', filePath),
  expandPath: (filePath: string) => ipcRenderer.invoke('expand-path', filePath),
  platform: process.platform,

  // Native upload API - uploads happen in main process (fast!)
  startUpload: (params: {
    uploadId: string;
    filePath: string;
    endpoint: string;
    metadata: Record<string, string>;
    token: string;
  }) => ipcRenderer.invoke('start-upload', params),

  pauseUpload: (uploadId: string) => ipcRenderer.invoke('pause-upload', uploadId),

  resumeUpload: (params: {
    uploadId: string;
    filePath: string;
    endpoint: string;
    metadata: Record<string, string>;
    token: string;
  }) => ipcRenderer.invoke('resume-upload', params),

  abortUpload: (uploadId: string) => ipcRenderer.invoke('abort-upload', uploadId),

  // Event listeners for upload progress
  onUploadProgress: (callback: (data: { uploadId: string; bytesUploaded: number; bytesTotal: number }) => void) => {
    const handler = (_: any, data: any) => callback(data);
    ipcRenderer.on('upload-progress', handler);
    return () => ipcRenderer.removeListener('upload-progress', handler);
  },

  onUploadComplete: (callback: (data: { uploadId: string }) => void) => {
    const handler = (_: any, data: any) => callback(data);
    ipcRenderer.on('upload-complete', handler);
    return () => ipcRenderer.removeListener('upload-complete', handler);
  },

  onUploadError: (callback: (data: { uploadId: string; error: string }) => void) => {
    const handler = (_: any, data: any) => callback(data);
    ipcRenderer.on('upload-error', handler);
    return () => ipcRenderer.removeListener('upload-error', handler);
  },

  onUploadHeartbeat: (callback: (data: { uploadId: string }) => void) => {
    const handler = (_: any, data: any) => callback(data);
    ipcRenderer.on('upload-heartbeat', handler);
    return () => ipcRenderer.removeListener('upload-heartbeat', handler);
  },

  onUploadPausedBySystem: (callback: (data: { uploadId: string }) => void) => {
    const handler = (_: any, data: any) => callback(data);
    ipcRenderer.on('upload-paused-by-system', handler);
    return () => ipcRenderer.removeListener('upload-paused-by-system', handler);
  },

  onTokenExpired: (callback: () => void) => {
    const handler = () => callback();
    ipcRenderer.on('token-expired', handler);
    return () => ipcRenderer.removeListener('token-expired', handler);
  },

  sendCompletionEmail: (params: {
    projectName: string;
    crewName: string;
    batchNumber?: number;
    fileCount: number;
    totalSize: string;
    fileNames: string[];
  }) => ipcRenderer.invoke('send-completion-email', params),

  // Auto-updater API
  checkForUpdates: () => ipcRenderer.invoke('check-for-updates'),
  downloadUpdate: () => ipcRenderer.invoke('download-update'),
  installUpdate: () => ipcRenderer.invoke('install-update'),
  getAppVersion: () => ipcRenderer.invoke('get-app-version'),

  onUpdateAvailable: (callback: (data: { version: string; releaseNotes?: string }) => void) => {
    const handler = (_: any, data: any) => callback(data);
    ipcRenderer.on('update-available', handler);
    return () => ipcRenderer.removeListener('update-available', handler);
  },

  onUpdateDownloadProgress: (callback: (data: { percent: number; transferred: number; total: number }) => void) => {
    const handler = (_: any, data: any) => callback(data);
    ipcRenderer.on('update-download-progress', handler);
    return () => ipcRenderer.removeListener('update-download-progress', handler);
  },

  onUpdateDownloaded: (callback: (data: { version: string }) => void) => {
    const handler = (_: any, data: any) => callback(data);
    ipcRenderer.on('update-downloaded', handler);
    return () => ipcRenderer.removeListener('update-downloaded', handler);
  },

  onUpdateError: (callback: (data: { error: string }) => void) => {
    const handler = (_: any, data: any) => callback(data);
    ipcRenderer.on('update-error', handler);
    return () => ipcRenderer.removeListener('update-error', handler);
  },

  onCheckForUpdatesClicked: (callback: () => void) => {
    const handler = () => callback();
    ipcRenderer.on('check-for-updates-clicked', handler);
    return () => ipcRenderer.removeListener('check-for-updates-clicked', handler);
  },
});

// Types for the exposed API
declare global {
  interface Window {
    electronAPI: {
      selectFiles: () => Promise<FileInfo[]>;
      selectFolders: () => Promise<FileInfo[]>;
      getFileSize: (filePath: string) => Promise<number>;
      expandPath: (filePath: string) => Promise<FileInfo[]>;
      platform: string;

      startUpload: (params: {
        uploadId: string;
        filePath: string;
        endpoint: string;
        metadata: Record<string, string>;
        token: string;
      }) => Promise<{ success: boolean }>;

      pauseUpload: (uploadId: string) => Promise<{ success: boolean }>;

      resumeUpload: (params: {
        uploadId: string;
        filePath: string;
        endpoint: string;
        metadata: Record<string, string>;
        token: string;
      }) => Promise<{ success: boolean }>;

      abortUpload: (uploadId: string) => Promise<{ success: boolean }>;

      onUploadProgress: (callback: (data: { uploadId: string; bytesUploaded: number; bytesTotal: number }) => void) => () => void;
      onUploadComplete: (callback: (data: { uploadId: string }) => void) => () => void;
      onUploadError: (callback: (data: { uploadId: string; error: string }) => void) => () => void;
      onUploadHeartbeat: (callback: (data: { uploadId: string }) => void) => () => void;
      onUploadPausedBySystem: (callback: (data: { uploadId: string }) => void) => () => void;
      onTokenExpired: (callback: () => void) => () => void;
      sendCompletionEmail: (params: { projectName: string; crewName: string; batchNumber?: number; fileCount: number; totalSize: string; fileNames: string[] }) => Promise<{ success: boolean }>;

      // Auto-updater
      checkForUpdates: () => Promise<{ updateAvailable?: boolean; isDev?: boolean; error?: string }>;
      downloadUpdate: () => Promise<{ success?: boolean; error?: string }>;
      installUpdate: () => void;
      getAppVersion: () => Promise<string>;
      onUpdateAvailable: (callback: (data: { version: string; releaseNotes?: string }) => void) => () => void;
      onUpdateDownloadProgress: (callback: (data: { percent: number; transferred: number; total: number }) => void) => () => void;
      onUpdateDownloaded: (callback: (data: { version: string }) => void) => () => void;
      onUpdateError: (callback: (data: { error: string }) => void) => () => void;
      onCheckForUpdatesClicked: (callback: () => void) => () => void;
    };
  }
}

interface FileInfo {
  path: string;
  name: string;
  relativePath?: string;
  size: number;
  type: string;
}
