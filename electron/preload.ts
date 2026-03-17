import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('electronAPI', {
  platform: process.platform,

  // MASV portals
  fetchMasvPortals: () => ipcRenderer.invoke('fetch-masv-portals'),

  // Navigation
  openPortal: (subdomain: string) => ipcRenderer.invoke('open-portal', subdomain),
  goHome: () => ipcRenderer.invoke('go-home'),

  // Auto-updater
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

declare global {
  interface Window {
    electronAPI: {
      platform: string;

      fetchMasvPortals: () => Promise<{
        success: boolean;
        portals?: Array<{ id: string; name: string; subdomain: string; active: boolean }>;
        error?: string;
      }>;

      openPortal: (subdomain: string) => Promise<void>;
      goHome: () => Promise<void>;

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
