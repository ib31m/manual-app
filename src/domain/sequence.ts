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
