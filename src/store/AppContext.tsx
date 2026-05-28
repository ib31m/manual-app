import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import type { OnboardDB, VesselConfig } from '../domain/types';
import {
  Activation,
  clearAll,
  hashPassword,
  loadActivation,
  loadBackup,
  loadDB,
  loadSession,
  saveActivation,
  saveBackup,
  saveDB,
  saveSession,
} from './persistence';
import { rememberedPasswordExpired } from '../domain/auth';
import { emptyDB } from '../data/seed';

export type Screen = 'activation' | 'login' | 'init' | 'app';

interface AppState {
  screen: Screen;
  activation: Activation | null;
  db: OnboardDB | null;
  toast: { kind: 'ok' | 'err' | 'info'; text: string } | null;
}

interface AppContextValue extends AppState {
  // activation / auth
  activate: (token: string, config: VesselConfig, password: string, remember: boolean) => void;
  login: (password: string, remember: boolean) => boolean;
  setNewPassword: (password: string) => void;
  logout: () => void;
  resetInstallation: () => void;
  // db lifecycle
  finishInit: (db: OnboardDB) => void;
  update: (mutator: (db: OnboardDB) => void) => void;
  setDB: (db: OnboardDB) => void;
  backup: () => void;
  restore: () => void;
  // ui
  notify: (kind: 'ok' | 'err' | 'info', text: string) => void;
  dismissToast: () => void;
}

const Ctx = createContext<AppContextValue | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const [activation, setActivation] = useState<Activation | null>(() => loadActivation());
  const [db, setDb] = useState<OnboardDB | null>(() => loadDB());
  const [toast, setToast] = useState<AppState['toast']>(null);

  // Decide the initial screen from persisted state (offline-first boot).
  const [screen, setScreen] = useState<Screen>(() => {
    const act = loadActivation();
    if (!act) return 'activation';
    const session = loadSession();
    const remembered =
      session?.remembered && !rememberedPasswordExpired(session.lastActive);
    if (!remembered) return 'login';
    const d = loadDB();
    return d?.initialized ? 'app' : 'init';
  });

  // Persist db whenever it changes.
  useEffect(() => {
    if (db) saveDB(db);
  }, [db]);

  const notify = useCallback((kind: 'ok' | 'err' | 'info', text: string) => {
    setToast({ kind, text });
  }, []);
  const dismissToast = useCallback(() => setToast(null), []);

  const activate = useCallback(
    (token: string, config: VesselConfig, password: string, remember: boolean) => {
      const act: Activation = {
        token,
        config,
        pwHash: hashPassword(password),
        activatedAt: new Date().toISOString(),
      };
      saveActivation(act);
      setActivation(act);
      const fresh = emptyDB(config);
      fresh.settings.rememberPassword = remember;
      saveDB(fresh);
      setDb(fresh);
      // Setting the password logs the vessel in for the first time.
      saveSession({ remembered: remember, lastActive: new Date().toISOString() });
      setScreen('init');
    },
    [],
  );

  const login = useCallback(
    (password: string, remember: boolean): boolean => {
      if (!activation) return false;
      if (hashPassword(password) !== activation.pwHash) return false;
      saveSession({ remembered: remember, lastActive: new Date().toISOString() });
      const d = loadDB();
      setScreen(d?.initialized ? 'app' : 'init');
      return true;
    },
    [activation],
  );

  const setNewPassword = useCallback(
    (password: string) => {
      if (!activation) return;
      const updated = { ...activation, pwHash: hashPassword(password) };
      saveActivation(updated);
      setActivation(updated);
    },
    [activation],
  );

  const logout = useCallback(() => {
    saveSession({ remembered: false, lastActive: new Date().toISOString() });
    setScreen('login');
  }, []);

  const resetInstallation = useCallback(() => {
    clearAll();
    setActivation(null);
    setDb(null);
    setScreen('activation');
  }, []);

  const finishInit = useCallback((next: OnboardDB) => {
    const init = { ...next, initialized: true };
    saveDB(init);
    setDb(init);
    setScreen('app');
  }, []);

  const setDB = useCallback((next: OnboardDB) => {
    saveDB(next);
    setDb(next);
  }, []);

  const update = useCallback((mutator: (d: OnboardDB) => void) => {
    setDb((cur) => {
      if (!cur) return cur;
      // structuredClone keeps updates immutable for React.
      const next = structuredClone(cur);
      mutator(next);
      saveDB(next);
      return next;
    });
  }, []);

  const backup = useCallback(() => {
    if (!db) return;
    saveBackup(db);
    update((d) => {
      d.lastBackup = new Date().toISOString();
    });
    notify('ok', 'Backup created onboard.');
  }, [db, update, notify]);

  const restore = useCallback(() => {
    const b = loadBackup();
    if (!b) {
      notify('err', 'No backup available to restore.');
      return;
    }
    setDB(b.db);
    notify('info', `Restored backup from ${new Date(b.at).toLocaleString()}.`);
  }, [setDB, notify]);

  const value = useMemo<AppContextValue>(
    () => ({
      screen,
      activation,
      db,
      toast,
      activate,
      login,
      setNewPassword,
      logout,
      resetInstallation,
      finishInit,
      update,
      setDB,
      backup,
      restore,
      notify,
      dismissToast,
    }),
    [
      screen,
      activation,
      db,
      toast,
      activate,
      login,
      setNewPassword,
      logout,
      resetInstallation,
      finishInit,
      update,
      setDB,
      backup,
      restore,
      notify,
      dismissToast,
    ],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useApp(): AppContextValue {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useApp must be used within AppProvider');
  return ctx;
}

/** Convenience hook that asserts the DB is present (inside the app shell). */
export function useDB(): { db: OnboardDB; update: AppContextValue['update'] } {
  const { db, update } = useApp();
  if (!db) throw new Error('DB not available');
  return { db, update };
}
