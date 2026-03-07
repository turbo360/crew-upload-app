import { useState, useEffect, useRef } from 'react';
import { useUploadStore } from '../stores/uploadStore';
import { useSessionStore } from '../stores/sessionStore';
import DropZone from '../components/DropZone';
import FileQueue from '../components/FileQueue';
import UploadControls from '../components/UploadControls';
import BatchProgress from '../components/BatchProgress';
import BatchCompleteBanner from '../components/BatchCompleteBanner';
import BatchTrackerPanel from '../components/BatchTrackerPanel';
import { formatFileSize } from '../utils/format';

export default function UploadPage() {
  const { files, clearForNewBatch } = useUploadStore();
  const { session, batches, currentBatchNumber, isBatchActive, completeBatch } = useSessionStore();

  // Track the batch start time
  const batchStartRef = useRef<string | null>(null);
  // Track whether we've already completed this batch
  const batchCompletedRef = useRef(false);
  // Email sent ref
  const emailSentRef = useRef(false);
  // Show completion banner state
  const [showBanner, setShowBanner] = useState(false);
  const [bannerStats, setBannerStats] = useState<{
    batchNumber: number;
    fileCount: number;
    totalBytes: number;
    duration: number;
    failedFiles: number;
  } | null>(null);

  const uploadingCount = files.filter(f => f.status === 'uploading').length;
  const completedCount = files.filter(f => f.status === 'completed').length;
  const failedCount = files.filter(f => f.status === 'error').length;
  const pendingCount = files.filter(f => f.status === 'pending' || f.status === 'paused').length;

  // Check if all uploads in current batch are done
  const allDone = files.length > 0 && uploadingCount === 0 && pendingCount === 0;

  // Set batch start time when first file starts uploading
  useEffect(() => {
    if (uploadingCount > 0 && !batchStartRef.current) {
      batchStartRef.current = new Date().toISOString();
      batchCompletedRef.current = false;
      emailSentRef.current = false;
    }
  }, [uploadingCount]);

  // Handle batch completion
  useEffect(() => {
    if (allDone && !batchCompletedRef.current && files.length > 0) {
      batchCompletedRef.current = true;

      const completedAt = new Date().toISOString();
      const startedAt = batchStartRef.current || completedAt;
      const totalBytes = files.reduce((sum, f) => sum + f.size, 0);
      const duration = new Date(completedAt).getTime() - new Date(startedAt).getTime();

      // Send batch completion notification (only once per batch)
      if (!emailSentRef.current && session && window.electronAPI) {
        emailSentRef.current = true;
        const completedFiles = files.filter(f => f.status === 'completed');
        window.electronAPI.sendCompletionEmail({
          projectName: session.projectName,
          crewName: session.crewName,
          batchNumber: currentBatchNumber,
          fileCount: completedFiles.length,
          totalSize: formatFileSize(totalBytes),
          fileNames: completedFiles.map(f => f.name)
        });
      }

      // Record batch stats for the banner
      setBannerStats({
        batchNumber: currentBatchNumber,
        fileCount: files.length,
        totalBytes,
        duration,
        failedFiles: failedCount
      });

      // After a 2-second celebration, complete the batch and clear for next
      const timer = setTimeout(() => {
        completeBatch({
          fileCount: files.length,
          completedFiles: completedCount,
          failedFiles: failedCount,
          totalBytes,
          startedAt,
          completedAt
        });

        clearForNewBatch();
        batchStartRef.current = null;
        setShowBanner(true);
      }, 2000);

      return () => clearTimeout(timer);
    }
  }, [allDone, files, currentBatchNumber, completedCount, failedCount, completeBatch, clearForNewBatch, session]);

  return (
    <div className="flex h-full">
      {/* Left sidebar - Batch Tracker */}
      <aside className="w-72 flex-shrink-0 bg-gray-900/80 backdrop-blur-sm border-r border-gray-700/50">
        <BatchTrackerPanel />
      </aside>

      {/* Main content area */}
      <div className="flex-1 overflow-y-auto p-6 space-y-4">
        {/* Batch Complete Banner */}
        {showBanner && bannerStats && (
          <BatchCompleteBanner
            batchNumber={bannerStats.batchNumber}
            fileCount={bannerStats.fileCount}
            totalBytes={bannerStats.totalBytes}
            duration={bannerStats.duration}
            failedFiles={bannerStats.failedFiles}
          />
        )}

        {/* Drop Zone */}
        <DropZone disabled={!isBatchActive} />

        {/* Active Batch: Progress + Controls + File Queue */}
        {isBatchActive && files.length > 0 && (
          <>
            <BatchProgress batchNumber={currentBatchNumber} />
            <UploadControls />
            <FileQueue />
          </>
        )}
      </div>
    </div>
  );
}
