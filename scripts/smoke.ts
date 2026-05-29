// Runtime smoke test for the pure domain logic (no DOM/React).
// Bundled with esbuild and run under Node to verify behaviour end-to-end.
import assert from 'node:assert';
import { checkPassword, rememberedPasswordExpired } from '../src/domain/auth';
import { sulphurCategory } from '../src/data/fuels';
import { validateEvent, isSendable, robAfterEvent } from '../src/domain/validation';
import { commitEvent, removeEvent } from '../src/domain/fuelLedger';
import { deriveVoyageState, offHireActive } from '../src/domain/sequence';
import { isFlaggedOffHire } from '../src/domain/validation';
import { robBySulphur, robByGroup, fuelGroup } from '../src/domain/fuelInfo';
import { seedDB } from '../src/data/seed';
import { activateWithToken, verifyPuk, issuePuk } from '../src/server/mockServer';
import type { OnboardDB, VesselEvent } from '../src/domain/types';

let passed = 0;
const ok = (name: string) => { passed++; console.log('  ✓', name); };

// --- Auth / password rules (s-Insight §2.2) ---
assert.strictEqual(checkPassword('short').ok, false);
assert.strictEqual(checkPassword('Abcdefghij1!').ok, true);
assert.strictEqual(checkPassword('alllowercase1!').ok, false); // no uppercase
ok('strong password rules enforced (10+, upper, lower, number, special)');

assert.strictEqual(rememberedPasswordExpired(new Date().toISOString()), false);
assert.strictEqual(rememberedPasswordExpired('2000-01-01T00:00:00Z'), true);
ok('remembered password expires after 30 days');

// --- Sulphur categorisation (s-Insight §3.10) ---
assert.strictEqual(sulphurCategory(0.6), 'HS');
assert.strictEqual(sulphurCategory(0.3), 'VLS');
assert.strictEqual(sulphurCategory(0.05), 'ULS');
ok('sulphur categories HS / VLS / ULS');

// --- Activation + PUK (Performance Lite §2.1 / §2.3) ---
assert.strictEqual(activateWithToken('nope').ok, false);
assert.strictEqual(activateWithToken('OCEANLY-DEMO-2026').ok, true);
const puk = issuePuk('OCEANLY-DEMO-2026');
assert.strictEqual(verifyPuk('OCEANLY-DEMO-2026', puk), true);
assert.strictEqual(verifyPuk('OCEANLY-DEMO-2026', '000000'), false);
ok('activation token validation + PUK issue/verify');

// --- Seed DB + voyage state derivation ---
const db: OnboardDB = seedDB(activateWithToken('OCEANLY-DEMO-2026').config!);
assert.ok(db.events.length >= 3);
assert.strictEqual(deriveVoyageState(db.events), 'Sea Passage'); // last sent state = BOSP→Sea, noon keeps it
ok('voyage state derived from event timeline = ' + deriveVoyageState(db.events));

// --- Validation: a valid noon event is sendable ---
const noon = db.events.find((e) => e.typeId === 'noon_sea')!;
assert.strictEqual(isSendable(db, noon), true);
ok('seeded noon event passes validation (sendable)');

// --- Validation: ROB cannot go negative (red error) ---
const hugeCons: VesselEvent = {
  ...structuredClone(noon),
  id: 'test_neg',
  consumptions: [{ id: 'c1', fuelId: db.fuels[0].id, consumer: 'ME', amount: 999999 }],
};
const negResults = validateEvent(db, hugeCons);
assert.ok(negResults.some((r) => r.severity === 'error' && r.field === 'rob'));
assert.strictEqual(isSendable(db, hugeCons), false);
ok('over-consumption triggers red ROB error and blocks send');

