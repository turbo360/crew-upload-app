/// <reference types="vite/client" />

interface FileInfo {
  path: string;
  name: string;
  relativePath?: string;
  size: number;
  type: string;
}

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
