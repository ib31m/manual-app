# Specification & Requirements Summary

This document is the requirements summary extracted **directly from the two
supplied manuals**, written before implementation. It is the contract the
application is built against.

Source manuals:

1. **Performance Lite — Installation User Manual** (Oceanly S.r.l.) — an
   installation / activation / access guide for a maritime vessel
   performance‑reporting app.
2. **s‑Insight | Log Recorder — User Manual, Release 2.12.0** (StormGeo) — the
   onboard component that records fleet‑wide voyage and emission‑relevant data.

Both describe **maritime onboard reporting software** that runs on a ship PC,
works **offline**, stores data in a **local database**, and **synchronises**
event reports to a shore **Server** when a connection is available. They are
two halves of the same product domain, so this project unifies them:

* **Manual 1** → the **Activation / Login / Access** layer (gateway).
* **Manual 2** → the **main reporting application** behind the login.

---

## 1. Activation & Access (from Manual 1, reinforced by Manual 2 §2)

| # | Requirement | Source |
|---|-------------|--------|
| A1 | Ship is provisioned with a **URL + unique activation token**. First run needs connectivity. | M1 §2.1 |
| A2 | Activation flow: open URL → **insert token** → **set a password** → "remember the password" → login → start reporting. | M1 §2.1 |
| A3 | **One app and one user per vessel.** | M1 §1.2.1 |
| A4 | **Standalone / offline** operation: app runs without connection; reports are sent later with **Synchronize**. | M1 §2.2, §2.1 |
| A5 | **Forgot Password** → email support → receive a **PUK** → enter PUK → set new password. | M1 §2.3 |
| A6 | **Reset of installation**: new token issued → re‑activate. | M1 §2.4 |
| A7 | **Upgrade**: on next access the system offers to install a new version. | M1 §2.5 |
| A8 | **Login** with password; **"Remember password"** stores it (auto‑cleared after **30 days** of inactivity). | M2 §2.2 |
| A9 | **Strong password**: ≥ 10 chars, upper + lower case, number, special char. | M2 §2.2 |
| A10 | **Import configuration** identifies the vessel by **IMO number**; server returns password + config; "Configuration files that were not requested cannot be imported." | M2 §2.1 |
| A11 | **Initialization wizard**: state current fuels, consumables, cargo, officer names and vessel position; Next / Clear / navigation. | M2 §2.3 |

## 2. Navigation / Screens (Manual 2 §3.1)

Menu pages: **Voyages, Schedule, Agents, Events, Port logs\*, Officers,
Cargo\*, Reports, Communication (Outbox), Settings**
(\* only for tankers, bulk carriers, LNG carriers, gas carriers).

## 3. Events — the core (Manual 2 §3.3, §5)

**Categories & types**

* **Voyage events:** Arrival; Begin/End Shifting Berth; Sailing notice;
  Departure; Begin/End Canal passage; BOSP / EOSP; Begin/End Anchoring‑Drifting;
  Noon (Position) — *Sea Passage / River / Port / Stoppage*; ETA update.
* **Special events:** Begin/End fuel changeover; Change destination port;
  Begin/End deviation; Entering/Leaving special area; Other event; Oil spill;
  Inventory; Cargo condition; Performance Snapshot; Begin/End off‑hire.
* **Operational events:** Bunkering / Fuel mixing / De‑bunkering; Sounding
  correction; Ballast water (source/exchange/discharge/transfer); Disposal
  events; VOC release; Maintenance; Fuel Lab Analysis Report.

**Filing workflow** (§3.3): pick an event that matches the **reporting
sequence** (others hidden behind "Show more…"); enter **time + time zone**
with an **LT/UTC** toggle and a **timeline** showing placement; fill details
(recipients, copy buttons, calculator buttons, *"Consumptions intentionally
not reported"* checkbox, **Check ROB**, weather as prevailing since last
event — except Performance Snapshot which uses current weather); **Check**
then **Save** or **Save as draft**.

**Validation severities** (§3.3):
* **Red = error** → blocks sending.
* **Blue = warning** → should be reviewed, can still send.
* **Green = info** → no effect on plausibility.
The **Events overview** has a **Value check** column reflecting this.

**Reporting sequence / voyage states** (§3.2, §5): Port, Departure,
River/Canal, Sea Passage, Stoppage, Deviation. New events are offered only when
consistent with the latest event.

**Drafts** (§3.12): "Save as draft"; following events ignore drafts for
duration calculations. **Modify/Delete** (§3.13): edit re‑runs checks;
events can be deleted only while **unsent** (post‑send deletion needs an
onshore‑enabled flag + verbal confirmation).

## 4. Voyages (Manual 2 §3.15)

* Fields: **Voyage no** (operator format, required), **Service/Trade**,
  **Voyage type** = Round / One‑way / Idle, **stages**, optional **turning
  (turn) port** for round voyages.
