// Fuel "remaining on board" (ROB) ledger.
//
// db.fuels[].rob is the LIVE remaining-on-board. Events change it:
//   - consumptions decrease ROB
//   - bunkering / sounding corrections increase or adjust ROB
//
// To keep ROB consistent across create / edit / delete we diff each event
// against its previously-saved version (transactional delta). This mirrors the
// manual's running ROB calculation and its Check ROB control (§3.3).

import type { FuelOnboard, OnboardDB, VesselEvent } from './types';
import { gradeById, sulphurCategory } from '../data/fuels';
import { uid } from '../lib/util';

/** Per-fuel ROB delta of an event for fuels that already exist onboard. */
export function fuelDelta(event: VesselEvent): Record<string, number> {
  const delta: Record<string, number> = {};
  const add = (fuelId: string, v: number) => {
    delta[fuelId] = (delta[fuelId] ?? 0) + v;
  };
  if (!event.consumptionsSkipped) {
    for (const c of event.consumptions) add(c.fuelId, -(Number(c.amount) || 0));
  }
  for (const key of Object.keys(event.fields)) {
    if (key.startsWith('bunker_')) add(key.slice('bunker_'.length), Number(event.fields[key]) || 0);
    if (key.startsWith('correct_')) add(key.slice('correct_'.length), Number(event.fields[key]) || 0);
  }
  return delta;
}

function applyDelta(db: OnboardDB, delta: Record<string, number>, sign: 1 | -1) {
  for (const [fuelId, v] of Object.entries(delta)) {
    const f = db.fuels.find((x) => x.id === fuelId);
    if (f) f.rob = +(f.rob + sign * v).toFixed(3);
  }
}

/** Build a FuelOnboard from a bunkering event's new-fuel fields, or null. */
function buildBunkerFuel(event: VesselEvent, id: string): FuelOnboard | null {
  const gradeId = String(event.fields['new_fuel_grade'] || '');
  const amount = Number(event.fields['new_fuel_amount'] || 0);
  const sulphur = Number(event.fields['new_fuel_sulphur'] || 0);
  if (!gradeId || amount <= 0) return null;
  const grade = gradeById(gradeId);
  return {
    id,
    gradeId,
    label: `${grade?.type ?? gradeId} (${sulphurCategory(sulphur)})`,
    sulphurPct: sulphur,
    sulphurCategory: sulphurCategory(sulphur),
    rob: amount,
    bdn: String(event.fields['new_fuel_bdn'] || '') || undefined,
    lhv: grade?.defaultLhv,
  };
}

/**
 * Commit an event (new or edited) into the DB, keeping the fuel ledger
 * consistent. Mutates `db` (call inside the store's `update`).
 */
export function commitEvent(db: OnboardDB, event: VesselEvent) {
  const idx = db.events.findIndex((e) => e.id === event.id);
  const prev = idx >= 0 ? db.events[idx] : undefined;

  // Reverse the previously-saved version's effect (edits).
  if (prev && prev.status !== 'draft') applyDelta(db, fuelDelta(prev), -1);

  // Handle bunkering: create the fuel parcel once, then keep it in sync.
  const next: VesselEvent = structuredClone(event);
  if (next.typeId === 'bunkering' && next.status !== 'draft') {
    const createdId = String(next.fields['_createdFuelId'] || '');
    const built = buildBunkerFuel(next, createdId || uid('fuel'));
    if (built) {
      if (createdId && db.fuels.some((f) => f.id === createdId)) {
        const f = db.fuels.find((x) => x.id === createdId)!;
        Object.assign(f, built, { id: createdId });
      } else {
        db.fuels.push(built);
        next.fields['_createdFuelId'] = built.id;
      }
    }
  }

  // Apply the new version's effect (skip drafts — they are ignored, §3.12).
  if (next.status !== 'draft') applyDelta(db, fuelDelta(next), 1);

  if (idx >= 0) db.events[idx] = next;
  else db.events.push(next);

  // A port log opens automatically on Arrival / End-shifting (manual §3.5).
  if ((next.typeId === 'arrival' || next.typeId === 'end_shifting') && next.status !== 'draft') {
    if (!db.portLogs.some((p) => p.eventId === next.id)) {
      db.portLogs.push({
        id: uid('pl'),
        eventId: next.id,
        port: String(next.fields['port'] ?? ''),
        facts: [],
        delays: [],
        remarks: '',
      });
    }
  }
}

/** Reverse an event's effect and remove it (delete). Mutates `db`. */
export function removeEvent(db: OnboardDB, eventId: string) {
  const ev = db.events.find((e) => e.id === eventId);
  if (!ev) return;
  if (ev.status !== 'draft') applyDelta(db, fuelDelta(ev), -1);
  // If this bunkering created a fuel parcel, remove it too.
  const createdId = String(ev.fields['_createdFuelId'] || '');
  if (createdId) db.fuels = db.fuels.filter((f) => f.id !== createdId);
  db.events = db.events.filter((e) => e.id !== eventId);
}

/**
 * A DB view as if `event`'s currently-saved version had not been applied —
 * used by the editor so Check ROB / validation reflect the edit correctly.
 */
export function baselineWithout(db: OnboardDB, eventId: string): OnboardDB {
  const clone = structuredClone(db);
  const prev = clone.events.find((e) => e.id === eventId);
  if (prev && prev.status !== 'draft') applyDelta(clone, fuelDelta(prev), -1);
  return clone;
}
