// localStorage persistence — the onboard "local data path" (offline-first).
// Everything the app stores lives here so the app works without a connection
// and survives reloads, exactly as the manuals describe for the onboard DB.

import type { OnboardDB, VesselConfig } from '../domain/types';

const ACTIVATION_KEY = 'slog.activation';
const SESSION_KEY = 'slog.session';
const DB_KEY = 'slog.db';
const BACKUP_KEY = 'slog.backup';

export interface Activation {
  token: string;
  config: VesselConfig;
  pwHash: string;
  activatedAt: string;
}

export interface Session {
  remembered: boolean;
  lastActive: string;
}

/** Tiny non-cryptographic hash — sufficient for a local demo only. */
export function hashPassword(pw: string): string {
  let h = 5381;
  for (let i = 0; i < pw.length; i++) h = (h * 33) ^ pw.charCodeAt(i);
  return (h >>> 0).toString(16);
}

function read<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

function write(key: string, value: unknown) {
  localStorage.setItem(key, JSON.stringify(value));
}

export const loadActivation = () => read<Activation>(ACTIVATION_KEY);
export const saveActivation = (a: Activation) => write(ACTIVATION_KEY, a);

export const loadSession = () => read<Session>(SESSION_KEY);
export const saveSession = (s: Session) => write(SESSION_KEY, s);

export const loadDB = () => read<OnboardDB>(DB_KEY);
export const saveDB = (db: OnboardDB) => write(DB_KEY, db);

export const loadBackup = () => read<{ db: OnboardDB; at: string }>(BACKUP_KEY);
export const saveBackup = (db: OnboardDB) => write(BACKUP_KEY, { db, at: new Date().toISOString() });

/** Reset of the installation (Performance Lite §2.4) — clears everything. */
export function clearAll() {
  localStorage.removeItem(ACTIVATION_KEY);
  localStorage.removeItem(SESSION_KEY);
  localStorage.removeItem(DB_KEY);
  localStorage.removeItem(BACKUP_KEY);
}
