import { useSessionStore } from '../stores/sessionStore';
import { useUploadStore } from '../stores/uploadStore';
import { formatFileSize } from '../utils/format';

export default function BatchTrackerPanel() {
  const { batches, currentBatchNumber, isBatchActive, startBatch } = useSessionStore();
  const { files } = useUploadStore();

  const completedCount = files.filter(f => f.status === 'completed').length;
  const totalFiles = files.length;
  const progress = totalFiles > 0 ? Math.round((completedCount / totalFiles) * 100) : 0;
  const totalBytes = files.reduce((sum, f) => sum + f.size, 0);
  const uploadedBytes = files.reduce((sum, f) => sum + f.uploadedBytes, 0);

  return (
    <div className="flex flex-col h-full p-4 space-y-3">
      <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Batches</h2>

      {/* Completed batches */}
      {batches.map(batch => {
        const hasFailed = batch.failedFiles > 0;
        return (
          <div
            key={batch.batchNumber}
            className="flex items-center gap-3 px-3 py-2.5 rounded-lg bg-gray-800/50 border border-gray-700/30"
          >
            {hasFailed ? (
              <span className="w-6 h-6 rounded-full bg-amber-500/20 flex items-center justify-center flex-shrink-0">
                <svg className="w-3.5 h-3.5 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
                </svg>
              </span>
            ) : (
              <span className="w-6 h-6 rounded-full bg-green-500/20 flex items-center justify-center flex-shrink-0">
                <svg className="w-3.5 h-3.5 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </span>
            )}
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-white truncate">Batch {batch.batchNumber}</p>
              <p className="text-xs text-gray-400">{batch.fileCount} files &middot; {formatFileSize(batch.totalBytes)}</p>
            </div>
          </div>
        );
      })}

      {/* Active batch */}
      {isBatchActive && (
        <div className="flex items-center gap-3 px-3 py-2.5 rounded-lg bg-orange-500/10 border border-orange-500/30">
          <span className="w-6 h-6 rounded-full bg-orange-500/20 flex items-center justify-center flex-shrink-0">
            <span className="w-2 h-2 rounded-full bg-orange-400 animate-pulse" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-white truncate">Batch {currentBatchNumber} - In Progress</p>
            {totalFiles > 0 ? (
              <p className="text-xs text-gray-400">
                {completedCount}/{totalFiles} files &middot; {formatFileSize(uploadedBytes)}/{formatFileSize(totalBytes)}
              </p>
            ) : (
              <p className="text-xs text-gray-400">Waiting for files...</p>
            )}
            {totalFiles > 0 && (
              <div className="mt-1.5 w-full bg-gray-700 rounded-full h-1">
                <div
                  className="bg-orange-500 h-1 rounded-full transition-all duration-300"
                  style={{ width: `${progress}%` }}
                />
              </div>
            )}
          </div>
        </div>
      )}

      {/* Start batch button */}
      {!isBatchActive && (
        <button
          onClick={startBatch}
          className="w-full px-4 py-2.5 bg-orange-500 hover:bg-orange-600 text-white rounded-lg font-medium transition-colors text-sm"
        >
          {batches.length === 0 ? `Start Batch ${currentBatchNumber}` : 'Start Next Batch'}
        </button>
      )}

      {/* Spacer */}
      <div className="flex-1" />

      {/* Session summary */}
      {batches.length > 0 && (
        <div className="px-3 py-2 rounded-lg bg-gray-800/30 border border-gray-700/20">
          <p className="text-xs text-gray-500">
            {batches.reduce((sum, b) => sum + b.fileCount, 0)} files uploaded across {batches.length} batch{batches.length !== 1 ? 'es' : ''}
          </p>
        </div>
      )}
    </div>
  );
}
