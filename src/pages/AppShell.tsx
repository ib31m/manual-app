import { useState } from 'react';
import { useApp } from '../store/AppContext';
import { CARGO_SHIP_TYPES } from '../domain/types';
import { isSendable } from '../domain/validation';
import { deriveVoyageState } from '../domain/sequence';
import { SERVER_VERSION } from '../server/mockServer';
import { StateChip } from '../components/common/Status';

import { Dashboard } from './Dashboard';
import { EventsPage } from './Events';
import { VoyagesPage } from './Voyages';
import { CargoPage } from './Cargo';
import { PortLogsPage } from './PortLogs';
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
  | 'portlogs'
  | 'officers'
  | 'cargo'
  | 'reports'
  | 'outbox'
  | 'settings';

interface NavItem {
  key: PageKey;
  label: string;
  icon: string;
  group: string;
  cargoOnly?: boolean;
}

const NAV: NavItem[] = [
  { key: 'dashboard', label: 'Overview', icon: '🧭', group: 'Bridge' },
  { key: 'voyages', label: 'Voyages', icon: '🗺️', group: 'Bridge' },
  { key: 'schedule', label: 'Schedule', icon: '📅', group: 'Bridge' },
  { key: 'agents', label: 'Agents', icon: '🏢', group: 'Bridge' },
  { key: 'events', label: 'Events', icon: '📝', group: 'Reporting' },
  { key: 'portlogs', label: 'Port logs', icon: '⚓', group: 'Reporting', cargoOnly: true },
  { key: 'cargo', label: 'Cargo', icon: '📦', group: 'Reporting', cargoOnly: true },
  { key: 'officers', label: 'Officers', icon: '👮', group: 'Reporting' },
  { key: 'reports', label: 'Reports', icon: '📊', group: 'Output' },
  { key: 'outbox', label: 'Communication', icon: '📡', group: 'Output' },
  { key: 'settings', label: 'Settings', icon: '⚙️', group: 'Output' },
];

const TITLES: Record<PageKey, string> = {
  dashboard: 'Overview',
  voyages: 'Voyages',
  schedule: 'Schedule',
  agents: 'Agents',
  events: 'Events',
  portlogs: 'Port logs',
  officers: 'Officers',
  cargo: 'Cargo',
  reports: 'Reports',
  outbox: 'Communication — Outbox',
  settings: 'Settings',
};

const GROUPS = ['Bridge', 'Reporting', 'Output'];

export function AppShell() {
  const { db, logout } = useApp();
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

  const visible = (n: NavItem) => !n.cargoOnly || showCargo;

  return (
    <div className="shell">
      {menuOpen && <div className="backdrop" onClick={() => setMenuOpen(false)} />}
      <aside className={`sidebar${menuOpen ? ' open' : ''}`}>
        <div className="brand">
          <div className="logo"><span className="mark">⚓</span> s-Log Recorder</div>
          <div className="ship">
            <strong>{db.config.vesselName}</strong>
            IMO {db.config.imo} · {db.config.shipType}
            <br />Call sign {db.config.callSign} · {db.config.flag}
          </div>
        </div>
        <nav className="nav">
          {GROUPS.map((grp) => (
            <div key={grp}>
              <div className="nav-group">{grp}</div>
              {NAV.filter((n) => n.group === grp && visible(n)).map((n) => (
                <button key={n.key} className={page === n.key ? 'active' : ''} onClick={() => go(n.key)}>
                  <span className="nav-icon">{n.icon}</span>
                  <span>{n.label}</span>
                  {n.key === 'outbox' && unsent.length > 0 && (
                    <span className={`count${blockedCount ? ' alert' : ''}`}>{unsent.length}</span>
                  )}
                </button>
              ))}
            </div>
          ))}
        </nav>
        <div className="sidebar-foot">
          <div className="row spread">
            <span className="chip chip-ok offline-tag"><span className="dot" />Offline-ready</span>
            <button className="btn-ghost btn-sm" style={{ color: '#b7c6d8' }} onClick={logout}>Log out</button>
          </div>
          <div style={{ marginTop: 8 }}>Recorder config v{db.config.configVersion}</div>
        </div>
      </aside>

      <div className="main">
        <header className="topbar">
          <button className="btn-ghost menu-toggle" onClick={() => setMenuOpen(true)}>☰</button>
          <span className="title">{TITLES[page]}</span>
          <StateChip state={voyageState} />
          <div className="spacer" />
          {upgradeAvailable && (
            <span className="chip chip-amber" title="A new version is available (Performance Lite §2.5)">⬆ Upgrade available</span>
          )}
        </header>

        <main className="content">
          {page === 'dashboard' && <Dashboard onNavigate={go} />}
          {page === 'voyages' && <VoyagesPage />}
          {page === 'schedule' && <SchedulePage />}
          {page === 'agents' && <AgentsPage />}
          {page === 'events' && <EventsPage />}
          {page === 'portlogs' && showCargo && <PortLogsPage />}
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
