import { useEffect } from 'react';
import { useApp } from './store/AppContext';
import { Activation } from './pages/auth/Activation';
import { Login } from './pages/auth/Login';
import { InitWizard } from './pages/InitWizard';
import { AppShell } from './pages/AppShell';

export function App() {
  const { screen, toast, dismissToast } = useApp();

  // Auto-dismiss toasts.
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(dismissToast, 4000);
    return () => clearTimeout(t);
  }, [toast, dismissToast]);

  return (
    <>
      {screen === 'activation' && <Activation />}
      {screen === 'login' && <Login />}
      {screen === 'init' && <InitWizard />}
      {screen === 'app' && <AppShell />}

      {toast && (
        <div className={`toast ${toast.kind}`} role="status" onClick={dismissToast}>
          {toast.text}
        </div>
      )}
    </>
  );
}
