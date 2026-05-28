import { useState } from 'react';
import { useApp } from '../store/AppContext';
import { seedDB, emptyDB } from '../data/seed';
import { ALL_GRADES, sulphurCategory, SULPHUR_LABELS } from '../data/fuels';
import { PORTS } from '../data/ports';
import type { FuelOnboard, OnboardDB, Voyage } from '../domain/types';
import { uid, num } from '../lib/util';
import { NumberField, SelectField, TextField } from '../components/common/Fields';

// s-Insight §2.3 — Initialization wizard: state current fuels, consumables,
// cargo, officer names and vessel position before the first voyage leg.
export function InitWizard() {
  const { db, activation, finishInit, notify } = useApp();
  const config = db?.config ?? activation!.config;
  const [step, setStep] = useState(0);

  // working values
  const [master, setMaster] = useState('');
  const [chief, setChief] = useState('');
  const [signOn, setSignOn] = useState(new Date().toISOString().slice(0, 10));
  const [lat, setLat] = useState('');
  const [lon, setLon] = useState('');

  const [fuels, setFuels] = useState<FuelOnboard[]>([]);
  const [fGrade, setFGrade] = useState('');
  const [fSulphur, setFSulphur] = useState('');
  const [fRob, setFRob] = useState('');
  const [fBdn, setFBdn] = useState('');

  const [voyageNo, setVoyageNo] = useState('');
  const [service, setService] = useState('');
  const [depPort, setDepPort] = useState('');
  const [arrPort, setArrPort] = useState('');

  const portOpts = PORTS.map((p) => ({ value: p.code, label: `${p.code} — ${p.name}` }));

  function addFuel() {
    const grade = ALL_GRADES.find((g) => g.id === fGrade);
    const sulphur = num(fSulphur);
    const rob = num(fRob);
    if (!grade || sulphur === undefined || rob === undefined) {
      notify('err', 'Select a grade and enter sulphur % and ROB.');
      return;
    }
    setFuels((cur) => [
      ...cur,
      {
        id: uid('fuel'),
        gradeId: grade.id,
        label: `${grade.type} (${sulphurCategory(sulphur)})`,
        sulphurPct: sulphur,
        sulphurCategory: sulphurCategory(sulphur),
        rob,
        bdn: fBdn || undefined,
        lhv: grade.defaultLhv,
      },
    ]);
    setFGrade(''); setFSulphur(''); setFRob(''); setFBdn('');
  }

  function loadDemo() {
    finishInit(seedDB(config));
    notify('ok', 'Loaded demo voyage data. Explore the recorder.');
  }

  function finish() {
    const next: OnboardDB = emptyDB(config);
    next.fuels = fuels;
    if (master) next.officers.push({ id: uid('off'), role: 'Master', name: master, signOn, inCharge: true });
    if (chief) next.officers.push({ id: uid('off'), role: 'Chief Engineer', name: chief, signOn, inCharge: true });
    const voyage: Voyage = {
      id: uid('voy'),
      voyageNo: voyageNo || 'INIT-001',
      service: service || 'Initial',
      type: 'One way',
      departurePort: depPort,
      arrivalPort: arrPort,
      stages: depPort && arrPort ? [{ id: uid('stg'), kind: 'LADEN', fromPort: depPort, toPort: arrPort }] : [],
      speedOrders: [],
      sent: false,
    };
    next.voyages = [voyage];
    next.settings.rememberPassword = db?.settings.rememberPassword ?? false;
    finishInit(next);
    notify('ok', 'Initialization complete.');
  }

  const steps = ['Welcome', 'Officers & position', 'Fuels onboard', 'First voyage'];

  return (
    <div className="auth-wrap" style={{ alignItems: 'flex-start', paddingTop: 40 }}>
      <div className="auth-card" style={{ maxWidth: 640 }}>
        <div className="logo">⚓ Initialization</div>
        <div className="sub">
          {config.vesselName} · IMO {config.imo} · {config.shipType}
        </div>

        <div className="auth-steps">
          {steps.map((_, i) => (
            <div key={i} className={`step ${i <= step ? 'done' : ''}`} />
          ))}
        </div>
        <div className="section-title">{`Step ${step + 1} of ${steps.length} — ${steps[step]}`}</div>

        {step === 0 && (
          <div className="stack">
            <p>
              This wizard ensures complete and consistent reporting on the first voyage leg. You can
              state current fuels, officers and position now, or jump straight in with demo data.
            </p>
            <button className="btn-accent btn-block" onClick={loadDemo}>
              🚀 Start with demo voyage data (recommended for first look)
            </button>
            <div className="divider" />
            <button className="btn-primary btn-block" onClick={() => setStep(1)}>
              Set up manually
            </button>
          </div>
        )}

        {step === 1 && (
          <div>
            <div className="grid grid-2">
              <TextField label="Master" value={master} onChange={setMaster} placeholder="Capt. name" />
              <TextField label="Chief Engineer" value={chief} onChange={setChief} placeholder="C/E name" />
            </div>
            <TextField label="Sign-on date" type="date" value={signOn} onChange={setSignOn} />
            <div className="grid grid-2">
              <NumberField label="Latitude" unit="° +N/−S" value={lat as unknown as number} onChange={setLat} />
              <NumberField label="Longitude" unit="° +E/−W" value={lon as unknown as number} onChange={setLon} />
            </div>
          </div>
        )}

        {step === 2 && (
          <div>
            <p className="text-muted">Add the fuels currently in your tanks (type, sulphur, ROB).</p>
            {fuels.length > 0 && (
              <div className="table-wrap" style={{ marginBottom: 12 }}>
                <table>
                  <thead>
                    <tr><th>Fuel</th><th>Sulphur</th><th>ROB (mt)</th><th></th></tr>
                  </thead>
                  <tbody>
                    {fuels.map((f) => (
                      <tr key={f.id}>
                        <td>{f.label}</td>
                        <td>{f.sulphurPct}% <span className="badge badge-muted">{f.sulphurCategory}</span></td>
                        <td>{f.rob}</td>
                        <td>
                          <button className="btn-ghost btn-sm" onClick={() => setFuels((c) => c.filter((x) => x.id !== f.id))}>
                            Remove
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <div className="grid grid-2">
              <SelectField
                label="Fuel grade"
                value={fGrade}
                onChange={setFGrade}
                options={ALL_GRADES.map((g) => ({ value: g.id, label: `${g.category} — ${g.type}` }))}
              />
              <NumberField label="Sulphur" unit="%" value={fSulphur as unknown as number} onChange={setFSulphur} />
              <NumberField label="ROB" unit="mt" value={fRob as unknown as number} onChange={setFRob} />
              <TextField label="BDN no. (optional)" value={fBdn} onChange={setFBdn} />
            </div>
            {fSulphur !== '' && num(fSulphur) !== undefined && (
              <div className="hint">Category: {SULPHUR_LABELS[sulphurCategory(num(fSulphur)!)]}</div>
            )}
            <button className="btn-block" style={{ marginTop: 10 }} onClick={addFuel}>
              + Add fuel
            </button>
          </div>
        )}

        {step === 3 && (
          <div>
            <div className="grid grid-2">
              <TextField label="Voyage no." value={voyageNo} onChange={setVoyageNo} placeholder="2026-001" />
              <TextField label="Service / Trade" value={service} onChange={setService} />
              <SelectField label="Departure port" value={depPort} onChange={setDepPort} options={portOpts} />
              <SelectField label="Arrival port" value={arrPort} onChange={setArrPort} options={portOpts} />
            </div>
            <div className="hint">You can refine voyage details later from the Voyages page.</div>
          </div>
        )}

        {step > 0 && (
          <div className="btn-row" style={{ marginTop: 18 }}>
            <button className="btn-ghost" onClick={() => setStep((s) => Math.max(0, s - 1))}>← Back</button>
            <div className="spacer" />
            {step < 3 ? (
              <button className="btn-primary" onClick={() => setStep((s) => s + 1)}>Next →</button>
            ) : (
              <button className="btn-primary" onClick={finish}>Finish initialization</button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
