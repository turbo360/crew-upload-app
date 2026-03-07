import { useState, useEffect, useRef } from 'react';
import { useUploadStore } from '../stores/uploadStore';
import VirtualFileList from './VirtualFileList';

export default function FileQueue() {
  const { files, removeFile, retryUpload, pauseUpload, resumeUpload } = useUploadStore();
  const [showAll, setShowAll] = useState(false);
  const [hiddenIds, setHiddenIds] = useState<Set<string>>(new Set());
  const timersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  // Auto-hide completed files after 5 seconds
  useEffect(() => {
    const completedFiles = files.filter(f => f.status === 'completed');
    for (const file of completedFiles) {
      if (!hiddenIds.has(file.id) && !timersRef.current.has(file.id)) {
        const timer = setTimeout(() => {
          setHiddenIds(prev => new Set(prev).add(file.id));
          timersRef.current.delete(file.id);
        }, 5000);
        timersRef.current.set(file.id, timer);
      }
    }

    return () => {
      // Clean up timers for files that no longer exist
      for (const [id, timer] of timersRef.current) {
        if (!files.some(f => f.id === id)) {
          clearTimeout(timer);
          timersRef.current.delete(id);
        }
      }
    };
  }, [files, hiddenIds]);

  // Reset hidden IDs when files are cleared (new batch)
  useEffect(() => {
    if (files.length === 0) {
      setHiddenIds(new Set());
      for (const timer of timersRef.current.values()) {
        clearTimeout(timer);
      }
      timersRef.current.clear();
    }
  }, [files.length]);

  const visibleFiles = files.filter(f => !hiddenIds.has(f.id));
  const activeFiles = visibleFiles.filter(f => f.status === 'uploading');
  const completedCount = files.filter(f => f.status === 'completed').length;
  const pendingCount = files.filter(f => f.status === 'pending' || f.status === 'paused').length;
  const errorCount = files.filter(f => f.status === 'error').length;

  const displayFiles = showAll ? visibleFiles : visibleFiles.filter(f => f.status !== 'completed');

  return (
    <div className="bg-gray-900/70 backdrop-blur-sm rounded-lg border border-gray-700/50 overflow-hidden">
      {/* Active uploads header */}
      {!showAll && displayFiles.length > 0 && (
        <div className="px-4 py-3 border-b border-gray-700/50">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-white">Active ({activeFiles.length})</span>
            <div className="flex items-center gap-3 text-xs text-gray-400">
              {completedCount > 0 && <span className="text-green-400">Completed: {completedCount}</span>}
              {pendingCount > 0 && <span>Queued: {pendingCount}</span>}
              {errorCount > 0 && <span className="text-red-400">Failed: {errorCount}</span>}
            </div>
          </div>
        </div>
      )}

      {/* Show all header */}
      {showAll && (
        <div className="px-4 py-3 border-b border-gray-700/50">
          <span className="text-sm font-medium text-white">All Files ({visibleFiles.length})</span>
        </div>
      )}

      {/* File list */}
      {displayFiles.length > 0 && (
        <VirtualFileList
          files={displayFiles}
          onRemove={removeFile}
          onRetry={retryUpload}
          onPause={pauseUpload}
          onResume={resumeUpload}
        />
      )}

      {/* No active files message */}
      {!showAll && displayFiles.length === 0 && files.length > 0 && (
        <div className="px-4 py-4 text-center text-sm text-gray-400">
          No active uploads
        </div>
      )}

      {/* Toggle button */}
      {visibleFiles.length > displayFiles.length && (
        <button
          onClick={() => setShowAll(!showAll)}
          className="w-full px-4 py-2.5 border-t border-gray-700/50 text-xs text-gray-400 hover:text-white hover:bg-gray-700/30 transition-colors"
        >
          {showAll ? 'Show active only' : `Show all ${visibleFiles.length} files`}
        </button>
      )}
    </div>
  );
}
