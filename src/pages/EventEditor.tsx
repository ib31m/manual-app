import { useMemo, useState } from 'react';
import { useApp } from '../store/AppContext';
import { eventTypeById } from '../data/eventTypes';
import { ALL_GRADES, sulphurCategory, SULPHUR_LABELS } from '../data/fuels';
import { PORTS } from '../data/ports';
import { validateEvent, summarize, robAfterEvent, type CheckResult } from '../domain/validation';
import { baselineWithout, commitEvent, removeEvent } from '../domain/fuelLedger';
import type { ConsumptionLine, VesselEvent } from '../domain/types';
import { uid, num } from '../lib/util';
import { Confirm } from '../components/common/Modal';
import { NumberField, SelectField, TextField, TextArea, CheckboxField } from '../components/common/Fields';

const OFFSETS = Array.from({ length: 27 }, (_, i) => i - 12); // UTC-12 .. UTC+14
const portOpts = PORTS.map((p) => ({ value: p.code, label: `${p.code} — ${p.name}` }));

function toUtcIso(local: string, offsetHours: number): string {
  if (!local) return '';
  const [datePart, timePart] = local.split('T');
  const [y, mo, d] = datePart.split('-').map(Number);
  const [h, mi] = (timePart || '00:00').split(':').map(Number);
  const utcMs = Date.UTC(y, mo - 1, d, h, mi) - offsetHours * 3600 * 1000;
  return new Date(utcMs).toISOString();
}
function fromUtcIso(iso: string, offsetHours: number): string {
  const t = new Date(new Date(iso).getTime() + offsetHours * 3600 * 1000);
  return t.toISOString().slice(0, 16);
}

interface Props {
  mode: 'new' | 'edit';
  typeId: string;
  eventId?: string;
  onClose: () => void;
}

