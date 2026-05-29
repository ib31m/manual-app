import type { OnboardDB, VesselConfig, VesselEvent } from '../domain/types';
import { sulphurCategory } from './fuels';
import { uid } from '../lib/util';

/** Default settings for a fresh installation. */
export function defaultSettings(): OnboardDB['settings'] {
  return {
    defaultNoonTime: '12:00',
    includeInvalidEventDetails: false,
    allowEventDeletion: false,
    autoBackup: false,
    exportConfigured: true,
    exportEmail: 'logserver@stormgeo.com',
    rememberPassword: false,
  };
}

/** An empty onboard database for a freshly-activated vessel. */
export function emptyDB(config: VesselConfig): OnboardDB {
  return {
    config,
    settings: defaultSettings(),
    initialized: false,
    fuels: [],
    voyages: [],
    events: [],
    officers: [],
    bills: [],
    agents: [],
    schedule: [],
    garbage: [],
    portLogs: [],
    archive: [],
  };
}

/**
 * Realistic demo voyage: a laden bulk carrier on a Europe–Far East leg, just
 * departed Hamburg and crossing the North Sea / English Channel SOx-ECA (so it
 * burns compliant MGO inside the ECA, switching to VLSFO after Ushant). It has
 * sent noon reports with distances and running hours, a garbage disposal, one
 * ready (unsent) noon and a draft ETA update — i.e. a live operational picture.
 */
