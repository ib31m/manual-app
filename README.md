# ⚓ s-Log Recorder — Onboard Voyage & Emissions Log

A working web application built **from two maritime software manuals**:

| Manual | Product | Role in this app |
|--------|---------|------------------|
| `Performance_usermanual_Lite_installation_CSM.PDF` | **Performance Lite** (Oceanly) | The **activation / login / access** gateway (token activation, set password, *Forgot Password → PUK*, reset installation, offline + synchronise). |
| `UserManual_stormgeo.pdf` | **s-Insight \| Log Recorder** (StormGeo) | The **onboard reporting application** (voyages, events, cargo, officers, fuels, garbage record book, outbox, settings). |

Both manuals describe **offline-first onboard maritime reporting software** that
stores data locally and synchronises event reports to a shore server. This
project unifies them into a single, modern, offline-capable web app.

> A full requirements extraction (with manual section references) is in
> **[`SPECIFICATION.md`](./SPECIFICATION.md)**.

---

## Quick start

```bash
npm install
npm run dev
# open the printed URL (default http://localhost:5173)
```

Other scripts:

```bash
npm run build      # type-check + production build into dist/
npm run preview    # serve the production build
npm test           # run the domain + render smoke tests (15 checks)
npm run typecheck  # TypeScript only
```

Requirements: **Node 18+** (developed on Node 22). No database, backend or API
keys — the app runs entirely in the browser and persists to `localStorage`,
mirroring the "offline onboard installation" described in the manuals.

---

## Demo walkthrough (2 minutes)

1. **Activate the vessel.** On first run you land on the activation screen
   (*Performance Lite §2.1*). Enter a demo token:
   - `OCEANLY-DEMO-2026` → *MV Nordic Voyager* (bulk carrier), or
   - `STORMGEO-TANKER-01` → *MT Aurora Spirit* (tanker — unlocks Cargo).

   An invalid token is rejected (try `nope`).
2. **Set a password.** Live strength rules are enforced (≥10 chars, upper,
   lower, number, special — *s-Insight §2.2*). Example: `Voyage2026!`.
3. **Initialize.** Click **"Start with demo voyage data"** to load a seeded
   voyage, fuels, officers and events — or **"Set up manually"** to walk the
   wizard (*s-Insight §2.3*).
4. **Explore the app:**
   - **Events** → file a new event. The picker only offers events that match
     the current **voyage state**; use **"Show more…"** for out-of-sequence
     events. Open the editor to see **time/zone (LT⇄UTC)**, **consumptions +
     Check ROB**, **weather**, and the live **red / blue / green** check panel.
   - **Voyages** → create Round / One-way / Idle voyages with stages and speed
     orders.
   - **Communication** → **Send all** is disabled until every event is
     error-free; sent reports get an archive ID and can be re-sent.
   - **Reports** → the **Garbage Record Book** (Part I / II) and **Log
     Abstract**, both exportable to Excel (CSV).
   - **Settings** → data export, backup/restore, allow-deletion, config import.
5. **Forgot password / Reset installation** are on the login screen (log out
   from the sidebar). The PUK is shown on screen (simulated support e-mail).

To start over completely: **Log out → Reset installation**, or clear the
browser's `localStorage` for the site.

---

## Features implemented (mapped to the manuals)

### Access layer — *Performance Lite*
- ✅ Token activation with server-side validation; connectivity-at-first-run framing
- ✅ Set password + **strong-password rules** + "remember password" (30-day expiry)
- ✅ **Login**, **Forgot Password → PUK → new password**
- ✅ **Reset of installation** (clears local data; new-token framing)
- ✅ **Offline-first** operation + **Synchronize/Send all**; upgrade-available indicator

