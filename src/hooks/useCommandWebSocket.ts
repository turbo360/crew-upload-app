import { useEffect, useRef } from 'react';
import { useUploadStore } from '../stores/uploadStore';
import { useSessionStore } from '../stores/sessionStore';
import { useAuthStore } from '../stores/authStore';
import { API_BASE_URL } from '../utils/api';

/**
 * Connects to the crew-upload server's WebSocket command channel.
 * Listens for admin-initiated retry commands and triggers retryAllFailed().
 */
export function useCommandWebSocket() {
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const session = useSessionStore(s => s.session);
  const token = useAuthStore(s => s.token);
  const retryAllFailed = useUploadStore(s => s.retryAllFailed);

  useEffect(() => {
    if (!session?.id || !token) return;

    const connect = () => {
      const wsUrl = API_BASE_URL.replace('https://', 'wss://').replace('http://', 'ws://');

      try {
        const ws = new WebSocket(`${wsUrl}/ws/client`);
        wsRef.current = ws;

        ws.onopen = () => {
          ws.send(JSON.stringify({
            type: 'auth',
            token,
            sessionId: session.id
          }));
          console.log('[CommandWS] Connected and authenticated');
        };

        ws.onmessage = (event) => {
          try {
            const msg = JSON.parse(event.data);
            if (msg.type === 'command' && msg.action === 'retry-failed') {
              console.log('[CommandWS] Received retry-failed command');
              retryAllFailed();
            }
          } catch {
            // ignore parse errors
          }
        };

        ws.onclose = () => {
          wsRef.current = null;
          // Auto-reconnect after 5s
          reconnectTimerRef.current = setTimeout(connect, 5000);
        };

        ws.onerror = () => {
          // onclose will fire after this
        };
      } catch {
        reconnectTimerRef.current = setTimeout(connect, 5000);
      }
    };

    connect();

    return () => {
      if (reconnectTimerRef.current) {
        clearTimeout(reconnectTimerRef.current);
        reconnectTimerRef.current = null;
      }
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
    };
  }, [session?.id, token, retryAllFailed]);
}
