import { useState, useEffect } from 'react';

interface Portal {
  id: string;
  name: string;
  subdomain: string;
  active: boolean;
}

export default function PortalPicker() {
  const [portals, setPortals] = useState<Portal[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const isMac = window.electronAPI?.platform === 'darwin';

  useEffect(() => {
    fetchPortals();
  }, []);

  const fetchPortals = async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await window.electronAPI.fetchMasvPortals();
      if (result.success && result.portals) {
        setPortals(result.portals.filter(p => p.active));
      } else {
        setError(result.error || 'Failed to fetch portals');
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSelectPortal = (portal: Portal) => {
    window.electronAPI.openPortal(portal.subdomain);
  };

  return (
    <div
      className="min-h-screen flex flex-col relative"
      style={{
        backgroundImage: 'url(./bg.jpg)',
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundRepeat: 'no-repeat',
      }}
    >
      <div className="absolute inset-0 bg-black/60" />

      {/* Drag region for macOS */}
      {isMac && (
        <div className="relative z-10 h-8 titlebar-drag-region" />
      )}

      <div className={`relative z-10 flex-1 flex items-center justify-center px-4 ${isMac ? '' : 'pt-8'}`}>
        <div className="w-full max-w-lg">
          <div className="bg-gray-900/90 backdrop-blur-sm rounded-2xl shadow-2xl p-8 border border-gray-700/50">
            {/* Logo */}
            <div className="text-center mb-8">
              <img
                src="./logo-dark.png"
                alt="Crew Upload"
                className="h-16 mx-auto mb-4"
                onError={(e) => { e.currentTarget.style.display = 'none'; }}
              />
              <h1 className="text-2xl font-bold text-white">Crew Upload</h1>
              <p className="text-gray-400 mt-2">Select your event to start uploading</p>
            </div>

            {/* Error */}
            {error && (
              <div className="mb-6 bg-red-900/50 border border-red-500 text-red-200 px-4 py-3 rounded-lg">
                <p>{error}</p>
                <button
                  type="button"
                  onClick={() => { setError(null); fetchPortals(); }}
                  className="text-sm underline mt-1"
                >
                  Retry
                </button>
              </div>
            )}

            {/* Loading */}
            {loading && (
              <div className="py-12 text-center text-gray-400">
                <svg className="animate-spin h-8 w-8 mx-auto mb-3 text-orange-500" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                Loading events...
              </div>
            )}

            {/* Portal list */}
            {!loading && !error && portals.length === 0 && (
              <div className="py-12 text-center text-gray-400">
                No active portals found.
              </div>
            )}

            {!loading && portals.length > 0 && (
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {portals.map((portal) => (
                  <button
                    key={portal.id}
                    onClick={() => handleSelectPortal(portal)}
                    className="w-full text-left px-5 py-4 rounded-lg border border-gray-700/50 bg-gray-800/50 hover:bg-orange-500/20 hover:border-orange-500 text-gray-200 hover:text-white transition-all group"
                  >
                    <div className="flex items-center justify-between">
                      <p className="font-medium">{portal.name}</p>
                      <svg className="w-5 h-5 text-gray-600 group-hover:text-orange-500 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                      </svg>
                    </div>
                  </button>
                ))}
              </div>
            )}

            {/* Refresh button */}
            {!loading && (
              <div className="mt-6 text-center">
                <button
                  onClick={fetchPortals}
                  className="text-sm text-gray-500 hover:text-white transition-colors"
                >
                  Refresh portal list
                </button>
              </div>
            )}
          </div>

          <p className="text-center text-xs text-gray-500 mt-4">
            &copy; {new Date().getFullYear()} Turbo 360. All rights reserved.
          </p>
        </div>
      </div>
    </div>
  );
}