### Reporting app — *s-Insight | Log Recorder*
- ✅ **Configuration import** by IMO; **Initialization wizard**
- ✅ Navigation: Overview, Voyages, Schedule, Agents, Events, Officers, Cargo\*, Reports, Communication, Settings (\* cargo ship types only)
- ✅ **Events**: full event catalogue (Voyage / Special / Operational, §5), **sequence-aware** picker with "Show more…", time + **LT/UTC** entry, position, weather (with the Performance-Snapshot "current weather" exception), **consumptions** with **Check ROB**, **drafts**, edit/delete, **Value-check** column
- ✅ **Validation engine** with manual's three severities — **red (error, blocks send) / blue (warning) / green (info)** — covering required fields, negative ROB, fuel-without-spec, deviation reasons, off-hire fields, fuel-sludge ≤ 2 %, consumption-rate sanity, voyage/port consistency
- ✅ **Fuel ledger**: fossil + biofuel + blend catalogue, sulphur categories (HS/VLS/ULS), **bunkering** creates fuel parcels, **sounding correction**, transactional ROB on create/edit/delete
- ✅ **Voyages**: Round / One-way / Idle, stages (BALLAST/LADEN, E/W/S/N), **speed orders**; delete only the latest unsent voyage
- ✅ **Cargo**: Bills of Lading with density, status, total mass onboard
- ✅ **Officers**: Master / Chief Engineer with auto "In charge" by sign-on date
- ✅ **Schedule & Agents**: port calls (ETA/ETD), agents with roles & serviced ports; CSV export
- ✅ **Garbage Record Book** (MARPOL Annex V Part I/II) derived from disposal events; **Log Abstract**; Excel/CSV export
- ✅ **Communication / Outbox**: error-gated **Send all**, **Archive** with report IDs + **re-send**
- ✅ **Settings**: data-export config, default noon time, allow-deletion (verbal confirm), **backup/restore**, config import/upgrade

See **[`SPECIFICATION.md`](./SPECIFICATION.md)** §"Assumptions" and §"Out of
scope" for what is simulated (shore server, e-mail, native installer) and what
is intentionally onshore (CII rating, MRV aggregation).

---

## Project structure

```
manual-app/
├── README.md                 # this file
├── SPECIFICATION.md          # requirements extracted from the manuals
├── index.html
├── package.json
├── vite.config.ts / tsconfig.json
├── scripts/                  # smoke tests + runner (npm test)
└── src/
    ├── main.tsx, App.tsx
    ├── styles/global.css     # design system
    ├── data/                 # catalogs from the manuals
    │   ├── fuels.ts          #   fossil/biofuel grades, sulphur categories
    │   ├── eventTypes.ts     #   full event catalogue + sequence rules
    │   ├── ports.ts          #   sample UN/LOCODE port DB
    │   └── seed.ts           #   demo + empty databases
    ├── domain/               # pure business logic (unit-tested)
    │   ├── types.ts
    │   ├── auth.ts           #   password rules, remember-expiry
    │   ├── sequence.ts       #   voyage-state derivation
    │   ├── validation.ts     #   red/blue/green check engine
    │   └── fuelLedger.ts     #   ROB commit/reverse/baseline
    ├── server/mockServer.ts  # simulated shore server (tokens, PUK, sync)
    ├── store/                # localStorage persistence + React context
    ├── components/common/    # Modal, Confirm, form fields
    └── pages/                # one file per screen (auth/, Events, EventEditor, …)
```

## Architecture notes
- **Offline-first by design.** The whole app is a client-side SPA; the
  "onboard database" is `localStorage` and the shore **Server** is an in-browser
  simulation (`src/server/mockServer.ts`). This matches the manuals' offline +
  synchronise model and keeps the project trivial to run.
- **Pure domain core.** Auth, validation, sequence and the fuel ledger are
  framework-free modules so they can be tested directly (see `npm test`).
- **No runtime dependencies beyond React.** Excel export is CSV (opens in Excel)
  to avoid native libraries.

## Testing
`npm test` bundles two smoke suites with esbuild and runs them under Node:
- **domain** (13 checks): password rules, sulphur categories, activation/PUK,
  voyage-state derivation, validation (negative ROB blocks send, required
  reasons), and the fuel ledger (bunkering, consumption, edit re-diff, delete
  reversal, Check-ROB preview).
- **render** (2 checks): the React tree mounts to the Activation screen on a
  fresh boot and to the app shell when activated + remembered + initialized.
