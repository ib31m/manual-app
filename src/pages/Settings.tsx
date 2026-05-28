import { useApp } from '../store/AppContext';
import { SERVER_VERSION, requestConfigByImo } from '../server/mockServer';
import { loadBackup } from '../store/persistence';
import { CheckboxField, TextField } from '../components/common/Fields';
import { fmtUtc } from '../lib/util';

// §3.19 / §4.4 / §4.7 / §2.5 — program settings, data export, config import,
// backup & restore, and the upgrade prompt.
export function SettingsPage() {
  const { db, update, notify, backup, restore } = useApp();
  if (!db) return null;
  const s = db.settings;
  const setS = <K extends keyof typeof s>(k: K, v: (typeof s)[K]) => update((d) => { d.settings[k] = v; });
  const backupInfo = loadBackup();
  const upgradeAvailable = db.config.configVersion !== SERVER_VERSION;

  function importConfig() {
    const res = requestConfigByImo(db!.config.imo);
    if (!res.ok || !res.config) { notify('err', res.error ?? 'Import failed.'); return; }
    update((d) => { d.config = { ...res.config!, configVersion: SERVER_VERSION }; });
    notify('ok', `Configuration imported (v${SERVER_VERSION}). New objects will use the latest data.`);
  }

  return (
    <div className="stack">
      <div className="card">
        <h2>Vessel & configuration</h2>
        <div className="grid grid-2">
          <Info label="Vessel name" value={db.config.vesselName} />
          <Info label="IMO number" value={db.config.imo} />
          <Info label="Ship type" value={db.config.shipType} />
          <Info label="Call sign" value={db.config.callSign} />
          <Info label="Flag" value={db.config.flag} />
          <Info label="Config version" value={`v${db.config.configVersion} (server v${SERVER_VERSION})`} />
        </div>
        <div className="btn-row" style={{ marginTop: 12 }}>
          <button className="btn-primary" onClick={importConfig}>Import configuration</button>
          {upgradeAvailable && <span className="badge badge-amber">A new configuration / version is available</span>}
        </div>
        <div className="hint" style={{ marginTop: 6 }}>
          Identifies the vessel by IMO and loads the latest config. Existing voyages/events keep the
          configuration valid when they were created.
        </div>
      </div>

      <div className="card">
        <h2>Data export</h2>
        <CheckboxField label="Data export configured (required to send reports)" checked={s.exportConfigured} onChange={(v) => setS('exportConfigured', v)} />
        <TextField label="s-Insight | Log Server e-mail" value={s.exportEmail} onChange={(v) => setS('exportEmail', v)} />
        <CheckboxField label="Include details of invalid (unsent) events when sending" checked={s.includeInvalidEventDetails} onChange={(v) => setS('includeInvalidEventDetails', v)} hint="Helps shore assist with validation errors (§4.5)." />
      </div>

      <div className="card">
        <h2>Reporting</h2>
        <TextField label="Default noon time (pre-filled when creating noon reports)" type="time" value={s.defaultNoonTime} onChange={(v) => setS('defaultNoonTime', v)} />
        <CheckboxField
          label="Allow event deletion (incl. already-sent events)"
          checked={s.allowEventDeletion}
          onChange={(v) => setS('allowEventDeletion', v)}
          hint="Use with care: deletion of sent events requires verbal confirmation and cannot be undone (§3.13)."
        />
      </div>

      <div className="card">
        <h2>Backup</h2>
        <CheckboxField label="Automatic backup after each successful send" checked={s.autoBackup} onChange={(v) => setS('autoBackup', v)} hint="May slow report sending for large databases." />
        <div className="row wrap" style={{ gap: 10, marginTop: 8 }}>
          <button className="btn-primary" onClick={backup}>Backup now</button>
          <button onClick={restore} disabled={!backupInfo}>Restore latest backup</button>
          <span className="text-muted">
            {backupInfo ? `Last backup: ${fmtUtc(backupInfo.at)}` : 'No backup yet.'}
          </span>
        </div>
        <div className="inline-note" style={{ marginTop: 10 }}>
          Restore replaces all current data with the backup. Changes made after the backup will be lost.
        </div>
      </div>
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <label>{label}</label>
      <div style={{ fontWeight: 600 }}>{value}</div>
    </div>
  );
}
