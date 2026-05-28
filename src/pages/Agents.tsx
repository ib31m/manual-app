import { useState } from 'react';
import { useApp } from '../store/AppContext';
import type { Agent } from '../domain/types';
import { PORTS, portLabel } from '../data/ports';
import { uid } from '../lib/util';
import { Modal } from '../components/common/Modal';
import { TextField } from '../components/common/Fields';

const ROLES = ['Husbandry Agent', 'Charterer/Liners Agent', 'Cargo owner Agent', 'Other'];

// §3.16 — Agents: company, address, phones, serviced ports and roles.
export function AgentsPage() {
  const { db, update, notify } = useApp();
  const [editing, setEditing] = useState<Agent | null>(null);
  if (!db) return null;

  function blank(): Agent {
    return { id: uid('ag'), company: '', address: '', phone: '', servicedPorts: [], roles: [] };
  }
  function save(a: Agent) {
    if (!a.company.trim()) { notify('err', 'Company name is required.'); return; }
    update((d) => { const i = d.agents.findIndex((x) => x.id === a.id); if (i >= 0) d.agents[i] = a; else d.agents.push(a); });
    notify('ok', 'Agent saved.');
    setEditing(null);
  }

  return (
    <div className="stack">
      <div className="card">
        <div className="card-head">
          <h2>Agents</h2>
          <button className="btn-primary" onClick={() => setEditing(blank())}>+ New agent</button>
        </div>
        <div className="table-wrap">
          <table>
            <thead><tr><th>Company</th><th>Phone</th><th>Serviced ports</th><th>Roles</th><th></th></tr></thead>
            <tbody>
              {db.agents.length === 0 && <tr><td colSpan={5} className="empty">No agents recorded.</td></tr>}
              {db.agents.map((a) => (
                <tr key={a.id} className="clickable" onClick={() => setEditing(structuredClone(a))}>
                  <td><strong>{a.company}</strong><div className="text-muted" style={{ fontSize: '.78rem' }}>{a.address}</div></td>
                  <td>{a.phone}</td>
                  <td>{a.servicedPorts.map(portLabel).join(', ') || '—'}</td>
                  <td>{a.roles.join(', ') || '—'}</td>
                  <td onClick={(e) => e.stopPropagation()}>
                    <button className="btn-ghost btn-sm text-err" onClick={() => { update((d) => { d.agents = d.agents.filter((x) => x.id !== a.id); }); notify('info', 'Agent removed.'); }}>Delete</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {editing && <AgentEditor agent={editing} onCancel={() => setEditing(null)} onSave={save} />}
    </div>
  );
}

function AgentEditor({ agent, onCancel, onSave }: { agent: Agent; onCancel: () => void; onSave: (a: Agent) => void }) {
  const [a, setA] = useState(agent);
  const set = <K extends keyof Agent>(k: K, v: Agent[K]) => setA((c) => ({ ...c, [k]: v }));
  const toggle = (list: string[], v: string) => (list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);

  return (
    <Modal title={agent.company ? `Edit ${agent.company}` : 'New agent'} onClose={onCancel} footer={<><button onClick={onCancel}>Cancel</button><button className="btn-primary" onClick={() => onSave(a)}>Save</button></>}>
      <TextField label="Company" required value={a.company} onChange={(v) => set('company', v)} />
      <TextField label="Address" value={a.address} onChange={(v) => set('address', v)} />
      <TextField label="Phone" value={a.phone} onChange={(v) => set('phone', v)} />
      <div className="field">
        <label>Serviced ports</label>
        <div className="pill-group">
          {PORTS.map((p) => (
            <span key={p.code} className={`pill${a.servicedPorts.includes(p.code) ? ' active' : ''}`} onClick={() => set('servicedPorts', toggle(a.servicedPorts, p.code))}>{p.code}</span>
          ))}
        </div>
      </div>
      <div className="field">
        <label>Roles</label>
        <div className="pill-group">
          {ROLES.map((r) => (
            <span key={r} className={`pill${a.roles.includes(r) ? ' active' : ''}`} onClick={() => set('roles', toggle(a.roles, r))}>{r}</span>
          ))}
        </div>
      </div>
    </Modal>
  );
}