export function EventEditor({ mode, typeId, eventId, onClose }: Props) {
  const { db, update, notify } = useApp();
  const def = eventTypeById(typeId)!;

  const existing = eventId ? db!.events.find((e) => e.id === eventId) : undefined;
  const readOnly = existing?.status === 'sent';

  // Time entry state.
  const [zoneMode, setZoneMode] = useState<'LT' | 'UTC'>(
    existing?.timeZoneLabel?.startsWith('UTC') ? 'UTC' : 'LT',
  );
  const [offset, setOffset] = useState<number>(() => {
    const m = existing?.timeZoneLabel?.match(/UTC([+-]\d+)/);
    return m ? Number(m[1]) : 0;
  });
  const [localTime, setLocalTime] = useState<string>(() =>
    existing ? fromUtcIso(existing.timeUtc, existing.timeZoneLabel?.startsWith('UTC') ? 0 : offset) : fromUtcIso(new Date().toISOString(), 0),
  );

  const [voyageId, setVoyageId] = useState(existing?.voyageId ?? db!.voyages[db!.voyages.length - 1]?.id ?? '');
  const [recipients, setRecipients] = useState(existing?.recipients ?? '');
  const [position, setPosition] = useState(existing?.position ?? {});
  const [sog, setSog] = useState<string>(existing?.sogKn?.toString() ?? '');
  const [stw, setStw] = useState<string>(existing?.stwKn?.toString() ?? '');
  const [weather, setWeather] = useState(existing?.weather ?? {});
  const [consumptionsSkipped, setConsumptionsSkipped] = useState(existing?.consumptionsSkipped ?? false);
  const [consumptions, setConsumptions] = useState<ConsumptionLine[]>(existing?.consumptions ?? []);
  const [fields, setFields] = useState<Record<string, string | number | boolean>>(existing?.fields ?? {});
  const [confirmDelete, setConfirmDelete] = useState(false);

  const tzLabel = zoneMode === 'UTC' ? 'UTC' : `LT (UTC${offset >= 0 ? '+' : ''}${offset})`;
  const timeUtc = toUtcIso(localTime, zoneMode === 'UTC' ? 0 : offset);

  const draft: VesselEvent = useMemo(
    () => ({
      id: existing?.id ?? uid('ev'),
      typeId,
      voyageId,
      timeUtc,
      timeZoneLabel: tzLabel,
      position: def.hasPosition ? position : undefined,
      sogKn: num(sog),
      stwKn: num(stw),
      weather: def.hasWeather ? weather : undefined,
      consumptionsSkipped: def.hasConsumptions ? consumptionsSkipped : undefined,
      consumptions: def.hasConsumptions ? consumptions : [],
      fields,
      recipients,
      status: existing?.status ?? 'ready',
      createdAt: existing?.createdAt ?? new Date().toISOString(),
      sentAt: existing?.sentAt,
      reportId: existing?.reportId,
    }),
    [existing, typeId, voyageId, timeUtc, tzLabel, def, position, sog, stw, weather, consumptionsSkipped, consumptions, fields, recipients],
  );

  // Validate against the baseline that excludes this event's own saved effect.
  const baseDB = useMemo(() => (existing ? baselineWithout(db!, existing.id) : db!), [db, existing]);
  const results = useMemo(() => validateEvent(baseDB, draft), [baseDB, draft]);
  const sum = summarize(results);
  const rob = useMemo(() => robAfterEvent(baseDB, draft), [baseDB, draft]);

  const setField = (k: string, v: string | number | boolean) => setFields((f) => ({ ...f, [k]: v }));

  function addCons() {
    setConsumptions((c) => [...c, { id: uid('c'), fuelId: db!.fuels[0]?.id ?? '', consumer: 'ME', amount: 0 }]);
  }
  function setCons(id: string, patch: Partial<ConsumptionLine>) {
    setConsumptions((c) => c.map((x) => (x.id === id ? { ...x, ...patch } : x)));
  }

  function save(asDraft: boolean) {
    const toSave: VesselEvent = { ...draft, status: asDraft ? 'draft' : 'ready' };
    if (!asDraft && sum.errors > 0) {
      notify('err', 'Cannot save as ready: please resolve the red errors first.');
      return;
    }
    update((d) => commitEvent(d, toSave));
    notify('ok', asDraft ? 'Event saved as draft.' : 'Event saved.');
    onClose();
  }

  function doDelete() {
    if (!existing) return;
    update((d) => removeEvent(d, existing.id));
    notify('info', 'Event deleted.');
    onClose();
  }

  const speedOrders = db!.voyages.find((v) => v.id === voyageId)?.speedOrders ?? [];

  return (
    <div className="modal-backdrop" style={{ alignItems: 'stretch', padding: 0 }}>
      <div style={{ background: 'var(--bg)', width: '100%', overflow: 'auto' }}>
        {/* Header bar */}
        <div className="topbar" style={{ position: 'sticky', top: 0 }}>
          <button className="btn-ghost" onClick={onClose}>✕ Close</button>
          <span className="title">{mode === 'new' ? 'New event' : readOnly ? 'View event' : 'Edit event'}: {def.name}</span>
          <div className="spacer" />
          {!readOnly && (
            <div className="btn-row">
              <button
                onClick={() =>
                  notify(
                    sum.errors ? 'err' : 'ok',
                    sum.errors
                      ? `${sum.errors} error(s) must be fixed.`
                      : sum.warnings
                        ? `No errors. ${sum.warnings} warning(s) to review.`
                        : 'Check passed — no issues.',
                  )
                }
              >
                Check
              </button>
              {existing?.status !== 'sent' && mode === 'edit' && (
                <button className="btn-danger" onClick={() => setConfirmDelete(true)}>Delete</button>
              )}
              <button onClick={() => save(true)} disabled={existing?.status === 'sent'}>Save as draft</button>
              <button className="btn-primary" onClick={() => save(false)}>Save</button>
            </div>
          )}
        </div>

        <div className="content" style={{ maxWidth: 1180 }}>
          {readOnly && (
            <div className="banner">
              <span>🔒</span> This event was already sent ({existing?.reportId}) and is read-only.
            </div>
          )}
          <div className="inline-note" style={{ marginBottom: 16 }}>{def.description}</div>

          <div className="layout-split">
            <div>
              {/* --- Header fields --- */}
              <div className="card">
                <h3>Event header</h3>
                <div className="grid grid-2">
                  <div className="field">
                    <label>Event time ({zoneMode})</label>
                    <input
                      type="datetime-local"
                      value={localTime}
                      disabled={readOnly}
                      onChange={(e) => setLocalTime(e.target.value)}
                    />
                    <div className="hint">Stored as {timeUtc ? new Date(timeUtc).toISOString().slice(0, 16) + ' UTC' : '—'}</div>
                  </div>
                  <div className="field">
                    <label>Time zone</label>
                    <div className="row">
                      <div className="pill-group">
                        <button type="button" className={`pill${zoneMode === 'LT' ? ' active' : ''}`} disabled={readOnly} onClick={() => setZoneMode('LT')}>LT</button>
                        <button type="button" className={`pill${zoneMode === 'UTC' ? ' active' : ''}`} disabled={readOnly} onClick={() => setZoneMode('UTC')}>UTC</button>
                      </div>
                      {zoneMode === 'LT' && (
                        <select value={offset} disabled={readOnly} onChange={(e) => setOffset(Number(e.target.value))} style={{ maxWidth: 130 }}>
                          {OFFSETS.map((o) => (
                            <option key={o} value={o}>UTC{o >= 0 ? '+' : ''}{o}</option>
                          ))}
                        </select>
                      )}
                    </div>
                  </div>
                </div>
                <SelectField
                  label="Voyage"
                  required
                  value={voyageId}
                  onChange={setVoyageId}
                  options={db!.voyages.map((v) => ({ value: v.id, label: `${v.voyageNo} — ${v.departurePort}→${v.arrivalPort}` }))}
                />
                <TextField label="Additional recipients (optional)" value={recipients} onChange={setRecipients} placeholder="email@example.com; …" hint="Standard recipients are set on the Server." />
                {speedOrders.length > 0 && def.id.startsWith('noon') && (
                  <SelectField
                    label="Speed order advised since last event"
                    value={String(fields['speed_order'] ?? '')}
                    onChange={(v) => setField('speed_order', v)}
                    options={speedOrders.map((s) => ({ value: s.id, label: `${s.name} (min ${s.minSpeedKn} kn, ≤ ${s.maxConsumptionMtPerDay} mt/d)` }))}
                  />
                )}
              </div>

              <EventSpecificFields typeId={typeId} fields={fields} setField={setField} readOnly={readOnly} db={db!} />

              {/* --- Position --- */}
              {def.hasPosition && (
                <div className="card">
                  <h3>Sailing conditions</h3>
                  <div className="grid grid-2">
                    <NumberField label="Latitude" unit="° +N/−S" value={position.lat} onChange={(v) => setPosition((p) => ({ ...p, lat: num(v) }))} />
                    <NumberField label="Longitude" unit="° +E/−W" value={position.lon} onChange={(v) => setPosition((p) => ({ ...p, lon: num(v) }))} />
                    <NumberField label="Speed over ground" unit="kn" value={sog as unknown as number} onChange={setSog} />
                    <NumberField label="Speed through water" unit="kn" value={stw as unknown as number} onChange={setStw} />
                  </div>
                  {def.id === 'performance_snapshot' && (
                    <div className="grid grid-2">
                      <NumberField label="Draught fwd" unit="m" value={fields['draught_fwd'] as number} onChange={(v) => setField('draught_fwd', num(v) ?? '')} />
                      <NumberField label="Draught aft" unit="m" value={fields['draught_aft'] as number} onChange={(v) => setField('draught_aft', num(v) ?? '')} />
                    </div>
                  )}
                </div>
              )}

              {/* --- Weather --- */}
              {def.hasWeather && (
                <div className="card">
                  <h3>Weather</h3>
                  <div className="hint" style={{ marginBottom: 10 }}>
                    {def.id === 'performance_snapshot'
                      ? 'Enter the CURRENT weather at the event time (performance snapshot exception).'
                      : 'Report the prevailing weather since the last event.'}
                  </div>
                  <div className="grid grid-3">
                    <NumberField label="Wind force" unit="Bft 0–12" value={weather.windForceBft} onChange={(v) => setWeather((w) => ({ ...w, windForceBft: num(v) }))} />
                    <TextField label="Wind dir" value={weather.windDir ?? ''} onChange={(v) => setWeather((w) => ({ ...w, windDir: v }))} placeholder="e.g. NW" />
                    <NumberField label="Sea state" unit="Douglas 0–9" value={weather.seaState} onChange={(v) => setWeather((w) => ({ ...w, seaState: num(v) }))} />
                    <NumberField label="Air temp" unit="°C" value={weather.airTempC} onChange={(v) => setWeather((w) => ({ ...w, airTempC: num(v) }))} />
                    <NumberField label="Sea temp" unit="°C" value={weather.seaTempC} onChange={(v) => setWeather((w) => ({ ...w, seaTempC: num(v) }))} />
                  </div>
                </div>
              )}

              {/* --- Consumptions / Check ROB --- */}
              {def.hasConsumptions && (
                <div className="card">
                  <div className="card-head">
                    <h3>Consumptions</h3>
                    {!readOnly && <button className="btn-sm" onClick={addCons} disabled={consumptionsSkipped || db!.fuels.length === 0}>+ Add consumption</button>}
                  </div>
                  <CheckboxField
                    label="Consumptions are intentionally not reported in this event"
                    checked={consumptionsSkipped}
                    onChange={setConsumptionsSkipped}
                    hint="Following events will skip this event when calculating durations (use for closely-spaced events)."
                  />
                  {!consumptionsSkipped && (
                    <>
                      {db!.fuels.length === 0 && <div className="empty">No fuels onboard. Add a Bunkering event first.</div>}
                      {consumptions.map((c) => (
                        <div className="grid grid-3" key={c.id} style={{ alignItems: 'end' }}>
                          <SelectField label="Fuel" value={c.fuelId} onChange={(v) => setCons(c.id, { fuelId: v })} options={db!.fuels.map((f) => ({ value: f.id, label: `${f.label} — ROB ${f.rob.toFixed(1)} mt` }))} />
                          <SelectField label="Consumer" value={c.consumer} onChange={(v) => setCons(c.id, { consumer: v as ConsumptionLine['consumer'] })} options={[{ value: 'ME', label: 'Main engine' }, { value: 'AE', label: 'Aux engine' }, { value: 'Boiler', label: 'Boiler' }, { value: 'Other', label: 'Other' }]} />
                          <div className="row" style={{ alignItems: 'end', gap: 6 }}>
                            <NumberField label="Amount" unit="mt" value={c.amount} onChange={(v) => setCons(c.id, { amount: num(v) ?? 0 })} />
                            {!readOnly && <button className="btn-ghost btn-sm" style={{ marginBottom: 14 }} onClick={() => setConsumptions((arr) => arr.filter((x) => x.id !== c.id))}>✕</button>}
                          </div>
                        </div>
                      ))}
                      {/* Check ROB */}
                      <div className="divider" />
                      <h4 style={{ color: 'var(--muted)' }}>Check ROB</h4>
                      <table>
                        <thead><tr><th>Fuel</th><th style={{ textAlign: 'right' }}>Before</th><th style={{ textAlign: 'right' }}>After</th></tr></thead>
                        <tbody>
                          {rob.map((r) => (
                            <tr key={r.fuelId}>
                              <td>{r.label}</td>
                              <td style={{ textAlign: 'right' }}>{r.before.toFixed(2)}</td>
                              <td style={{ textAlign: 'right', color: r.after < 0 ? 'var(--err)' : undefined, fontWeight: 600 }}>{r.after.toFixed(2)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                      <NumberField label="Fuel sludge produced (optional)" unit="mt" value={fields['fuel_sludge'] as number} onChange={(v) => setField('fuel_sludge', num(v) ?? '')} hint="Should not exceed 2% of related consumption (deducted from ROB)." />
                    </>
                  )}
                </div>
              )}
            </div>

            {/* --- Check results panel --- */}
            <div className="checks">
              <div className="card">
                <div className="card-head">
                  <h3>Check results</h3>
                  <div className="row" style={{ gap: 6 }}>
                    {sum.errors > 0 && <span className="badge badge-err">{sum.errors}</span>}
                    {sum.warnings > 0 && <span className="badge badge-warn">{sum.warnings}</span>}
                    {sum.infos > 0 && <span className="badge badge-info">{sum.infos}</span>}
                    {sum.errors === 0 && sum.warnings === 0 && <span className="badge badge-ok">Clear</span>}
                  </div>
                </div>
                <p className="text-muted" style={{ fontSize: '.8rem' }}>
                  <span className="text-err">Red</span> = error (blocks sending) ·{' '}
                  <span style={{ color: 'var(--warn)' }}>Blue</span> = review ·{' '}
                  <span style={{ color: 'var(--info)' }}>Green</span> = info
                </p>
                {results.length === 0 ? (
                  <div className="badge badge-ok">No issues found.</div>
                ) : (
                  results.map((r, i) => <CheckCard key={i} r={r} />)
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {confirmDelete && (
        <Confirm
          title="Delete event"
          danger
          confirmLabel="Delete event"
          requireText={db!.settings.allowEventDeletion ? 'DELETE' : undefined}
          message={
            existing?.status === 'sent' && !db!.settings.allowEventDeletion ? (
              <p className="text-err">This event was sent. Enable “Allow event deletion” in Settings first.</p>
            ) : (
              <p>Delete this event? Its effect on fuel ROB will be reversed. This cannot be undone.</p>
            )
          }
          onCancel={() => setConfirmDelete(false)}
          onConfirm={() => {
            if (existing?.status === 'sent' && !db!.settings.allowEventDeletion) {
              setConfirmDelete(false);
              return;
            }
            doDelete();
          }}
        />
      )}
    </div>
  );
}

function CheckCard({ r }: { r: CheckResult }) {
  return (
    <div className={`check-item ${r.severity}`}>
      <div className="field-name">{r.field}</div>
      <div style={{ fontSize: '.86rem' }}>{r.message}</div>
    </div>
  );
}

// Event-type-specific input sections.
function EventSpecificFields({
  typeId,
  fields,
  setField,
  readOnly,
  db,
}: {
  typeId: string;
  fields: Record<string, string | number | boolean>;
  setField: (k: string, v: string | number | boolean) => void;
  readOnly?: boolean;
  db: import('../domain/types').OnboardDB;
}) {
  const get = (k: string) => String(fields[k] ?? '');

  if (['arrival', 'departure', 'begin_shifting', 'end_shifting', 'sailing_notice'].includes(typeId)) {
    return (
      <div className="card">
        <h3>Port</h3>
        <SelectField label="Port" required value={get('port')} onChange={(v) => setField('port', v)} options={portOpts} />
        {typeId === 'arrival' && (
          <div className="grid grid-2">
            <TextField label="Pilots" value={get('pilots')} onChange={(v) => setField('pilots', v)} />
            <TextField label="Tugs / thrusters" value={get('tugs')} onChange={(v) => setField('tugs', v)} />
          </div>
        )}
        {(typeId === 'departure' || typeId === 'begin_shifting') && (
          <>
            <CheckboxField label="No change of cargo (port called for other reasons)" checked={fields['no_cargo_change'] === true} onChange={(v) => setField('no_cargo_change', v)} />
            {fields['no_cargo_change'] === true && (
              <TextField label="Reason for port call" value={get('port_call_reason')} onChange={(v) => setField('port_call_reason', v)} placeholder="bunkering / crew change / waste disposal" />
            )}
          </>
        )}
        {typeId === 'sailing_notice' && (
          <SelectField label="Next destination port" value={get('next_port')} onChange={(v) => setField('next_port', v)} options={portOpts} />
        )}
      </div>
    );
  }

  if (typeId === 'bunkering') {
    return (
      <div className="card">
        <h3>Bunkering — new fuel parcel</h3>
        <div className="inline-note" style={{ marginBottom: 12 }}>
          Bunkering in tanks considered as empty. A fuel can only be consumed in later events once
          its type, sulphur and mass are provided.
        </div>
        <div className="grid grid-2">
          <SelectField label="Fuel grade" value={get('new_fuel_grade')} onChange={(v) => setField('new_fuel_grade', v)} options={ALL_GRADES.map((g) => ({ value: g.id, label: `${g.fuelClass} · ${g.category} — ${g.type}` }))} />
          <NumberField label="Sulphur" unit="%" value={fields['new_fuel_sulphur'] as number} onChange={(v) => setField('new_fuel_sulphur', num(v) ?? '')} />
          <NumberField label="Delivered quantity" unit="mt" value={fields['new_fuel_amount'] as number} onChange={(v) => setField('new_fuel_amount', num(v) ?? '')} />
          <TextField label="BDN / BDR no." value={get('new_fuel_bdn')} onChange={(v) => setField('new_fuel_bdn', v)} />
        </div>
        {fields['new_fuel_sulphur'] !== undefined && fields['new_fuel_sulphur'] !== '' && (
          <div className="hint">Category: {SULPHUR_LABELS[sulphurCategory(Number(fields['new_fuel_sulphur']))]}</div>
        )}
        {db.fuels.length > 0 && (
          <>
            <div className="divider" />
            <h4 style={{ color: 'var(--muted)' }}>…or top up existing fuels</h4>
            {db.fuels.map((f) => (
              <NumberField key={f.id} label={`${f.label} (+mt)`} unit="mt" value={fields[`bunker_${f.id}`] as number} onChange={(v) => setField(`bunker_${f.id}`, num(v) ?? '')} />
            ))}
          </>
        )}
      </div>
    );
  }

  if (typeId === 'sounding_correction') {
    return (
      <div className="card">
        <h3>Sounding correction</h3>
        <CheckboxField label="No difference (confirm current ROB values)" checked={fields['no_difference'] === true} onChange={(v) => setField('no_difference', v)} />
        {fields['no_difference'] !== true &&
          db.fuels.map((f) => (
            <NumberField key={f.id} label={`${f.label} correction (± mt)`} unit="± mt" value={fields[`correct_${f.id}`] as number} onChange={(v) => setField(`correct_${f.id}`, num(v) ?? '')} hint={`Current ROB ${f.rob.toFixed(2)} mt`} />
          ))}
      </div>
    );
  }

  if (typeId === 'begin_deviation' || typeId === 'change_destination') {
    return (
      <div className="card">
        <h3>Deviation</h3>
        <SelectField label="Reason for deviation" required value={get('deviation_reason')} onChange={(v) => setField('deviation_reason', v)} options={['Rescuing', 'Emergency', 'Weather', 'Technical damage'].map((r) => ({ value: r, label: r }))} />
        {typeId === 'change_destination' && (
          <SelectField label="New destination port" required value={get('new_destination')} onChange={(v) => setField('new_destination', v)} options={portOpts} />
        )}
      </div>
    );
  }

  if (typeId === 'begin_offhire' || typeId === 'end_offhire') {
    return (
      <div className="card">
        <h3>Off-hire</h3>
        {typeId === 'begin_offhire' && (
          <>
            <SelectField label="Reason" required value={get('offhire_reason')} onChange={(v) => setField('offhire_reason', v)} options={['Breakdown ME', 'Breakdown AE', 'Overhaul ME', 'Overhaul AE', 'Dry docking', 'PSC detention', 'Other'].map((r) => ({ value: r, label: r }))} />
            <div className="grid grid-2">
              <NumberField label="Off-hire percentage" unit="%" value={fields['offhire_percent'] as number} onChange={(v) => setField('offhire_percent', num(v) ?? '')} />
              <SelectField label="Mode" required value={get('offhire_mode')} onChange={(v) => setField('offhire_mode', v)} options={[{ value: 'scheduled', label: 'Scheduled' }, { value: 'unscheduled', label: 'Unscheduled' }]} />
            </div>
          </>
        )}
        {typeId === 'end_offhire' && <p className="text-muted">Records the end of the current off-hire period.</p>}
      </div>
    );
  }

  if (typeId === 'enter_special_area' || typeId === 'leave_special_area') {
    return (
      <div className="card">
        <h3>Special area</h3>
        <SelectField label="Area" required value={get('special_area')} onChange={(v) => setField('special_area', v)} options={['ECA (SOx)', 'ECA (NOx)', 'Piracy area', 'CII Ice conditions', 'MARPOL Special Area'].map((r) => ({ value: r, label: r }))} />
      </div>
    );
  }

  if (['disposal_incineration', 'disposal_ashore', 'disposal_overboard', 'disposal_barge'].includes(typeId)) {
    const method = { disposal_incineration: 'Incineration', disposal_ashore: 'Ashore', disposal_overboard: 'Over board', disposal_barge: 'By barge' }[typeId]!;
    return (
      <div className="card">
        <h3>Garbage disposal — {method}</h3>
        <div className="inline-note" style={{ marginBottom: 12 }}>Feeds the Garbage Record Book (MARPOL Annex V).</div>
        <SelectField label="Part" value={get('garbage_part') || 'I'} onChange={(v) => setField('garbage_part', v)} options={[{ value: 'I', label: 'Part I — all garbage' }, { value: 'II', label: 'Part II — cargo residues' }]} />
        <SelectField label="Garbage category" value={get('garbage_category')} onChange={(v) => setField('garbage_category', v)} options={['A Plastics', 'B Food wastes', 'C Domestic wastes', 'D Cooking oil', 'E Incinerator ashes', 'F Operational wastes', 'G Cargo residues', 'I E-waste'].map((r) => ({ value: r, label: r }))} />
        <NumberField label="Estimated amount" unit="m³" value={fields['garbage_amount'] as number} onChange={(v) => setField('garbage_amount', num(v) ?? '')} />
      </div>
    );
  }

  if (typeId === 'eta_update') {
    return (
      <div className="card">
        <h3>ETA / RTA</h3>
        <div className="grid grid-2">
          <SelectField label="Port" value={get('eta_port')} onChange={(v) => setField('eta_port', v)} options={portOpts} />
          <TextField label="New ETA" type="datetime-local" value={get('eta_time')} onChange={(v) => setField('eta_time', v)} />
        </div>
      </div>
    );
  }

  if (typeId === 'maintenance') {
    return (
      <div className="card">
        <h3>Maintenance</h3>
        <TextField label="Activity" value={get('maintenance_activity')} onChange={(v) => setField('maintenance_activity', v)} placeholder="hull cleaning / propeller polishing" />
        <TextArea label="Remarks" value={get('maintenance_remarks')} onChange={(v) => setField('maintenance_remarks', v)} />
      </div>
    );
  }

  if (typeId === 'oil_spill' || typeId === 'voc_release' || typeId === 'inventory' || typeId === 'cargo_condition' || typeId === 'fuel_lab_analysis') {
    return (
      <div className="card">
        <h3>{eventTypeById(typeId)?.name}</h3>
        <TextArea label="Details / remarks" value={get('remarks')} onChange={(v) => setField('remarks', v)} />
      </div>
    );
  }

  void readOnly;
  return null;
}
