/// <reference types="vite/client" />

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
