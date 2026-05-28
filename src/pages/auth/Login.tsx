import { useState } from 'react';
import { useApp } from '../../store/AppContext';
import { issuePuk, verifyPuk } from '../../server/mockServer';
import { checkPassword } from '../../domain/auth';
import { Confirm } from '../../components/common/Modal';

type Mode = 'login' | 'forgot';

// Performance Lite §2.2–2.4 + s-Insight §2.2:
// login, remember password, Forgot Password -> PUK -> new password, reset installation.
export function Login() {
  const { activation, login, setNewPassword, resetInstallation, notify } = useApp();
  const [mode, setMode] = useState<Mode>('login');
  const [pw, setPw] = useState('');
  const [remember, setRemember] = useState(activation?.config ? true : false);
  const [err, setErr] = useState('');
  const [showReset, setShowReset] = useState(false);

  // Forgot-password (PUK) flow state.
  const [forgotStage, setForgotStage] = useState<'request' | 'enter'>('request');
  const [issuedPuk, setIssuedPuk] = useState('');
  const [pukInput, setPukInput] = useState('');
  const [newPw, setNewPw] = useState('');
  const [newPw2, setNewPw2] = useState('');
  const pwCheck = checkPassword(newPw);

  function doLogin(e: React.FormEvent) {
    e.preventDefault();
    if (login(pw, remember)) {
      setErr('');
    } else {
      setErr('Invalid password. Please try again or use "Forgot password?".');
    }
  }

  function requestPuk() {
    if (!activation) return;
    // In production a support e-mail is sent and the PUK arrives by mail.
    setIssuedPuk(issuePuk(activation.token));
    setForgotStage('enter');
  }

  function submitNewPw(e: React.FormEvent) {
    e.preventDefault();
    if (!activation) return;
    if (!verifyPuk(activation.token, pukInput)) {
      setErr('PUK is not correct.');
      return;
    }
    if (!pwCheck.ok || newPw !== newPw2) return;
    setNewPassword(newPw);
    notify('ok', 'Password updated. Please log in with your new password.');
    setMode('login');
    setForgotStage('request');
    setPw('');
    setErr('');
  }

  if (!activation) return null;

  return (
    <div className="auth-wrap">
      <div className="auth-card">
        <div className="logo">⚓ s-Log Recorder</div>
        <div className="banner" style={{ background: '#eef2f7', border: '1px solid #dbe3ec', marginTop: 14 }}>
          <span>🚢</span>
          <div>
            <strong>{activation.config.vesselName}</strong>
            <div className="text-muted" style={{ fontSize: '.82rem' }}>
              IMO {activation.config.imo} · {activation.config.shipType}
            </div>
          </div>
        </div>

        {mode === 'login' && (
          <form onSubmit={doLogin}>
            <div className={`field${err ? ' error' : ''}`}>
              <label>Password</label>
              <input type="password" value={pw} onChange={(e) => setPw(e.target.value)} autoFocus />
              {err && <div className="hint text-err">{err}</div>}
            </div>
            <div className="checkbox" style={{ marginBottom: 16 }}>
              <input
                id="rem"
                type="checkbox"
                checked={remember}
                onChange={(e) => setRemember(e.target.checked)}
              />
              <label htmlFor="rem">Remember password (auto-cleared after 30 days idle)</label>
            </div>
            <button className="btn-primary btn-block" type="submit">
              Log in
            </button>
            <div className="row spread" style={{ marginTop: 14 }}>
              <button type="button" className="btn-ghost btn-sm" onClick={() => { setMode('forgot'); setErr(''); }}>
                Forgot password?
              </button>
              <button type="button" className="btn-ghost btn-sm" onClick={() => setShowReset(true)}>
                Reset installation
              </button>
            </div>
          </form>
        )}

        {mode === 'forgot' && (
          <div>
            {forgotStage === 'request' ? (
              <>
                <h3>Reset your password</h3>
                <p className="text-muted">
                  Send an e-mail to your support contact. You will receive a <strong>PUK</strong> to
                  enter here, after which you can record a new password.
                </p>
                <button className="btn-primary btn-block" onClick={requestPuk}>
                  Request PUK from support
                </button>
              </>
            ) : (
              <form onSubmit={submitNewPw}>
                <div className="inline-note" style={{ marginBottom: 14 }}>
                  <strong>Simulated support e-mail:</strong> your PUK is{' '}
                  <span className="mono">{issuedPuk}</span>.
                </div>
                <div className={`field${err ? ' error' : ''}`}>
                  <label>PUK</label>
                  <input value={pukInput} onChange={(e) => setPukInput(e.target.value)} autoFocus />
                  {err && <div className="hint text-err">{err}</div>}
                </div>
                <div className="field">
                  <label>New password</label>
                  <input type="password" value={newPw} onChange={(e) => setNewPw(e.target.value)} />
                  <ul className="pw-rules">
                    {pwCheck.rules.map((r) => (
                      <li key={r.label} className={r.met ? 'met' : ''}>
                        <span>{r.met ? '✓' : '○'}</span> {r.label}
                      </li>
                    ))}
                  </ul>
                </div>
                <div className={`field${newPw2 && newPw !== newPw2 ? ' error' : ''}`}>
                  <label>Confirm new password</label>
                  <input type="password" value={newPw2} onChange={(e) => setNewPw2(e.target.value)} />
                  {newPw2 && newPw !== newPw2 && <div className="hint text-err">Passwords do not match.</div>}
                </div>
                <button
                  className="btn-primary btn-block"
                  type="submit"
                  disabled={!pwCheck.ok || newPw !== newPw2}
                >
                  Save new password
                </button>
              </form>
            )}
            <button
              className="btn-ghost btn-sm"
              style={{ marginTop: 12 }}
              onClick={() => { setMode('login'); setForgotStage('request'); setErr(''); }}
            >
              ← Back to login
            </button>
          </div>
        )}
      </div>

      {showReset && (
        <Confirm
          title="Reset of the installation"
          danger
          confirmLabel="Reset installation"
          requireText="RESET"
          message={
            <p>
              This clears the onboard installation and all local data. In production you would request
              a <strong>new token</strong> from support and re-activate. This cannot be undone.
            </p>
          }
          onCancel={() => setShowReset(false)}
          onConfirm={() => {
            setShowReset(false);
            resetInstallation();
          }}
        />
      )}
    </div>
  );
}
