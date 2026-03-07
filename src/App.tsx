import { useAuthStore } from './stores/authStore';
import { useSessionStore } from './stores/sessionStore';
import Layout from './components/Layout';
import StartPage from './pages/StartPage';
import UploadPage from './pages/UploadPage';
import UpdateNotification from './components/UpdateNotification';
import { useNetworkMonitor } from './hooks/useNetworkMonitor';

export default function App() {
  const { isAuthenticated } = useAuthStore();
  const { session } = useSessionStore();
  useNetworkMonitor();

  return (
    <>
      <UpdateNotification />
      <Layout>
        {(!isAuthenticated || !session) ? (
          <StartPage />
        ) : (
          <UploadPage />
        )}
      </Layout>
    </>
  );
}
