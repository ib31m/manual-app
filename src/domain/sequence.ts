// Reporting-sequence / voyage-state logic (s-Insight §3.2).
// The voyage state is derived from the most recent (non-draft) event that
// changes the state. New events are offered in-sequence based on this state.

import type { VesselEvent, VoyageState } from './types';
import { eventTypeById } from '../data/eventTypes';

export const DEFAULT_STATE: VoyageState = 'Port';

/**
 * Derive the current voyage state from the event timeline.
 * Drafts are ignored (manual §3.12: following events behave as if drafts
 * don't exist).
 */
export function deriveVoyageState(events: VesselEvent[]): VoyageState {
  const ordered = [...events]
    .filter((e) => e.status !== 'draft')
    .sort((a, b) => a.timeUtc.localeCompare(b.timeUtc));

  let state: VoyageState = DEFAULT_STATE;
  for (const ev of ordered) {
    const def = eventTypeById(ev.typeId);
    if (def?.resultState) state = def.resultState;
  }
  return state;
}

/** Milliseconds between two events; used for duration / fuel-rate sanity. */
export function durationHours(fromIso: string, toIso: string): number {
  return (new Date(toIso).getTime() - new Date(fromIso).getTime()) / (1000 * 60 * 60);
}

/** The latest non-draft event strictly before the given time. */
export function previousEvent(events: VesselEvent[], beforeIso: string, excludeId?: string): VesselEvent | undefined {
  return [...events]
    .filter((e) => e.status !== 'draft' && e.id !== excludeId && e.timeUtc < beforeIso)
    .sort((a, b) => b.timeUtc.localeCompare(a.timeUtc))[0];
}

/**
 * The latest event before `beforeIso` that actually reported consumptions.
 * Events marked "consumptions intentionally not reported" are skipped for
 * duration / running-hour calculations (manual §3.3).
 */
export function previousReportingEvent(events: VesselEvent[], beforeIso: string, excludeId?: string): VesselEvent | undefined {
  return [...events]
    .filter(
      (e) =>
        e.status !== 'draft' &&
        e.id !== excludeId &&
        e.timeUtc < beforeIso &&
        !e.consumptionsSkipped &&
        e.consumptions.length > 0, // only events that actually reported consumptions
    )
    .sort((a, b) => b.timeUtc.localeCompare(a.timeUtc))[0];
}

/**
 * Whether the vessel is in an off-hire period at the given time, i.e. a
 * "Begin off-hire" was filed without a subsequent "End off-hire" (manual §3.18).
 * Subsequent events should be flagged until the period is finished.
 */
export function offHireActive(events: VesselEvent[], atIso: string, excludeId?: string): boolean {
  const before = [...events]
    .filter((e) => e.status !== 'draft' && e.id !== excludeId && e.timeUtc <= atIso)
    .sort((a, b) => a.timeUtc.localeCompare(b.timeUtc));
  let active = false;
  for (const e of before) {
    if (e.typeId === 'begin_offhire') active = true;
    if (e.typeId === 'end_offhire') active = false;
  }
  return active;
}
