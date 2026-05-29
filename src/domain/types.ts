// Core domain types for the onboard Log Recorder.
// Terminology and structures follow the s-Insight | Log Recorder manual.

export type ShipType =
  | 'Tanker'
  | 'Bulk carrier'
  | 'LNG carrier'
  | 'Gas carrier'
  | 'Container'
  | 'ConRo'
  | 'General cargo'
  | 'Passenger';

/** Ship types for which Cargo + Port log pages are visible (manual §3.1). */
export const CARGO_SHIP_TYPES: ShipType[] = [
  'Tanker',
  'Bulk carrier',
  'LNG carrier',
  'Gas carrier',
];

/** Voyage state derived from the latest event (manual §3.2, §5). */
export type VoyageState =
  | 'Port'
  | 'Departure'
  | 'River/Canal'
  | 'Sea Passage'
  | 'Stoppage'
  | 'Deviation';

export type EventCategory = 'Voyage' | 'Special' | 'Operational';

export interface EventTypeDef {
  id: string;
  name: string;
  category: EventCategory;
  /** Voyage state this event results in, if it changes the state. */
  resultState?: VoyageState;
  /** Voyage states from which this event is a "natural" next step (sequence). */
  allowedAfter?: VoyageState[];
  /** Whether the event records fuel/machinery consumptions. */
  hasConsumptions?: boolean;
  /** Whether the event records vessel position. */
  hasPosition?: boolean;
  /** Whether the event records weather. */
  hasWeather?: boolean;
  /** Whether sailed distance / steaming time can be reported. */
  hasDistance?: boolean;
  /** Whether machinery running hours can be reported. */
  hasMachinery?: boolean;
  /** Short helper text taken from the manual. */
  description: string;
}

export type FuelClass = 'Fossil' | 'Biofuel' | 'Blend';
export type SulphurCategory = 'HS' | 'VLS' | 'ULS';

export interface FuelGradeDef {
  id: string;
  fuelClass: FuelClass;
  category: string; // LFO / HFO / MDO/MGO / Gaseous / Alcohol / Bio-diesel / HVO ...
  type: string; // RMG380, DMA, LNG, FAME ...
  defaultLhv?: number; // MJ/kg
}

/** A fuel actually present onboard (a tank/parcel created by bunkering/init). */
export interface FuelOnboard {
  id: string;
  gradeId: string;
  label: string;
  sulphurPct: number;
  sulphurCategory: SulphurCategory;
  rob: number; // remaining on board, metric tonnes
  bdn?: string;
  lhv?: number;
}

export interface ConsumptionLine {
  id: string;
  fuelId: string;
  consumer: 'ME' | 'AE' | 'Boiler' | 'Other';
  amount: number; // mt since last event
  usedFor?: string; // consumption breakdown (manual §3.8)
}

/** Machinery operations / running hours since last event (manual §3.3, §3.11). */
export interface MachineryHours {
  meHours?: number; // main engine
  aeHours?: number; // aux engines (combined)
  boilerHours?: number;
  opsHours?: number; // onshore power supply (manual §3.11)
  scrubberHours?: number; // §3.10
}

/** Instantaneous engine/propulsion data for the Performance Snapshot (§3.7). */
export interface PerformanceData {
  meRpm?: number;
  mePowerKw?: number; // M/E shaft power
  propPowerKw?: number; // propulsion power (per train, simplified to one)
  meSfocGkwh?: number; // specific fuel oil consumption
  scavAirPressBar?: number;
  aeLoadKw?: number;
  seaTempC?: number; // for ISO correction
}

export interface Weather {
  windForceBft?: number; // Beaufort
  windDir?: string;
  seaState?: number; // Douglas
  swellDir?: string;
  airTempC?: number;
  seaTempC?: number;
}

export interface Position {
  lat?: number; // decimal degrees, + N / - S
  lon?: number; // decimal degrees, + E / - W
}

export type EventStatus = 'draft' | 'ready' | 'sent';