export function seedDB(config: VesselConfig): OnboardDB {
  const db = emptyDB(config);
  db.initialized = true;

  const vlsfo = {
    id: uid('fuel'),
    gradeId: 'RMG380',
    label: 'VLSFO RMG380',
    sulphurPct: 0.46,
    sulphurCategory: sulphurCategory(0.46),
    rob: 1184.0,
    bdn: 'BDN-RTM-26041',
    lhv: 40.5,
  };
  const mgo = {
    id: uid('fuel'),
    gradeId: 'DMA',
    label: 'MGO DMA (ULS)',
    sulphurPct: 0.08,
    sulphurCategory: sulphurCategory(0.08),
    rob: 432.0,
    bdn: 'BDN-RTM-26042',
    lhv: 42.7,
  };
  db.fuels = [vlsfo, mgo];

  const voyage = {
    id: uid('voy'),
    voyageNo: '2026-014',
    service: 'Europe – Far East',
    type: 'One way' as const,
    departurePort: 'DEHAM',
    arrivalPort: 'SGSIN',
    departureTime: '2026-05-12T04:00:00.000Z',
    arrivalTime: '2026-06-05T22:00:00.000Z',
    stages: [{ id: uid('stg'), kind: 'LADEN' as const, fromPort: 'DEHAM', toPort: 'SGSIN' }],
    speedOrders: [
      { id: uid('so'), name: 'Eco speed', minSpeedKn: 11.5, maxConsumptionMtPerDay: 31, fuelType: 'VLSFO', weatherLimit: 'BF ≤ 4, sea ≤ 3' },
      { id: uid('so'), name: 'Full speed', minSpeedKn: 13.5, maxConsumptionMtPerDay: 44, fuelType: 'VLSFO', weatherLimit: 'BF ≤ 5, sea ≤ 4' },
    ],
    sent: true,
  };
  const ecoOrder = voyage.speedOrders[0].id;
  db.voyages = [voyage];

  db.officers = [
    { id: uid('off'), role: 'Master', name: 'Capt. L. Hansen', signOn: '2026-04-28', inCharge: true },
    { id: uid('off'), role: 'Chief Engineer', name: 'C/E M. Rossi', signOn: '2026-04-28', inCharge: true },
    { id: uid('off'), role: 'Master', name: 'Capt. P. Andersen', signOn: '2026-02-02', inCharge: false },
  ];

  db.bills = [
    { id: uid('bl'), blNumber: 'BL-77120', cargoType: 'Iron ore fines', density: 2.9, quantity: 64850, loadPort: 'DEHAM', dischargePort: 'SGSIN', status: 'onboard' },
  ];

  db.agents = [
    { id: uid('ag'), company: 'Inchcape Shipping Services', address: '8 Marina View, Singapore', phone: '+65 6411 2200', servicedPorts: ['SGSIN'], roles: ['Husbandry Agent', 'Charterer/Liners Agent'] },
    { id: uid('ag'), company: 'Wilhelmsen Port Services', address: 'Van-der-Smissen-Str. 4, Hamburg', phone: '+49 40 36 14 0', servicedPorts: ['DEHAM'], roles: ['Husbandry Agent'] },
  ];

  db.schedule = [
    { id: uid('sch'), port: 'SGSIN', eta: '2026-06-05T22:00', etd: '2026-06-08T12:00', agentId: db.agents[0].id },
    { id: uid('sch'), port: 'CNSHA', eta: '2026-06-14T06:00', etd: '2026-06-17T18:00' },
  ];

  // helper to build events tersely
  let createdAt = '2026-05-12T04:30:00.000Z';
  const ev = (e: Partial<VesselEvent> & { typeId: string; timeUtc: string }): VesselEvent => ({
    id: uid('ev'),
    voyageId: voyage.id,
    timeZoneLabel: 'LT (UTC+2)',
    consumptions: [],
    fields: {},
    status: 'sent',
    createdAt,
    ...e,
  });
  const c = (fuelId: string, consumer: 'ME' | 'AE' | 'Boiler' | 'Other', amount: number, usedFor?: string) => ({ id: uid('c'), fuelId, consumer, amount, usedFor });

  db.events = [
    ev({
      typeId: 'departure', timeUtc: '2026-05-12T04:00:00.000Z', sentAt: '2026-05-12T05:00:00.000Z', reportId: 'RPT-2026-000311',
      position: { lat: 53.541, lon: 9.984 }, sogKn: 7.5, stwKn: 7.6, distanceNm: 12, steamingHours: 1.6, avgRpm: 42,
      weather: { windForceBft: 3, windDir: 'SW', seaState: 2, airTempC: 14, seaTempC: 12 },
      machinery: { meHours: 1.6, aeHours: 1.6, boilerHours: 1.6 },
      consumptions: [c(mgo.id, 'ME', 1.9, 'Maneuvering'), c(mgo.id, 'AE', 1.0), c(mgo.id, 'Boiler', 0.4, 'Cargo heating')],
      fields: { port: 'DEHAM', pilots: 'Elbe & harbour pilot', tugs: '2 × 60 t' },
    }),
    ev({
      typeId: 'bosp', timeUtc: '2026-05-12T08:30:00.000Z', sentAt: '2026-05-12T09:10:00.000Z', reportId: 'RPT-2026-000312',
      position: { lat: 53.889, lon: 8.717 }, sogKn: 11.8, stwKn: 12.0, distanceNm: 31, steamingHours: 4.5, avgRpm: 78,
      weather: { windForceBft: 4, windDir: 'W', seaState: 3, airTempC: 13, seaTempC: 12 },
      machinery: { meHours: 4.5, aeHours: 4.5, boilerHours: 1.0 },
      consumptions: [c(mgo.id, 'ME', 2.6, 'Maneuvering'), c(mgo.id, 'AE', 0.8)],
    }),
    ev({
      typeId: 'enter_special_area', timeUtc: '2026-05-12T09:00:00.000Z', sentAt: '2026-05-12T09:30:00.000Z', reportId: 'RPT-2026-000313',
      position: { lat: 53.99, lon: 8.40 }, consumptionsSkipped: true,
      fields: { special_area: 'ECA (SOx)' },
    }),
    ev({
      typeId: 'noon_sea', timeUtc: '2026-05-13T10:00:00.000Z', sentAt: '2026-05-13T10:40:00.000Z', reportId: 'RPT-2026-000314',
      position: { lat: 51.10, lon: 1.62 }, sogKn: 12.4, stwKn: 12.7, distanceNm: 298, engineDistanceNm: 307, steamingHours: 24, avgRpm: 79,
      weather: { windForceBft: 5, windDir: 'WSW', seaState: 4, airTempC: 12, seaTempC: 11 },
      machinery: { meHours: 24, aeHours: 24, boilerHours: 2 },
      consumptions: [c(mgo.id, 'ME', 21.8, 'Propulsion'), c(mgo.id, 'AE', 3.1), c(mgo.id, 'Boiler', 0.6)],
      fields: { speed_order: ecoOrder },
    }),
    ev({
      typeId: 'noon_sea', timeUtc: '2026-05-14T10:00:00.000Z', sentAt: '2026-05-14T10:35:00.000Z', reportId: 'RPT-2026-000315',
      position: { lat: 48.45, lon: -5.10 }, sogKn: 12.6, stwKn: 12.9, distanceNm: 305, engineDistanceNm: 314, steamingHours: 24, avgRpm: 80,
      weather: { windForceBft: 5, windDir: 'W', seaState: 4, airTempC: 13, seaTempC: 12 },
      machinery: { meHours: 24, aeHours: 24, boilerHours: 1 },
      consumptions: [c(mgo.id, 'ME', 22.1, 'Propulsion'), c(mgo.id, 'AE', 3.0)],
      fields: { speed_order: ecoOrder },
    }),
    ev({
      typeId: 'disposal_incineration', timeUtc: '2026-05-14T19:00:00.000Z', sentAt: '2026-05-14T19:20:00.000Z', reportId: 'RPT-2026-000316',
      position: { lat: 47.2, lon: -6.4 },
      fields: { garbage_part: 'I', garbage_category: 'F Operational wastes', garbage_amount: 0.6 },
    }),
    ev({
      typeId: 'leave_special_area', timeUtc: '2026-05-15T05:30:00.000Z', sentAt: '2026-05-15T06:00:00.000Z', reportId: 'RPT-2026-000317',
      position: { lat: 46.0, lon: -8.2 }, consumptionsSkipped: true,
      fields: { special_area: 'ECA (SOx)' },
    }),
    // Begin fuel changeover already done; now on VLSFO outside the ECA.
    ev({
      typeId: 'noon_sea', timeUtc: '2026-05-15T10:00:00.000Z', status: 'ready',
      position: { lat: 44.9, lon: -9.6 }, sogKn: 13.0, stwKn: 13.2, distanceNm: 312, engineDistanceNm: 321, steamingHours: 24, avgRpm: 82,
      weather: { windForceBft: 4, windDir: 'NW', seaState: 3, airTempC: 15, seaTempC: 15 },
      machinery: { meHours: 24, aeHours: 24, boilerHours: 1 },
      consumptions: [c(vlsfo.id, 'ME', 26.4, 'Propulsion'), c(vlsfo.id, 'AE', 3.4)],
      fields: { speed_order: ecoOrder },
    }),
    ev({
      typeId: 'eta_update', timeUtc: '2026-05-15T12:00:00.000Z', status: 'draft',
      position: { lat: 44.6, lon: -9.9 },
      fields: { eta_port: 'SGSIN', eta_time: '2026-06-05T20:00' },
    }),
  ];

  // Apply the running ROB so the figures reflect what was actually consumed.
  // (Seed ROB above is the *current* ROB; events are the history behind it.)

  db.archive = db.events
    .filter((e) => e.status === 'sent' && e.reportId)
    .map((e) => ({ id: e.reportId!, sentAt: e.sentAt!, eventIds: [e.id], summary: summaryFor(e) }));

  // A port log from the Hamburg loading call (port logs open on arrival/shifting).
  db.portLogs = [
    {
      id: uid('pl'),
      eventId: db.events[0].id,
      port: 'DEHAM',
      facts: [
        { id: uid('pf'), label: 'Notice of Readiness tendered', timeUtc: '2026-05-10T06:00:00.000Z' },
        { id: uid('pf'), label: 'Loading commenced', timeUtc: '2026-05-10T14:20:00.000Z' },
        { id: uid('pf'), label: 'Draft survey completed', timeUtc: '2026-05-11T22:10:00.000Z' },
      ],
      delays: [
        { id: uid('pd'), reason: 'Awaiting berth congestion', fromUtc: '2026-05-10T06:00:00.000Z', toUtc: '2026-05-10T11:30:00.000Z', remarks: 'Berth occupied by previous vessel' },
      ],
      remarks: 'Loaded 64,850 mt iron ore fines, 2 holds trimmed. All fast 09 May 22:40 LT.',
    },
  ];

  return db;
}

function summaryFor(e: VesselEvent): string {
  const names: Record<string, string> = {
    departure: 'Departure Hamburg', bosp: 'Begin of Sea Passage', enter_special_area: 'Entering ECA (SOx)',
    noon_sea: 'Noon at Sea', disposal_incineration: 'Garbage disposal (incineration)', leave_special_area: 'Leaving ECA (SOx)',
  };
  return names[e.typeId] ?? e.typeId;
}
