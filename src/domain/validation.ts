// Plausibility-check engine (s-Insight §3.3).
// Produces check results with three severities:
//   error (red)  -> blocks sending
//   warning (blue) -> should be reviewed, can still send
//   info (green) -> informational only
//
// The rules below implement the checks the manual describes in words:
// required fields, ROB cannot go negative, fuels need type/sulphur/mass before
// consumption, off-hire needs reasons, fuel sludge <= 2%, consumption-rate
// sanity, voyage/port consistency, etc.

import type { OnboardDB, VesselEvent } from './types';
import { eventTypeById, DISPOSAL_EVENT_IDS } from '../data/eventTypes';
import { durationHours, previousReportingEvent, offHireActive } from './sequence';

export type Severity = 'error' | 'warning' | 'info';

export interface CheckResult {
  severity: Severity;
  field: string;
  message: string;
}

/** Compute fuel ROB after applying an event's consumptions/bunkering. */
export function robAfterEvent(
  db: OnboardDB,
  event: VesselEvent,
): { fuelId: string; label: string; before: number; after: number }[] {
  return db.fuels.map((f) => {
    const consumed = event.consumptionsSkipped
      ? 0
      : event.consumptions
          .filter((c) => c.fuelId === f.id)
          .reduce((s, c) => s + (Number(c.amount) || 0), 0);
    // Bunkering / sounding correction adjust ROB via dedicated fields.
    const bunkered = Number(event.fields[`bunker_${f.id}`] || 0);
    const correction = Number(event.fields[`correct_${f.id}`] || 0);
    const before = f.rob;
    const after = before - consumed + bunkered + correction;
    return { fuelId: f.id, label: f.label, before, after };
  });
}

