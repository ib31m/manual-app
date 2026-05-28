import { useState } from 'react';
import { useApp } from '../store/AppContext';
import { CARGO_SHIP_TYPES } from '../domain/types';
import { isSendable } from '../domain/validation';
import { deriveVoyageState } from '../domain/sequence';
import { SERVER_VERSION } from '../server/mockServer';

import { Dashboard } from './Dashboard';
import { EventsPage } from './Events';
import { VoyagesPage } from './Voyages';
import { CargoPage } from './Cargo';
import { OfficersPage } from './Officers';
import { SchedulePage } from './Schedule';
import { AgentsPage } from './Agents';
import { ReportsPage } from './Reports';
import { OutboxPage } from './Outbox';
import { SettingsPage } from './Settings';

export type PageKey =
  | 'dashboard'
  | 'voyages'
  | 'schedule'
  | 'agents'
  | 'events'
  | 'officers'
  | 'cargo'
  | 'reports'
  | 'outbox'
  | 'settings';

interface NavItem {
  key: PageKey;
  label: string;
  icon: string;
  cargoOnly?: boolean;
}

const NAV: NavItem[] = [
  { key: 'dashboard', label: 'Overview', icon: '🧭' },
  { key: 'voyages', label: 'Voyages', icon: '🗺️' },
  { key: 'schedule', label: 'Schedule', icon: '📅' },
  { key: 'agents', label: 'Agents', icon: '🏢' },
  { key: 'events', label: 'Events', icon: '📝' },
  { key: 'officers', label: 'Officers', icon: '👮' },
  { key: 'cargo', label: 'Cargo', icon: '📦', cargoOnly: true },
  { key: 'reports', label: 'Reports', icon: '📊' },
  { key: 'outbox', label: 'Communication', icon: '📡' },
  { key: 'settings', label: 'Settings', icon: '⚙️' },
];

const TITLES: Record<PageKey, string> = {
  dashboard: 'Overview',
  voyages: 'Voyages',
  schedule: 'Schedule',
  agents: 'Agents',
  events: 'Events',
  officers: 'Officers',
  cargo: 'Cargo',
  reports: 'Reports',
  outbox: 'Communication — Outbox',
  settings: 'Settings',
};

export function AppShell() {
  const { db, activation, logout } = useApp();
  const [page, setPage] = useState<PageKey>('dashboard');
  const [menuOpen, setMenuOpen] = useState(false);

  if (!db) return null;
  const showCargo = CARGO_SHIP_TYPES.includes(db.config.shipType);
  const unsent = db.events.filter((e) => e.status !== 'sent');
  const blockedCount = unsent.filter((e) => !isSendable(db, e)).length;
  const voyageState = deriveVoyageState(db.events);
  const upgradeAvailable = db.config.configVersion !== SERVER_VERSION;

  function go(key: PageKey) {
    setPage(key);
    setMenuOpen(false);
  }

  return (
    <div className="shell">
      {menuOpen && <div className="backdrop" onClick={() => setMenuOpen(false)} />}
      <aside className={`sidebar${menuOpen ? ' open' : ''}`}>
        <div className="brand">
          <div className="logo">⚓ s-Log Recorder</div>
          <div className="ship">
            {db.config.vesselName}
            <br />
            IMO {db.config.imo} · {db.config.shipType}
          </div>
        </div>
        <nav className="nav">
          {NAV.filter((n) => !n.cargoOnly || showCargo).map((n) => (
            <button
              key={n.key}
              className={page === n.key ? 'active' : ''}
              onClick={() => go(n.key)}
            >
              <span className="nav-icon">{n.icon}</span>
              <span>{n.label}</span>
              {n.key === 'outbox' && unsent.length > 0 && (
                <span className={`count${blockedCount ? ' alert' : ''}`}>{unsent.length}</span>
              )}
            </button>
          ))}
        </nav>
        <div className="sidebar-foot">
          <div className="row spread">
            <span className="badge badge-ok offline-tag">● Offline-ready</span>
            <button className="btn-ghost btn-sm" style={{ color: '#cdd9e9' }} onClick={logout}>
              Log out
            </button>
          </div>
          <div style={{ marginTop: 8 }}>Config v{db.config.configVersion}</div>
        </div>
      </aside>

      <div className="main">
        <header className="topbar">
          <button className="btn-ghost menu-toggle" onClick={() => setMenuOpen(true)}>
            ☰
          </button>
          <span className="title">{TITLES[page]}</span>
          <span className="badge badge-state">{voyageState}</span>
          <div className="spacer" />
          {upgradeAvailable && (
            <span className="badge badge-amber" title="A new version is available (Performance Lite §2.5)">
              ⬆ Upgrade available
            </span>
          )}
          <span className="text-muted nowrap" style={{ fontSize: '.82rem' }}>
            {activation?.config.flag}
          </span>
        </header>

        <main className="content">
          {page === 'dashboard' && <Dashboard onNavigate={go} />}
          {page === 'voyages' && <VoyagesPage />}
          {page === 'schedule' && <SchedulePage />}
          {page === 'agents' && <AgentsPage />}
          {page === 'events' && <EventsPage />}
          {page === 'officers' && <OfficersPage />}
          {page === 'cargo' && showCargo && <CargoPage />}
          {page === 'reports' && <ReportsPage />}
          {page === 'outbox' && <OutboxPage />}
          {page === 'settings' && <SettingsPage />}
        </main>
      </div>
    </div>
  );
}