export interface VesselEvent {
  id: string;
  typeId: string;
  voyageId: string;
  /** ISO timestamp of the event (stored in UTC). */
  timeUtc: string;
  /** IANA-ish offset label the user entered in, e.g. "LT (UTC+2)" or "UTC". */
  timeZoneLabel: string;
  position?: Position;
  sogKn?: number; // speed over ground
  stwKn?: number; // speed through water
  distanceNm?: number; // sailed (observed) distance since last event
  engineDistanceNm?: number; // engine distance (for slip)
  steamingHours?: number; // steaming time since last event
  avgRpm?: number;
  weather?: Weather;
  /** Machinery running hours since last event. */
  machinery?: MachineryHours;
  /** Instantaneous engine data (Performance Snapshot only). */
  performance?: PerformanceData;
  /** Consumptions are intentionally not reported in this event (manual §3.3). */
  consumptionsSkipped?: boolean;
  consumptions: ConsumptionLine[];
  /** Free-form, event-type-specific fields (port, reasons, draughts, etc.). */
  fields: Record<string, string | number | boolean>;
  recipients?: string;
  status: EventStatus;
  createdAt: string;
  sentAt?: string;
  reportId?: string; // assigned on send (archive ID)
}

export type VoyageType = 'Round' | 'One way' | 'Idle';
export type StageKind = 'BALLAST' | 'LADEN' | 'E' | 'W' | 'S' | 'N';

export interface VoyageStage {
  id: string;
  kind: StageKind;
  fromPort: string;
  toPort: string;
}

export interface SpeedOrder {
  id: string;
  name: string; // "Full", "Eco speed"
  minSpeedKn: number;
  maxConsumptionMtPerDay: number;
  fuelType: string;
  weatherLimit: string;
}

export interface Voyage {
  id: string;
  voyageNo: string;
  service: string;
  type: VoyageType;
  departurePort: string;
  arrivalPort: string;
  turnPort?: string;
  departureTime?: string;
  arrivalTime?: string;
  stages: VoyageStage[];
  speedOrders: SpeedOrder[];
  sent: boolean;
}

export interface Officer {
  id: string;
  role: 'Master' | 'Chief Engineer';
  name: string;
  signOn: string; // date
  inCharge: boolean;
}

export interface BillOfLading {
  id: string;
  blNumber: string;
  cargoType: string;
  specificType?: string;
  density: number; // t/m3
  quantity: number; // mt
  loadPort: string;
  dischargePort: string;
  status: 'loading' | 'onboard' | 'discharged';
}

export interface Agent {
  id: string;
  company: string;
  address: string;
  phone: string;
  servicedPorts: string[];
  roles: string[]; // Husbandry / Charterer-Liners / Cargo owner / Other
}

export interface ScheduleEntry {
  id: string;
  port: string;
  eta: string;
  etd: string;
  agentId?: string;
}

export interface GarbageEntry {
  id: string;
  part: 'I' | 'II' | 'Exceptional';
  date: string;
  category: string;
  estimatedAmount: number; // m3
  position: string;
  method: string; // incineration / ashore / overboard / barge
  remarks?: string;
}

export interface ArchivedReport {
  id: string; // report/archive ID
  sentAt: string;
  eventIds: string[];
  summary: string;
}

/** Port log auto-generated from an Arrival / End-shifting event (manual §3.5). */
export interface PortFact {
  id: string;
  label: string; // e.g. "Notice of Readiness tendered", "Cargo tank survey"
  timeUtc: string;
}
export interface PortDelay {
  id: string;
  reason: string;
  fromUtc: string;
  toUtc: string;
  remarks?: string;
}
export interface PortLogEntry {
  id: string;
  eventId: string; // the arrival / end-shifting event that opened the port log
  port: string;
  facts: PortFact[];
  delays: PortDelay[];
  remarks: string;
}

export interface VesselConfig {
  vesselName: string;
  imo: string;
  shipType: ShipType;
  callSign: string;
  flag: string;
  configVersion: string;
}

export interface Settings {
  defaultNoonTime: string; // "12:00"
  includeInvalidEventDetails: boolean;
  allowEventDeletion: boolean;
  autoBackup: boolean;
  exportConfigured: boolean;
  exportEmail: string;
  rememberPassword: boolean;
}

/** Persisted onboard database (the "local data path" of the manual). */
export interface OnboardDB {
  config: VesselConfig;
  settings: Settings;
  initialized: boolean;
  fuels: FuelOnboard[];
  voyages: Voyage[];
  events: VesselEvent[];
  officers: Officer[];
  bills: BillOfLading[];
  agents: Agent[];
  schedule: ScheduleEntry[];
  garbage: GarbageEntry[];
  portLogs: PortLogEntry[];
  archive: ArchivedReport[];
  lastBackup?: string;
}