// --- Validation: missing reason for deviation is an error ---
const dev: VesselEvent = {
  id: 'test_dev', typeId: 'begin_deviation', voyageId: db.voyages[0].id,
  timeUtc: new Date().toISOString(), timeZoneLabel: 'UTC',
  position: { lat: 10, lon: 10 }, consumptions: [], fields: {}, status: 'ready',
  createdAt: new Date().toISOString(),
};
assert.ok(validateEvent(db, dev).some((r) => r.field === 'deviation_reason' && r.severity === 'error'));
ok('begin_deviation requires a reason (red error)');

// --- Fuel ledger: bunkering creates a fuel and consumption reduces ROB ---
const fuelCountBefore = db.fuels.length;
const bunker: VesselEvent = {
  id: 'test_bunker', typeId: 'bunkering', voyageId: db.voyages[0].id,
  timeUtc: new Date().toISOString(), timeZoneLabel: 'UTC', consumptions: [],
  fields: { new_fuel_grade: 'RMG380', new_fuel_sulphur: 0.4, new_fuel_amount: 500, new_fuel_bdn: 'BDN-TEST' },
  status: 'ready', createdAt: new Date().toISOString(),
};
commitEvent(db, bunker);
assert.strictEqual(db.fuels.length, fuelCountBefore + 1);
const created = db.fuels.find((f) => f.bdn === 'BDN-TEST')!;
assert.strictEqual(created.rob, 500);
ok('bunkering creates a fuel parcel with correct ROB');

const robBefore = created.rob;
const consume: VesselEvent = {
  id: 'test_consume', typeId: 'noon_sea', voyageId: db.voyages[0].id,
  timeUtc: new Date(Date.now() + 3600000).toISOString(), timeZoneLabel: 'UTC',
  position: { lat: 5, lon: 5 }, weather: { windForceBft: 3 },
  consumptions: [{ id: 'c', fuelId: created.id, consumer: 'ME', amount: 120 }],
  fields: {}, status: 'ready', createdAt: new Date().toISOString(),
};
commitEvent(db, consume);
assert.strictEqual(db.fuels.find((f) => f.id === created.id)!.rob, robBefore - 120);
ok('consumption reduces fuel ROB via ledger (' + robBefore + ' → ' + (robBefore - 120) + ')');

// --- Editing an event re-diffs the ledger (no double counting) ---
const edited = { ...structuredClone(consume), consumptions: [{ id: 'c', fuelId: created.id, consumer: 'ME' as const, amount: 100 }] };
commitEvent(db, edited);
assert.strictEqual(db.fuels.find((f) => f.id === created.id)!.rob, robBefore - 100);
ok('editing consumption re-applies delta correctly (→ ' + (robBefore - 100) + ')');

// --- Deleting reverses the ledger ---
removeEvent(db, consume.id);
assert.strictEqual(db.fuels.find((f) => f.id === created.id)!.rob, robBefore);
ok('deleting event reverses ROB effect (→ ' + robBefore + ')');

// --- robAfterEvent preview matches ---
const preview = robAfterEvent(db, { ...consume, consumptions: [{ id: 'c', fuelId: created.id, consumer: 'ME', amount: 50 }] });
assert.strictEqual(preview.find((r) => r.fuelId === created.id)!.after, robBefore - 50);
ok('Check ROB preview computes after-consumption ROB');

// --- Fuel Information panel: ROB by sulphur category and group ---
const info = robBySulphur(db.fuels);
assert.ok(Math.abs(info.ULS + info.VLS + info.HS - info.total) < 0.01);
assert.ok(robByGroup(db.fuels).length >= 1);
assert.strictEqual(fuelGroup('RMG380'), 'LFO/HFO');
assert.strictEqual(fuelGroup('DMA'), 'MDO/MGO');
ok('Information panel groups ROB by sulphur category and fuel group');

