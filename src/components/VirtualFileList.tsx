import { useRef } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { UploadFile } from '../stores/uploadStore';
import { formatFileSize, formatSpeed } from '../utils/format';

interface VirtualFileListProps {
  files: UploadFile[];
  onRemove: (id: string) => void;
  onRetry: (id: string) => void;
  onPause: (id: string) => void;
  onResume: (id: string) => void;
}

export default function VirtualFileList({ files, onRemove, onRetry, onPause, onResume }: VirtualFileListProps) {
  const parentRef = useRef<HTMLDivElement>(null);

  const virtualizer = useVirtualizer({
    count: files.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 72,
    overscan: 10,
  });

  return (
    <div ref={parentRef} className="max-h-[400px] overflow-y-auto">
      <div
        style={{
          height: `${virtualizer.getTotalSize()}px`,
          width: '100%',
          position: 'relative',
        }}
      >
        {virtualizer.getVirtualItems().map(virtualRow => {
          const file = files[virtualRow.index];
          return (
            <div
              key={file.id}
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                height: `${virtualRow.size}px`,
                transform: `translateY(${virtualRow.start}px)`,
              }}
            >
              <VirtualFileItem
                file={file}
                onRemove={() => onRemove(file.id)}
                onRetry={() => onRetry(file.id)}
                onPause={() => onPause(file.id)}
                onResume={() => onResume(file.id)}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}

function VirtualFileItem({ file, onRemove, onRetry, onPause, onResume }: {
  file: UploadFile;
  onRemove: () => void;
  onRetry: () => void;
  onPause: () => void;
  onResume: () => void;
}) {
  const displaySpeed = file.emaSpeed && file.emaSpeed > 0 ? file.emaSpeed : file.speed;

  return (
    <div className="px-4 py-3 hover:bg-gray-700/30 transition-colors border-b border-gray-700/50 last:border-0">
      <div className="flex items-center gap-3">
        <StatusIcon status={file.status} />

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className="text-sm font-medium text-white truncate">{file.name}</p>
            <span className="text-xs text-gray-500">{formatFileSize(file.size)}</span>
          </div>

          {(file.status === 'uploading' || file.status === 'paused' || file.progress > 0) && (
            <div className="mt-1.5 flex items-center gap-2">
              <div className="flex-1 h-1 bg-gray-700 rounded-full overflow-hidden">
                <div
                  className={`h-full transition-all duration-300 rounded-full ${
                    file.status === 'completed' ? 'bg-green-500' :
                    file.status === 'error' ? 'bg-red-500' :
                    file.status === 'paused' ? 'bg-yellow-500' :
                    'bg-orange-500'
                  } ${file.status === 'uploading' ? 'shimmer-bar' : ''}`}
                  style={{ width: `${file.progress}%` }}
                />
              </div>
              <span className="text-xs text-gray-400 w-8 text-right">
                {file.status === 'uploading' && file.progress === 0 ? 'Starting...' : `${file.progress}%`}
              </span>
              {file.status === 'uploading' && displaySpeed && displaySpeed > 0 && (
                <span className="text-xs text-orange-400 font-mono" style={{ fontVariantNumeric: 'tabular-nums' }}>{formatSpeed(displaySpeed)}</span>
              )}
            </div>
          )}

          {file.isStalled && file.status === 'uploading' && (
            <p className="text-xs text-yellow-400 mt-0.5">Slow connection — still uploading...</p>
          )}

          {file.status === 'error' && file.error && (
            <p className="text-xs text-red-400 mt-0.5 truncate">{file.error}</p>
          )}
        </div>

        {/* Actions */}
        <div className="flex-shrink-0 flex items-center gap-1">
          {file.status === 'uploading' && (
            <button onClick={onPause} className="p-1.5 text-gray-400 hover:text-white hover:bg-gray-700 rounded transition-colors" title="Pause">
              <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 9v6m4-6v6" />
              </svg>
            </button>
          )}
          {file.status === 'paused' && (
            <button onClick={onResume} className="p-1.5 text-gray-400 hover:text-white hover:bg-gray-700 rounded transition-colors" title="Resume">
              <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
              </svg>
            </button>
          )}
          {file.status === 'error' && (
            <button onClick={onRetry} className="p-1.5 text-gray-400 hover:text-white hover:bg-gray-700 rounded transition-colors" title="Retry">
              <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            </button>
          )}
          {file.status !== 'uploading' && (
            <button onClick={onRemove} className="p-1.5 text-gray-400 hover:text-red-400 hover:bg-gray-700 rounded transition-colors" title="Remove">
              <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function StatusIcon({ status }: { status: UploadFile['status'] }) {
  switch (status) {
    case 'completed':
      return <svg className="h-4 w-4 text-green-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>;
    case 'error':
      return <svg className="h-4 w-4 text-red-500 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>;
    case 'uploading':
      return <svg className="h-4 w-4 text-orange-400 animate-spin flex-shrink-0" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>;
    case 'paused':
      return <svg className="h-4 w-4 text-yellow-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 9v6m4-6v6" /></svg>;
    default:
      return <svg className="h-4 w-4 text-gray-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>;
  }
}
