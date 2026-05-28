import { useState } from 'react';
import { useApp } from '../store/AppContext';
import type { Officer } from '../domain/types';
import { uid, fmtDate } from '../lib/util';
import { Modal } from '../components/common/Modal';
import { SelectField, TextField } from '../components/common/Fields';

// §3.14 — Modify current Master / Chief Engineer. Always add new entries;
// the list is sorted by sign-on date and "In charge" is set on the latest.
export function OfficersPage() {
  const { db, update, notify } = useApp();
  const [adding, setAdding] = useState(false);
  const [role, setRole] = useState<Officer['role']>('Master');
  const [name, setName] = useState('');
  const [signOn, setSignOn] = useState(new Date().toISOString().slice(0, 10));
  if (!db) return null;

  function recomputeInCharge(officers: Officer[]) {
    (['Master', 'Chief Engineer'] as const).forEach((r) => {
      const ofRole = officers.filter((o) => o.role === r).sort((a, b) => a.signOn.localeCompare(b.signOn));
      ofRole.forEach((o, i) => (o.inCharge = i === ofRole.length - 1));
    });
  }

  function add() {
    if (!name.trim()) {
      notify('err', 'Officer name is required.');
      return;
    }
    update((d) => {
      d.officers.push({ id: uid('off'), role, name: name.trim(), signOn, inCharge: false });
      recomputeInCharge(d.officers);
    });
    notify('ok', `${role} added.`);
    setAdding(false);
    setName('');
  }

  const sorted = [...db.officers].sort((a, b) => b.signOn.localeCompare(a.signOn));

  return (
    <div className="stack">
      <div className="card">
        <div className="card-head">
          <h2>Officers</h2>
          <button className="btn-primary" onClick={() => setAdding(true)}>+ Add / edit officers</button>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr><th>Role</th><th>Name</th><th>Sign-on</th><th>In charge</th></tr>
            </thead>
            <tbody>
              {sorted.length === 0 && <tr><td colSpan={4} className="empty">No officers recorded.</td></tr>}
              {sorted.map((o) => (
                <tr key={o.id}>
                  <td>{o.role}</td>
                  <td>{o.name}</td>
                  <td>{fmtDate(o.signOn)}</td>
                  <td>{o.inCharge ? <span className="badge badge-ok">In charge</span> : <span className="badge badge-muted">Former</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="hint" style={{ marginTop: 8 }}>
          Do not overwrite former officers — always create a new entry. The “In charge” flag is set
          automatically from the latest sign-on date.
        </div>
      </div>

      {adding && (
        <Modal title="Add officer" onClose={() => setAdding(false)} footer={<><button onClick={() => setAdding(false)}>Cancel</button><button className="btn-primary" onClick={add}>Save</button></>}>
          <SelectField label="Role" value={role} onChange={(v) => setRole(v as Officer['role'])} options={[{ value: 'Master', label: 'Master' }, { value: 'Chief Engineer', label: 'Chief Engineer' }]} />
          <TextField label="Name" required value={name} onChange={setName} />
          <TextField label="Sign-on date" type="date" value={signOn} onChange={setSignOn} />
        </Modal>
      )}
    </div>
  );
}