// --- Off-hire flagging (manual §3.18) ---
const voyId = db.voyages[0].id;
const mk = (typeId: string, timeUtc: string): VesselEvent => ({
  id: 'oh_' + typeId + timeUtc, typeId, voyageId: voyId, timeUtc, timeZoneLabel: 'UTC',
  consumptions: [], fields: {}, status: 'ready', createdAt: timeUtc,
});
const ohEvents = [mk('begin_offhire', '2026-07-01T00:00:00.000Z'), mk('noon_sea', '2026-07-01T06:00:00.000Z'), mk('end_offhire', '2026-07-02T00:00:00.000Z')];
assert.strictEqual(offHireActive(ohEvents, '2026-07-01T06:00:00.000Z'), true);
assert.strictEqual(offHireActive(ohEvents, '2026-07-02T01:00:00.000Z'), false);
const dbOh: OnboardDB = { ...db, events: [...db.events, ...ohEvents] };
assert.strictEqual(isFlaggedOffHire(dbOh, ohEvents[1]), true);
ok('events during an off-hire period are flagged until End off-hire');

// --- Port log auto-generated on Arrival (manual §3.5) ---
const arr: VesselEvent = {
  id: 'arr_test', typeId: 'arrival', voyageId: voyId, timeUtc: '2026-06-05T20:00:00.000Z', timeZoneLabel: 'UTC',
  position: { lat: 1.26, lon: 103.8 }, consumptions: [{ id: 'c', fuelId: db.fuels[0].id, consumer: 'ME', amount: 1.2 }],
  fields: { port: 'SGSIN' }, status: 'ready', createdAt: '2026-06-05T20:00:00.000Z',
};
commitEvent(db, arr);
assert.ok(db.portLogs.some((p) => p.eventId === 'arr_test' && p.port === 'SGSIN'));
ok('filing an Arrival opens a port log automatically');

// --- Sea-passage sanity: speed-order over-consumption, distance & machinery warnings ---
const db2: OnboardDB = seedDB(activateWithToken('OCEANLY-DEMO-2026').config!);
const eco = db2.voyages[0].speedOrders[0];
const vlsfoId = db2.fuels[0].id;
const prevNoon: VesselEvent = {
  id: 'p1', typeId: 'noon_sea', voyageId: db2.voyages[0].id, timeUtc: '2026-07-01T00:00:00.000Z', timeZoneLabel: 'UTC',
  position: { lat: 40, lon: -10 }, sogKn: 12, distanceNm: 288, steamingHours: 24, weather: { windForceBft: 3 },
  machinery: { meHours: 24 }, consumptions: [{ id: 'c', fuelId: vlsfoId, consumer: 'ME', amount: 24 }],
  fields: { speed_order: eco.id }, status: 'ready', createdAt: '2026-07-01T00:00:00.000Z',
};
commitEvent(db2, prevNoon);
const testNoon: VesselEvent = {
  id: 'p2', typeId: 'noon_sea', voyageId: db2.voyages[0].id, timeUtc: '2026-07-02T00:00:00.000Z', timeZoneLabel: 'UTC',
  position: { lat: 38, lon: -12 }, sogKn: 12, /* distanceNm intentionally missing */ steamingHours: 24, weather: { windForceBft: 3 },
  machinery: { meHours: 40 }, consumptions: [{ id: 'c', fuelId: vlsfoId, consumer: 'ME', amount: 60 }],
  fields: { speed_order: eco.id }, status: 'ready', createdAt: '2026-07-02T00:00:00.000Z',
};
const r2 = validateEvent(db2, testNoon);
assert.ok(r2.some((r) => r.field === 'speed_order' && r.severity === 'warning'), 'expected speed-order over-consumption warning');
assert.ok(r2.some((r) => r.field === 'distance' && r.severity === 'warning'), 'expected missing-distance warning');
assert.ok(r2.some((r) => r.field === 'machinery' && r.severity === 'warning'), 'expected machinery-hours warning');
ok('sea-passage checks: speed-order, distance and machinery-hours warnings fire');

console.log(`\nAll ${passed} domain smoke checks passed ✅`);
