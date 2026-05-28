import type { OnboardDB, VesselConfig } from '../domain/types';
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
    archive: [],
  };
}

/**
 * Seed/demo database — gives the user something to explore immediately
 * (instructions #10). One vessel, two fuels, one voyage, officers, a bill of
 * lading, an agent, a schedule and a few events (some sent, some unsent).
 */
export function seedDB(config: VesselConfig): OnboardDB {
  const db = emptyDB(config);
  db.initialized = true;

  const hfo = {
    id: uid('fuel'),
    gradeId: 'RMG380',
    label: 'HFO RMG380 (VLS)',
    sulphurPct: 0.45,
    sulphurCategory: sulphurCategory(0.45),
    rob: 980,
    bdn: 'BDN-2026-0012',
  };
  const mgo = {
    id: uid('fuel'),
    gradeId: 'DMA',
    label: 'MGO DMA (ULS)',
    sulphurPct: 0.08,
    sulphurCategory: sulphurCategory(0.08),
    rob: 210,
    bdn: 'BDN-2026-0013',
  };
  db.fuels = [hfo, mgo];

  const voyage = {
    id: uid('voy'),
    voyageNo: '2026-014',
    service: 'Europe – Far East',
    type: 'One way' as const,
    departurePort: 'DEHAM',
    arrivalPort: 'SGSIN',
    departureTime: '2026-05-20T06:00:00.000Z',
    arrivalTime: '2026-06-10T08:00:00.000Z',
    stages: [{ id: uid('stg'), kind: 'LADEN' as const, fromPort: 'DEHAM', toPort: 'SGSIN' }],
    speedOrders: [
      {
        id: uid('so'),
        name: 'Eco speed',
        minSpeedKn: 11,
        maxConsumptionMtPerDay: 26,
        fuelType: 'HFO',
        weatherLimit: 'BF ≤ 4, sea ≤ 3',
      },
    ],
    sent: true,
  };
  db.voyages = [voyage];

  db.officers = [
    { id: uid('off'), role: 'Master', name: 'Capt. L. Hansen', signOn: '2026-04-28', inCharge: true },
    { id: uid('off'), role: 'Chief Engineer', name: 'C/E M. Rossi', signOn: '2026-04-28', inCharge: true },
  ];

  db.bills = [
    {
      id: uid('bl'),
      blNumber: 'BL-77120',
      cargoType: 'Iron ore',
      density: 2.1,
      quantity: 64000,
      loadPort: 'DEHAM',
      dischargePort: 'SGSIN',
      status: 'onboard',
    },
  ];

  db.agents = [
    {
      id: uid('ag'),
      company: 'Marlink Port Services',
      address: '12 Harbour Rd, Singapore',
      phone: '+65 6123 4567',
      servicedPorts: ['SGSIN'],
      roles: ['Husbandry Agent'],
    },
  ];

  db.schedule = [
    { id: uid('sch'), port: 'SGSIN', eta: '2026-06-10T08:00', etd: '2026-06-12T18:00', agentId: db.agents[0].id },
    { id: uid('sch'), port: 'CNSHA', eta: '2026-06-18T06:00', etd: '2026-06-20T20:00' },
  ];

  // A small event timeline. Departure + BOSP are "sent"; the noon is unsent.
  db.events = [
    {
      id: uid('ev'),
      typeId: 'departure',
      voyageId: voyage.id,
      timeUtc: '2026-05-20T06:00:00.000Z',
      timeZoneLabel: 'LT (UTC+2)',
      position: { lat: 53.54, lon: 9.98 },
      sogKn: 8,
      stwKn: 8,
      weather: { windForceBft: 3, windDir: 'SW', seaState: 2, airTempC: 16, seaTempC: 14 },
      consumptions: [
        { id: uid('c'), fuelId: mgo.id, consumer: 'ME', amount: 2.4 },
        { id: uid('c'), fuelId: mgo.id, consumer: 'AE', amount: 1.1 },
      ],
      fields: { port: 'DEHAM' },
      status: 'sent',
      createdAt: '2026-05-20T06:30:00.000Z',
      sentAt: '2026-05-20T07:00:00.000Z',
      reportId: 'RPT-2026-000101',
    },
    {
      id: uid('ev'),
      typeId: 'bosp',
      voyageId: voyage.id,
      timeUtc: '2026-05-20T11:00:00.000Z',
      timeZoneLabel: 'LT (UTC+2)',
      position: { lat: 54.0, lon: 8.2 },
      sogKn: 12.5,
      stwKn: 12.8,
      weather: { windForceBft: 4, windDir: 'W', seaState: 3, airTempC: 15, seaTempC: 14 },
      consumptions: [
        { id: uid('c'), fuelId: mgo.id, consumer: 'ME', amount: 3.2 },
        { id: uid('c'), fuelId: mgo.id, consumer: 'AE', amount: 0.9 },
      ],
      fields: {},
      status: 'sent',
      createdAt: '2026-05-20T11:30:00.000Z',
      sentAt: '2026-05-20T12:00:00.000Z',
      reportId: 'RPT-2026-000102',
    },
    {
      id: uid('ev'),
      typeId: 'noon_sea',
      voyageId: voyage.id,
      timeUtc: '2026-05-21T10:00:00.000Z',
      timeZoneLabel: 'LT (UTC+2)',
      position: { lat: 51.4, lon: 2.1 },
      sogKn: 13.1,
      stwKn: 13.0,
      weather: { windForceBft: 5, windDir: 'NW', seaState: 3, airTempC: 14, seaTempC: 13 },
      consumptions: [
        { id: uid('c'), fuelId: hfo.id, consumer: 'ME', amount: 24.5 },
        { id: uid('c'), fuelId: hfo.id, consumer: 'AE', amount: 3.8 },
      ],
      fields: {},
      status: 'ready',
      createdAt: '2026-05-21T10:30:00.000Z',
    },
  ];

  db.archive = [
    { id: 'RPT-2026-000101', sentAt: '2026-05-20T07:00:00.000Z', eventIds: [db.events[0].id], summary: 'Departure DEHAM' },
    { id: 'RPT-2026-000102', sentAt: '2026-05-20T12:00:00.000Z', eventIds: [db.events[1].id], summary: 'BOSP' },
  ];

  return db;
}
