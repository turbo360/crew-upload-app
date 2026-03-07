import { useEffect } from 'react';
import { useUploadStore } from '../stores/uploadStore';

export function useNetworkMonitor() {
  const pauseAllUploads = useUploadStore(s => s.pauseAllUploads);
  const startAllUploads = useUploadStore(s => s.startAllUploads);

  useEffect(() => {
    const handleOffline = () => {
      console.log('[Network] Went offline — pausing uploads');
      pauseAllUploads();
    };

    const handleOnline = () => {
      console.log('[Network] Back online — resuming uploads in 2s');
      setTimeout(() => startAllUploads(), 2000);
    };

    window.addEventListener('offline', handleOffline);
    window.addEventListener('online', handleOnline);

    return () => {
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('online', handleOnline);
    };
  }, [pauseAllUploads, startAllUploads]);
}
