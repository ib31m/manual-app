// Simulated s-Insight | Log Server / Performance Lite shore endpoint.
//
// The manuals describe a shore Server reached via connection/e-mail that:
//  - provisions each ship with a URL + unique activation token (Perf. Lite §2.1)
//  - identifies a vessel by IMO number and returns config + password (s-Insight §2.1)
//  - issues a PUK on "Forgot password" (Perf. Lite §2.3)
//  - receives event reports and stores them (s-Insight §3.19)
//
// Here it is an in-browser stand-in so the full workflow is demonstrable offline.

import type { VesselConfig } from '../domain/types';

export interface ProvisionedVessel {
  token: string;
  config: VesselConfig;
}

// Vessels "provisioned" on the shore server. The token is what a ship is given.
export const PROVISIONED: ProvisionedVessel[] = [
  {
    token: 'OCEANLY-DEMO-2026',
    config: {
      vesselName: 'MV Nordic Voyager',
      imo: '9876543',
      shipType: 'Bulk carrier',
      callSign: 'LADV7',
      flag: 'Norway',
      configVersion: '2.12.0',
    },
  },
  {
    token: 'STORMGEO-TANKER-01',
    config: {
      vesselName: 'MT Aurora Spirit',
      imo: '9650012',
      shipType: 'Tanker',
      callSign: '3FBN8',
      flag: 'Panama',
      configVersion: '2.12.0',
    },
  },
];

export interface ActivationResult {
  ok: boolean;
  config?: VesselConfig;
  error?: string;
}

/** Activate the ship environment with a unique token (Perf. Lite §2.1). */
export function activateWithToken(token: string): ActivationResult {
  const t = token.trim().toUpperCase();
  if (!t) return { ok: false, error: 'Please enter your activation token.' };
  const match = PROVISIONED.find((p) => p.token === t);
  if (!match) {
    return {
      ok: false,
      error:
        'Token not recognised by the server. Activation requires a valid token issued for your vessel (connectivity required at first run).',
    };
  }
  return { ok: true, config: match.config };
}

/** Import configuration by IMO number (s-Insight §2.1). */
export function requestConfigByImo(imo: string): ActivationResult {
  const match = PROVISIONED.find((p) => p.config.imo === imo.trim());
  if (!match) {
    return { ok: false, error: 'No vessel found for this IMO number on the server.' };
  }
  return { ok: true, config: match.config };
}

/**
 * Issue a PUK for password reset (Perf. Lite §2.3). In production this is
 * e-mailed to the vessel after contacting support. Here it is derived from the
 * token so the flow can be completed in the demo, and returned to be displayed.
 */
export function issuePuk(token: string): string {
  const t = token.trim().toUpperCase();
  let hash = 0;
  for (let i = 0; i < t.length; i++) {
    hash = (hash * 31 + t.charCodeAt(i)) % 1000000;
  }
  return String(100000 + (hash % 900000));
}

export function verifyPuk(token: string, puk: string): boolean {
  return issuePuk(token) === puk.trim();
}

let reportCounter = Date.now() % 100000;

/** Accept an events report and return an archive/report ID (s-Insight §4.3). */
export function sendReport(_eventCount: number): { reportId: string; receivedAt: string } {
  reportCounter += 1;
  return {
    reportId: `RPT-${new Date().getFullYear()}-${String(reportCounter).padStart(6, '0')}`,
    receivedAt: new Date().toISOString(),
  };
}

/** Current available Recorder version, for the upgrade prompt (Perf. Lite §2.5). */
export const SERVER_VERSION = '2.12.0';
