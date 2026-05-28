import { useState } from 'react';
import { useApp } from '../../store/AppContext';
import { activateWithToken } from '../../server/mockServer';
import { checkPassword } from '../../domain/auth';
import type { VesselConfig } from '../../domain/types';

// Performance Lite §2.1 — Activate the Ship Environment:
//   browse URL -> insert token -> set a password -> remember -> login.
export function Activation() {
  const { activate, notify } = useApp();
  const [step, setStep] = useState<1 | 2>(1);
  const [token, setToken] = useState('');
  const [config, setConfig] = useState<VesselConfig | null>(null);
  const [tokenErr, setTokenErr] = useState('');

  const [pw, setPw] = useState('');
  const [pw2, setPw2] = useState('');
  const [remember, setRemember] = useState(true);
  const pwCheck = checkPassword(pw);
  const pwMatch = pw.length > 0 && pw === pw2;

  function submitToken(e: React.FormEvent) {
    e.preventDefault();
    const res = activateWithToken(token);
    if (!res.ok || !res.config) {
      setTokenErr(res.error || 'Activation failed.');
      return;
    }
    setTokenErr('');
    setConfig(res.config);
    setStep(2);
  }

  function submitPassword(e: React.FormEvent) {
    e.preventDefault();
    if (!config) return;
    if (!pwCheck.ok || !pwMatch) return;
    activate(token.trim().toUpperCase(), config, pw, remember);
    notify('info', 'Password set. You can now use the recorder offline.');
  }

  return (
    <div className="auth-wrap">
      <div className="auth-card">
        <div className="logo">⚓ s-Log Recorder</div>
        <div className="sub">Onboard voyage &amp; emissions reporting — vessel activation</div>

        <div className="auth-steps">
          <div className={`step ${step >= 1 ? 'done' : ''}`} />
          <div className={`step ${step >= 2 ? 'done' : ''}`} />
        </div>

        {step === 1 && (
          <form onSubmit={submitToken}>
            <p className="text-muted">
              Your vessel was provisioned with a one-time <strong>activation token</strong>.
              First activation requires connectivity.
            </p>
            <div className={`field${tokenErr ? ' error' : ''}`}>
              <label>Activation token</label>
              <input
                value={token}
                onChange={(e) => setToken(e.target.value)}
                placeholder="e.g. OCEANLY-DEMO-2026"
                autoFocus
              />
              {tokenErr && <div className="hint text-err">{tokenErr}</div>}
            </div>
            <button className="btn-primary btn-block" type="submit">
              Activate vessel
            </button>
            <div className="inline-note" style={{ marginTop: 16 }}>
              <strong>Demo tokens:</strong> <span className="mono">OCEANLY-DEMO-2026</span> (bulk
              carrier) or <span className="mono">STORMGEO-TANKER-01</span> (tanker).
            </div>
          </form>
        )}

        {step === 2 && config && (
          <form onSubmit={submitPassword}>
            <div className="banner" style={{ background: '#e8f7ee', borderColor: '#bfe6cd' }}>
              <span>✅</span>
              <div>
                <strong>{config.vesselName}</strong> · IMO {config.imo} · {config.shipType}
              </div>
            </div>
            <p className="text-muted">Set a password for this installation.</p>

            <div className="field">
              <label>New password</label>
              <input type="password" value={pw} onChange={(e) => setPw(e.target.value)} autoFocus />
              <ul className="pw-rules">
                {pwCheck.rules.map((r) => (
                  <li key={r.label} className={r.met ? 'met' : ''}>
                    <span>{r.met ? '✓' : '○'}</span> {r.label}
                  </li>
                ))}
              </ul>
            </div>

            <div className={`field${pw2 && !pwMatch ? ' error' : ''}`}>
              <label>Confirm password</label>
              <input type="password" value={pw2} onChange={(e) => setPw2(e.target.value)} />
              {pw2 && !pwMatch && <div className="hint text-err">Passwords do not match.</div>}
            </div>

            <div className="checkbox" style={{ marginBottom: 16 }}>
              <input
                id="remember"
                type="checkbox"
                checked={remember}
                onChange={(e) => setRemember(e.target.checked)}
              />
              <label htmlFor="remember">Please remember the password (cleared after 30 days idle)</label>
            </div>

            <div className="btn-row">
              <button type="button" className="btn-ghost" onClick={() => setStep(1)}>
                ← Back
              </button>
              <div className="spacer" />
              <button className="btn-primary" type="submit" disabled={!pwCheck.ok || !pwMatch}>
                Set password &amp; continue
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