* **Stage logic:** BALLAST/LADEN (cargo) or E/W/S/N (directional).
* **Speed orders:** name, min speed, max consumption per fuel/day, weather
  conditions; selectable on sea‑passage events.
* Delete only the **latest unsent** voyage; never the only voyage.
* Every event must belong to a voyage or it cannot be sent.

## 5. Cargo & Port logs (Manual 2 §3.4–3.6)

Bills of Lading + cargo details with **density**; loading/unloading operations;
**total mass onboard** via calculator; "No change of cargo" with reason. Port
logs: port facts, delays + reasons, loading/unloading, remarks.

## 6. Fuels (Manual 2 §3.10)

* **Sulphur categories:** HS > 0.5 %, VLS 0.1–0.5 %, ULS ≤ 0.1 %.
* **Fossil grades:** LFO (RMA10/20, RMB30, RMD80), HFO (RME180…RMK700),
  MDO/MGO (DMX/DMZ/DMB/DMA/DMC), Gaseous (LNG, Ethane, LPG, Hydrogen, Ammonia),
  Alcohol (Ethanol, Methanol).
* **Biofuels** with raw material + default LHV: Bio‑diesel (37), HVO (44),
  Bio‑methanol (20), Bio‑ethanol (27), Bio‑LNG (50), Bio‑hydrogen (120).
* **Blend** type (fossil + biofuel). Bunkering / Fuel mixing / De‑bunkering.
  A fuel cannot be consumed until type, sulphur and mass are specified.

## 7. Officers (Manual 2 §3.14)

Master / Chief Engineer list with **sign‑on date** and **"In charge"** flag
(auto‑set by latest sign‑on); always add new rows, never overwrite.

## 8. Schedule & Agents (Manual 2 §3.16)

Schedule: per port call **port + ETA** (time zone once). Agents: company,
address, phones, serviced ports; roles = Husbandry / Charterer‑Liners / Cargo
owner / Other.

## 9. Reports (Manual 2 §3.17, §4.1)

* **Garbage Record Book** — Part I (all garbage) + Part II (cargo residues),
  exceptional discharge table; **Excel/CSV export**.
* **Log Abstract** — one row per event (Excel/CSV export).

## 10. Off‑hire (Manual 2 §3.18)

Begin/End off‑hire with time, position, consumption, running hours, one or more
**reasons**, **percentage**, **mode** (scheduled/unscheduled). Following events
flagged until the period ends.

## 11. Communication / Sending (Manual 2 §3.19, §4.3, §4.5)

**Outbox** lists unsent events; **Send all** is enabled only when **error‑free**
(blue warnings allowed). Sent reports go to an **Archive** with an **ID** and
can be **re‑sent**. Invalid events stay in the outbox (reporting gaps).

## 12. Settings (Manual 2 §3.19, §4.4, §4.7, §7)

Import configuration; data‑export config (required before sending); default
**noon time**; enable "include details of invalid events"; enable event
deletion; **manual/automatic backup + restore**; vessel/ship‑type info.

---

## Assumptions (documented per instruction #4)

1. **The two manuals are unified into one product.** Manual 1 is the
   activation/login gateway; Manual 2 is the application. This is the only
   reading that makes both coherent (both are offline maritime reporting tools
   with token/password access and shore sync).
2. **No real backend.** The manuals describe a shore *Server* reachable by
   e‑mail/connection. We simulate it with an in‑browser **mock server**
   (activation tokens, config import, report sync, PUK issuance). The onboard
   "local database" is the browser's **localStorage**, matching the offline‑first
   behaviour described.
3. **Representative breadth, full depth on the core.** Every screen and the
   complete event catalogue from the manuals are present. Event *detail forms*
   implement a faithful, representative field set (time/zone, position, weather,
   consumptions + Check ROB, event‑specific fields) rather than reproducing
   every one of the hundreds of fields shown only in screenshots, which the
   text does not enumerate.
4. **Calculations shown explicitly in the manual are implemented**: ROB =
   previous ROB − consumption ± bunkering/correction; total mass onboard;
   duration between events; off‑hire totals; sulphur categorisation; password
   strength. Analytics that the manual states happen *onshore* (CII rating, MRV
   aggregation, performance analytics) are out of scope for the onboard app.
5. **Excel export** is delivered as **CSV** (opens in Excel) to keep the project
   dependency‑light and runnable with no native libraries.
6. Sample seed data (one vessel, fuels, a voyage, officers, a few events) is
   provided so the app is testable immediately.

## Out of scope (stated as onshore / server‑side in the manuals)

Native desktop installer & auto‑upgrade binaries; real e‑mail transport; CII
*rating* computation; MRV/ETS/DCS aggregation; multi‑PC network data‑path
sharing; the shore **Server** UI. These are represented by simulations or
clearly marked as onshore functions.
