import { ReactNode, useState } from 'react';
import { useAuthStore } from '../stores/authStore';
import { useSessionStore } from '../stores/sessionStore';
import { useUploadStore } from '../stores/uploadStore';
import { formatFileSize } from '../utils/format';
import SessionBar from './SessionBar';

interface LayoutProps {
  children: ReactNode;
}

export default function Layout({ children }: LayoutProps) {
  const { isAuthenticated, logout } = useAuthStore();
  const { session, batches, isBatchActive, startBatch, clearSession } = useSessionStore();
  const { clearAll, files } = useUploadStore();
  const [endingSession, setEndingSession] = useState(false);

  const handleLogout = async () => {
    const hasActiveUploads = files.some(f => f.status === 'uploading');
    const totalFiles = batches.reduce((sum, b) => sum + b.fileCount, 0);

    if (hasActiveUploads) {
      if (!confirm('You have uploads in progress. Are you sure you want to logout? Active uploads will be cancelled.')) {
        return;
      }
    } else if (totalFiles > 0) {
      if (!confirm(`Logout? You've uploaded ${totalFiles} files across ${batches.length} batch${batches.length !== 1 ? 'es' : ''} today. Make sure you've ended your session first if you're done.`)) {
        return;
      }
    }

    clearAll();
    clearSession();
    await logout();
  };

  const handleEndSession = async () => {
    if (endingSession || !session) return;

    const totalFiles = batches.reduce((sum, b) => sum + b.fileCount, 0);
    const totalBytes = batches.reduce((sum, b) => sum + b.totalBytes, 0);

    const confirmed = confirm(
      `End session for ${session.projectName}? ${batches.length} batch${batches.length !== 1 ? 'es' : ''}, ${totalFiles} files uploaded today.`
    );
    if (!confirmed) return;

    setEndingSession(true);
    try {
      if (window.electronAPI) {
        await window.electronAPI.sendCompletionEmail({
          projectName: session.projectName,
          crewName: session.crewName,
          fileCount: totalFiles,
          totalSize: formatFileSize(totalBytes),
          fileNames: []
        });
      }
      clearAll();
      clearSession();
      await logout();
    } catch (error) {
      console.error('Failed to end session:', error);
      setEndingSession(false);
    }
  };

  const isMac = window.electronAPI?.platform === 'darwin';

  return (
    <div
      className="min-h-screen flex flex-col relative"
      style={{
        backgroundImage: 'url(./bg.jpg)',
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundRepeat: 'no-repeat',
        backgroundAttachment: 'fixed',
      }}
    >
      {/* Dark overlay for better readability */}
      <div className="absolute inset-0 bg-black/60" />

      {/* Title bar / Header - Only show when authenticated */}
      {isAuthenticated && (
        <header className={`relative z-10 bg-gray-900/80 backdrop-blur-sm border-b border-gray-700/50 ${isMac ? 'titlebar-drag-region' : ''}`}>
          <div className="px-4 sm:px-6 lg:px-8">
            <div className={`flex justify-between items-center h-14 ${isMac ? 'pl-16' : ''}`}>
              {/* Logo */}
              <div className="flex items-center gap-3 titlebar-no-drag">
                <img
                  src="./logo-dark.png"
                  alt="Turbo 360"
                  className="h-8"
                  onError={(e) => {
                    e.currentTarget.style.display = 'none';
                  }}
                />
              </div>

              {/* Session info & actions */}
              <div className="flex items-center gap-4 titlebar-no-drag">
                {session && (
                  <div className="hidden sm:block">
                    <SessionBar />
                  </div>
                )}

                <div className="flex items-center gap-2">
                  <button
                    onClick={handleLogout}
                    className="px-3 py-1.5 text-sm text-gray-300 hover:text-white transition-colors"
                  >
                    Logout
                  </button>
                </div>
              </div>
            </div>
          </div>
        </header>
      )}

      {/* Main content */}
      <main className={`relative z-10 flex-1 overflow-hidden ${isAuthenticated ? '' : ''}`}>
        {children}
      </main>

      {/* Footer - Only show when authenticated */}
      {isAuthenticated && (
        <footer className="relative z-10 bg-gray-900/80 backdrop-blur-sm border-t border-gray-700/50 py-3">
          <div className="px-4 sm:px-6 lg:px-8 space-y-3">
            {session && !isBatchActive && (
              <button
                onClick={startBatch}
                className="w-full px-6 py-3 bg-green-500 hover:bg-green-600 text-white rounded-lg font-bold transition-colors text-base"
              >
                {batches.length === 0 ? 'Start Batch 1' : 'Start Next Batch'}
              </button>
            )}
            {session && (
              <button
                onClick={handleEndSession}
                disabled={endingSession}
                className="w-full px-6 py-3 bg-red-600 hover:bg-red-700 disabled:bg-red-800 disabled:cursor-wait text-white rounded-lg font-semibold transition-colors flex items-center justify-center gap-2"
              >
                {endingSession ? (
                  <>
                    <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Ending Session...
                  </>
                ) : (
                  <>
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                    </svg>
                    End Upload Session
                  </>
                )}
              </button>
            )}
            <p className="text-center text-xs text-gray-500">
              &copy; {new Date().getFullYear()} Turbo 360. All rights reserved.
            </p>
          </div>
        </footer>
      )}
    </div>
  );
}