export function validateEvent(db: OnboardDB, event: VesselEvent): CheckResult[] {
  const out: CheckResult[] = [];
  const def = eventTypeById(event.typeId);
  if (!def) return [{ severity: 'error', field: 'type', message: 'Unknown event type.' }];

  // --- Time & voyage (required for every event) ---
  if (!event.timeUtc || Number.isNaN(Date.parse(event.timeUtc))) {
    out.push({ severity: 'error', field: 'time', message: 'A valid event time is required.' });
  }
  if (!event.voyageId || !db.voyages.some((v) => v.id === event.voyageId)) {
    out.push({
      severity: 'error',
      field: 'voyage',
      message: 'Every event must belong to a voyage, otherwise it cannot be sent to shore.',
    });
  }

  // Time must not be in the future (basic plausibility).
  if (event.timeUtc && Date.parse(event.timeUtc) > Date.now() + 60 * 60 * 1000) {
    out.push({ severity: 'warning', field: 'time', message: 'Event time is in the future — please double-check.' });
  }

  // --- Position ---
  if (def.hasPosition) {
    const { lat, lon } = event.position ?? {};
    if (lat === undefined || lon === undefined) {
      out.push({ severity: 'warning', field: 'position', message: 'Position (lat/lon) should be reported for this event.' });
    } else {
      if (lat < -90 || lat > 90) out.push({ severity: 'error', field: 'position', message: 'Latitude must be between -90 and 90.' });
      if (lon < -180 || lon > 180) out.push({ severity: 'error', field: 'position', message: 'Longitude must be between -180 and 180.' });
    }
  }

  // --- Weather ---
  if (def.hasWeather && !event.consumptionsSkipped) {
    const w = event.weather;
    if (!w || w.windForceBft === undefined) {
      out.push({ severity: 'warning', field: 'weather', message: 'Weather should be reported (prevailing since last event).' });
    } else if (w.windForceBft < 0 || w.windForceBft > 12) {
      out.push({ severity: 'error', field: 'weather', message: 'Wind force (Beaufort) must be between 0 and 12.' });
    }
  }

  // --- Consumptions / ROB ---
  if (def.hasConsumptions) {
    if (event.consumptionsSkipped) {
      out.push({
        severity: 'info',
        field: 'consumptions',
        message: 'Consumptions are intentionally not reported in this event. Following events will skip it for duration calculations.',
      });
    } else {
      for (const line of event.consumptions) {
        const fuel = db.fuels.find((f) => f.id === line.fuelId);
        if (!fuel) {
          out.push({ severity: 'error', field: 'consumptions', message: 'A consumption references a fuel that is not onboard.' });
          continue;
        }
        // Fuels cannot be consumed without type, sulphur and mass (manual §3.3).
        if (!fuel.gradeId || fuel.sulphurPct === undefined) {
          out.push({
            severity: 'error',
            field: 'consumptions',
            message: `Fuel "${fuel.label}" is missing type/sulphur and cannot be consumed.`,
          });
        }
        if (Number(line.amount) < 0) {
          out.push({ severity: 'error', field: 'consumptions', message: 'Consumption amount cannot be negative.' });
        }
      }

      // ROB cannot become negative.
      for (const r of robAfterEvent(db, event)) {
        if (r.after < -0.001) {
          out.push({
            severity: 'error',
            field: 'rob',
            message: `Remaining on board for "${r.label}" would become negative (${r.after.toFixed(2)} mt).`,
          });
        }
      }

      // Consumption-rate sanity vs. the previous reporting event (blue warning).
      const prev = previousReportingEvent(db.events, event.timeUtc, event.id);
      if (prev) {
        const hrs = durationHours(prev.timeUtc, event.timeUtc);
        const totalCons = event.consumptions.reduce((s, c) => s + (Number(c.amount) || 0), 0);
        if (hrs > 0 && totalCons > 0) {
          const perDay = (totalCons / hrs) * 24;
          if (perDay > 250) {
            out.push({
              severity: 'warning',
              field: 'consumptions',
              message: `Implied consumption is very high (${perDay.toFixed(0)} mt/day) — please review.`,
            });
          }
        }
        if (hrs < 0) {
          out.push({ severity: 'warning', field: 'time', message: 'This event is placed before an existing event — double-check surrounding events.' });
        }

        // Machinery running hours cannot exceed the time since the last event.
        if (hrs > 0 && event.machinery) {
          const limit = hrs * 1.05; // small tolerance
          const checkHrs = (h: number | undefined, name: string) => {
            if (h !== undefined && h > limit) {
              out.push({ severity: 'warning', field: 'machinery', message: `${name} running hours (${h.toFixed(1)} h) exceed the ${hrs.toFixed(1)} h since the last event.` });
            }
          };
          checkHrs(event.machinery.meHours, 'M/E');
          checkHrs(event.machinery.boilerHours, 'Boiler');
        }

        // Distance vs speed×time sanity, and engine slip (manual §4.1).
        if (def.hasDistance && hrs > 0) {
          const dist = Number(event.distanceNm ?? NaN);
          if (Number.isNaN(dist)) {
            if (def.id === 'noon_sea' || def.id === 'eosp') {
              out.push({ severity: 'warning', field: 'distance', message: 'Sailed distance should be reported on sea passage.' });
            }
          } else if (dist > 0 && event.sogKn) {
            const expected = event.sogKn * hrs;
            if (expected > 0 && Math.abs(dist - expected) / expected > 0.25) {
              out.push({ severity: 'warning', field: 'distance', message: `Distance (${dist} nm) and SOG×time (${expected.toFixed(0)} nm) differ by >25% — please review.` });
            }
          }
          if (event.engineDistanceNm && event.distanceNm) {
            const slip = ((event.engineDistanceNm - event.distanceNm) / event.engineDistanceNm) * 100;
            if (slip < -8 || slip > 25) {
              out.push({ severity: 'warning', field: 'slip', message: `Propeller slip of ${slip.toFixed(1)}% is outside the usual range (−8% to 25%).` });
            }
          }
        }

        // Speed order over-consumption (manual §3.15.5).
        const soId = String(event.fields['speed_order'] || '');
        const voy = db.voyages.find((v) => v.id === event.voyageId);
        const so = voy?.speedOrders.find((s) => s.id === soId);
        if (so && hrs > 0 && totalCons > 0) {
          const perDay = (totalCons / hrs) * 24;
          if (so.maxConsumptionMtPerDay > 0 && perDay > so.maxConsumptionMtPerDay * 1.05) {
            out.push({ severity: 'warning', field: 'speed_order', message: `Consumption ${perDay.toFixed(1)} mt/day exceeds the "${so.name}" warranty of ${so.maxConsumptionMtPerDay} mt/day.` });
          }
          if (event.sogKn !== undefined && event.sogKn < so.minSpeedKn) {
            out.push({ severity: 'info', field: 'speed_order', message: `Speed ${event.sogKn} kn is below the "${so.name}" minimum of ${so.minSpeedKn} kn.` });
          }
        }
      }

      // Fuel sludge must not exceed 2% of related consumption (manual §3.10).
      const sludge = Number(event.fields['fuel_sludge'] || 0);
      const conventional = event.consumptions
        .filter((c) => c.consumer === 'ME' || c.consumer === 'AE')
        .reduce((s, c) => s + (Number(c.amount) || 0), 0);
      if (sludge > 0 && conventional > 0 && sludge > 0.02 * conventional) {
        out.push({
          severity: 'error',
          field: 'fuel_sludge',
          message: 'Fuel sludge should not exceed 2% of the related consumption.',
        });
      }
    }
  }

  // --- Event-specific required fields ---
  switch (def.id) {
    case 'arrival':
    case 'departure':
    case 'begin_shifting':
    case 'end_shifting':
      if (!event.fields['port']) {
        out.push({ severity: 'error', field: 'port', message: 'Port is required for this event.' });
      }
      break;
    case 'begin_offhire':
      if (!event.fields['offhire_reason']) {
        out.push({ severity: 'error', field: 'offhire_reason', message: 'At least one off-hire reason is required.' });
      }
      if (!event.fields['offhire_mode']) {
        out.push({ severity: 'error', field: 'offhire_mode', message: 'Off-hire mode (scheduled/unscheduled) is required.' });
      }
      if (event.fields['offhire_percent'] === undefined || event.fields['offhire_percent'] === '') {
        out.push({ severity: 'warning', field: 'offhire_percent', message: 'Off-hire percentage should be provided.' });
      }
      break;
    case 'begin_deviation':
    case 'change_destination':
      if (!event.fields['deviation_reason']) {
        out.push({ severity: 'error', field: 'deviation_reason', message: 'A reason for deviation is required (Rescuing / Emergency / Weather / Technical damage).' });
      }
      break;
    case 'bunkering': {
      const total = db.fuels.reduce((s, f) => s + Number(event.fields[`bunker_${f.id}`] || 0), 0);
      const newGrade = event.fields['new_fuel_grade'];
      const newAmount = Number(event.fields['new_fuel_amount'] || 0);
      if (total <= 0 && newAmount <= 0) {
        out.push({ severity: 'error', field: 'bunker', message: 'A bunkering event must add a positive quantity of fuel.' });
      }
      if (newAmount > 0) {
        if (!newGrade) out.push({ severity: 'error', field: 'new_fuel_grade', message: 'Select a fuel grade for the bunkered fuel.' });
        if (event.fields['new_fuel_sulphur'] === undefined || event.fields['new_fuel_sulphur'] === '') {
          out.push({ severity: 'error', field: 'new_fuel_sulphur', message: 'Sulphur content is required for the bunkered fuel.' });
        }
        if (!event.fields['new_fuel_bdn']) {
          out.push({ severity: 'warning', field: 'new_fuel_bdn', message: 'BDN/BDR number should be provided for bunkered fuel.' });
        }
      }
      break;
    }
    default:
      break;
  }

  // Disposal events feed the Garbage Record Book — encourage completeness.
  if (DISPOSAL_EVENT_IDS.includes(def.id)) {
    if (!event.fields['garbage_category']) {
      out.push({ severity: 'warning', field: 'garbage_category', message: 'Garbage category should be recorded for the Garbage Record Book.' });
    }
    if (event.fields['garbage_amount'] === undefined || event.fields['garbage_amount'] === '') {
      out.push({ severity: 'warning', field: 'garbage_amount', message: 'Estimated amount (m³) should be recorded.' });
    }
  }

  // --- Voyage/port consistency (green info, manual §3.15) ---
  const voyage = db.voyages.find((v) => v.id === event.voyageId);
  if (voyage && def.id === 'arrival' && event.fields['port']) {
    if (event.fields['port'] === voyage.arrivalPort) {
      out.push({
        severity: 'info',
        field: 'voyage',
        message: 'You have reached the arrival port of the current voyage — consider creating a new voyage.',
      });
    }
  }

  // --- Off-hire flagging (manual §3.18): events during an off-hire period ---
  if (def.id !== 'begin_offhire' && def.id !== 'end_offhire' && event.timeUtc) {
    if (offHireActive(db.events, event.timeUtc, event.id)) {
      out.push({ severity: 'info', field: 'off-hire', message: 'Vessel is in an off-hire period — this event is flagged until "End off-hire" is filed.' });
    }
  }

  return out;
}

/** True if the vessel is off-hire at the given event's time. */
export function isFlaggedOffHire(db: OnboardDB, event: VesselEvent): boolean {
  if (event.typeId === 'begin_offhire' || event.typeId === 'end_offhire') return false;
  return offHireActive(db.events, event.timeUtc, event.id);
}

export interface CheckSummary {
  errors: number;
  warnings: number;
  infos: number;
  results: CheckResult[];
}

export function summarize(results: CheckResult[]): CheckSummary {
  return {
    errors: results.filter((r) => r.severity === 'error').length,
    warnings: results.filter((r) => r.severity === 'warning').length,
    infos: results.filter((r) => r.severity === 'info').length,
    results,
  };
}

/** An event is sendable when it has no errors (blue warnings are allowed). */
export function isSendable(db: OnboardDB, event: VesselEvent): boolean {
  return validateEvent(db, event).every((r) => r.severity !== 'error');
}
