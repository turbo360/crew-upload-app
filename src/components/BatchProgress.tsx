import { useMemo, useState, useEffect } from 'react';
import { useUploadStore } from '../stores/uploadStore';
import { formatFileSize, formatSpeed, formatTimeRemaining } from '../utils/format';

interface BatchProgressProps {
  batchNumber: number;
}

export default function BatchProgress({ batchNumber }: BatchProgressProps) {
  const { files } = useUploadStore();

  const stats = useMemo(() => {
    const total = files.length;
    const completed = files.filter(f => f.status === 'completed').length;
    const failed = files.filter(f => f.status === 'error').length;
    const uploading = files.filter(f => f.status === 'uploading').length;
    const queued = files.filter(f => f.status === 'pending' || f.status === 'paused').length;

    const totalBytes = files.reduce((sum, f) => sum + f.size, 0);
    const uploadedBytes = files.reduce((sum, f) => sum + f.uploadedBytes, 0);

    const uploadingFiles = files.filter(f => f.status === 'uploading');
    const totalSpeed = uploadingFiles.reduce((sum, f) => sum + (f.emaSpeed || f.speed || 0), 0);

    const overallProgress = totalBytes > 0 ? Math.round((uploadedBytes / totalBytes) * 100) : 0;

    return { total, completed, failed, uploading, queued, totalBytes, uploadedBytes, totalSpeed, overallProgress };
  }, [files]);

  const isComplete = stats.completed + stats.failed === stats.total && stats.total > 0;
  const barColor = isComplete
    ? stats.failed > 0 ? 'bg-amber-500' : 'bg-green-500'
    : 'bg-gradient-to-r from-orange-500 to-orange-400';

  return (
    <div className="bg-gray-900/70 backdrop-blur-sm rounded-lg p-4 border border-gray-700/50">
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm font-semibold text-white">
          Batch {batchNumber} &mdash; {isComplete ? 'Complete' : 'Uploading'}
        </span>
        <span className="text-sm font-medium text-white">{stats.overallProgress}%</span>
      </div>

      <div className="h-2 bg-gray-700 rounded-full overflow-hidden mb-3">
        <div
          className={`h-full transition-all duration-300 rounded-full ${barColor}`}
          style={{ width: `${stats.overallProgress}%` }}
        />
      </div>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-gray-400">
        <span>{stats.completed} / {stats.total} files</span>
        <span>{formatFileSize(stats.uploadedBytes)} / {formatFileSize(stats.totalBytes)}</span>
        {stats.totalSpeed > 0 && <span>{formatSpeed(stats.totalSpeed)}</span>}
        {stats.totalSpeed > 0 && stats.uploadedBytes < stats.totalBytes && (
          <span>ETA ~{formatTimeRemaining(stats.totalBytes - stats.uploadedBytes, stats.totalSpeed)}</span>
        )}
        {stats.uploading > 0 && <ElapsedTimer />}
      </div>
    </div>
  );
}

function ElapsedTimer() {
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    const start = Date.now();
    const interval = setInterval(() => {
      setElapsed(Math.floor((Date.now() - start) / 1000));
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  const mins = Math.floor(elapsed / 60);
  const secs = elapsed % 60;

  return <span>{mins > 0 ? `${mins}m ${secs}s` : `${secs}s`} elapsed</span>;
}
