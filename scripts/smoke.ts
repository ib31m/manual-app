// Runtime smoke test for the pure domain logic (no DOM/React).
// Bundled with esbuild and run under Node to verify behaviour end-to-end.
import assert from 'node:assert';
import { checkPassword, rememberedPasswordExpired } from '../src/domain/auth';
import { sulphurCategory } from '../src/data/fuels';
import { validateEvent, isSendable, robAfterEvent } from '../src/domain/validation';
import { commitEvent, removeEvent } from '../src/domain/fuelLedger';
import { deriveVoyageState } from '../src/domain/sequence';
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

console.log(`\nAll ${passed} domain smoke checks passed ✅`);
