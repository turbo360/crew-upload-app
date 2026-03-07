import { useState, useEffect } from 'react';

type UpdateState = 'idle' | 'available' | 'downloading' | 'ready' | 'error';

export default function UpdateNotification() {
  const [updateState, setUpdateState] = useState<UpdateState>('idle');
  const [version, setVersion] = useState<string>('');
  const [downloadProgress, setDownloadProgress] = useState(0);
  const [error, setError] = useState<string>('');

  useEffect(() => {
    if (!window.electronAPI) return;

    const cleanupAvailable = window.electronAPI.onUpdateAvailable((data) => {
      setVersion(data.version);
      setUpdateState('downloading');
    });

    const cleanupProgress = window.electronAPI.onUpdateDownloadProgress((data) => {
      setDownloadProgress(Math.round(data.percent));
    });

    const cleanupDownloaded = window.electronAPI.onUpdateDownloaded((data) => {
      setVersion(data.version);
      setUpdateState('ready');
    });

    const cleanupError = window.electronAPI.onUpdateError((data) => {
      setError(data.error);
      setUpdateState('error');
    });

    return () => {
      cleanupAvailable();
      cleanupProgress();
      cleanupDownloaded();
      cleanupError();
    };
  }, []);

  const handleInstall = () => {
    window.electronAPI.installUpdate();
  };

  const handleRetry = () => {
    setError('');
    setUpdateState('downloading');
    setDownloadProgress(0);
    window.electronAPI.checkForUpdates();
  };

  if (updateState === 'idle') {
    return null;
  }

  return (
    <div className="fixed inset-0 z-[100] bg-gray-950/95 backdrop-blur-sm flex items-center justify-center">
      <div className="max-w-md w-full mx-4 text-center">
        {updateState === 'downloading' && (
          <>
            <div className="w-16 h-16 bg-orange-500/20 rounded-full flex items-center justify-center mx-auto mb-6">
              <svg className="w-8 h-8 text-orange-500 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
            </div>
            <h2 className="text-2xl font-bold text-white mb-2">Updating to v{version}</h2>
            <p className="text-gray-400 mb-6">
              A required update is being downloaded. Please wait...
            </p>
            <div className="w-full bg-gray-800 rounded-full h-3 mb-2">
              <div
                className="bg-orange-500 h-3 rounded-full transition-all duration-300"
                style={{ width: `${downloadProgress}%` }}
              />
            </div>
            <p className="text-sm text-gray-500">{downloadProgress}%</p>
          </>
        )}

        {updateState === 'ready' && (
          <>
            <div className="w-16 h-16 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-6">
              <svg className="w-8 h-8 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h2 className="text-2xl font-bold text-white mb-2">Update Ready</h2>
            <p className="text-gray-400 mb-6">
              Version {version} has been downloaded. The app will restart to apply the update.
            </p>
            <button
              onClick={handleInstall}
              className="w-full px-6 py-3 bg-green-500 hover:bg-green-600 text-white rounded-lg font-semibold transition-colors text-lg"
            >
              Restart & Update Now
            </button>
          </>
        )}

        {updateState === 'error' && (
          <>
            <div className="w-16 h-16 bg-red-500/20 rounded-full flex items-center justify-center mx-auto mb-6">
              <svg className="w-8 h-8 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <h2 className="text-2xl font-bold text-white mb-2">Update Failed</h2>
            <p className="text-gray-400 mb-6">
              {error || 'Failed to download update. Please check your internet connection.'}
            </p>
            <button
              onClick={handleRetry}
              className="w-full px-6 py-3 bg-orange-500 hover:bg-orange-600 text-white rounded-lg font-semibold transition-colors"
            >
              Retry Update
            </button>
          </>
        )}
      </div>
    </div>
  );
}
