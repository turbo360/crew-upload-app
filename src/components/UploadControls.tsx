import { useUploadStore } from '../stores/uploadStore';

export default function UploadControls() {
  const { files, isUploading, pauseAllUploads, retryAllFailed } = useUploadStore();

  const errorCount = files.filter(f => f.status === 'error').length;

  if (!isUploading && errorCount === 0) return null;

  return (
    <div className="flex flex-wrap items-center gap-3">
      {/* Pause All */}
      {isUploading && (
        <button
          onClick={pauseAllUploads}
          className="inline-flex items-center gap-2 px-4 py-2 bg-yellow-600 hover:bg-yellow-700 text-white rounded-lg font-medium transition-colors"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 9v6m4-6v6" />
          </svg>
          Pause All
        </button>
      )}

      {/* Retry Failed */}
      {errorCount > 0 && (
        <button
          onClick={retryAllFailed}
          className="inline-flex items-center gap-1.5 px-3 py-2 bg-red-500/20 text-red-400 hover:bg-red-500/30 rounded-lg font-medium transition-colors text-sm"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          Retry Failed ({errorCount})
        </button>
      )}
    </div>
  );
}
