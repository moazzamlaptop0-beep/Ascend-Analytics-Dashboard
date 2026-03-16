# Ascend Analytics Dashboard - Technical Documentation and Briefing Guide

Document purpose: provide a manager-ready briefing of what the system does, how it is built, and how data accuracy is enforced.

## 1. Project Overview

### What this project is

Ascend Analytics Dashboard is a React + .NET analytics portal for IVR call-center operations. It combines executive KPI cards, trend visualizations, and an operations data table for auditing individual calls.

### Business problem it solves

Operations teams need a single place to monitor call performance, workflow outcomes, and transcription infrastructure health. Without this, teams rely on ad-hoc SQL checks and disconnected reports, which slows incident response and process improvement.

### What the dashboard measures

The dashboard tracks 17 metrics across three domains:

- Telephony (M1-M7)
- Workflow (M8-M12)
- Infrastructure (M13-M17)

### Intended users

- Operations managers
- QA and process-improvement leads
- Technical leads and engineering managers
- Analysts validating IVR performance and backlog risk

### Main capabilities

- Near-real-time KPI monitoring
- Global filtering by date, insurance, practice, DNIS, call type
- Metric-specific charts (line, heatmap, funnel, bars, gauge-like visuals)
- Operations log table with sorting, search, pagination, CSV export
- DB outage visibility via health checks and UI alerting
- Machine-readable metric definition catalog via API

Current note:

- Call type appears in the UI filter model, but backend filtering is primarily implemented for date, insurance, practice, and DNIS in current endpoints.

## 2. System Architecture

### Stack summary

- Frontend: React 19, Vite 7, TanStack Query, TanStack Table, Nivo charting
- Backend: ASP.NET Core (.NET 10), Dapper
- Database: SQL Server IVR2

### Data flow pipeline

1. SQL Server stores source records in outboundmaster, outboundmaster_detail, cdrmaster, and lookup tables.
2. .NET API computes metric aggregates and percentiles using SQL.
3. Frontend requests API endpoints and renders display-only transformations.
4. UI refreshes selected real-time metrics on intervals.

Pipeline: SQL Database -> Backend API -> Frontend Dashboard

### Runtime topology

- Vite frontend runs on localhost:5173
- API runs on localhost:5000
- Vite proxy forwards /api and /hub to backend
- Frontend and backend are decoupled by HTTP contracts

### Folder structure overview

- src/: React app (pages, metrics components, charts, services, hooks, layouts)
- api/: ASP.NET API (controllers, services, helper, appsettings, metric definitions)
- public/: static assets
- PROJECT_DOCUMENTATION.md: this briefing document

### Major components and responsibilities

Frontend:

- src/main.jsx: React root + QueryClient + providers
- src/layouts/TopBar.jsx: global date/filter UI
- src/hooks/useDashboardData.js: per-metric query hooks
- src/services/dashboardApi.js: endpoint calling and response mapping
- src/components/metrics/\*\*: metric cards and chart rendering
- src/pages/Operations/OperationsTable.jsx: virtualized operations table

Backend:

- api/Program.cs: startup, middleware, CORS, error handling, configuration loading
- api/Controllers/DashboardController.cs: M1-M17 + metric definitions endpoints
- api/Controllers/OperationsController.cs: paginated logs and detail endpoint
- api/Controllers/HealthController.cs: API/DB health endpoint
- api/Services/DbService.cs: throttled SQL connections
- api/Helpers/FilterHelper.cs: reusable query filter construction
- api/Services/MetricDefinitionService.cs: loads metric definition catalog
- api/Definitions/metric-definitions.json: formulas, definitions, source tables

## 3. Key Metrics Implemented

This section covers the requested deep-dive metrics: M6, M10, M11, M13, M14.

### M6 - Call Duration Distribution

What it means:
Distribution of call duration (seconds) over a selected date range, including percentile points.

Why it is useful:
Shows normal call behavior and long-tail outliers. Helps detect when calls are becoming unusually long and where customer friction may be increasing.

SQL logic used:

- Source table: cdrmaster
- Uses AVG, MIN, MAX and PERCENTILE_CONT for P25, median, P75, P90, P95
- Optional join to application for insurance-level averages

API endpoint:

- GET /api/dashboard/call-duration

Frontend display:

- Card: src/components/metrics/telephony/CallDurationCard.jsx
- Summary chips for Min/P25/Median/P90/P95
- Horizontal bar chart by insurance average duration
- Uses backend formatted fields when available, with formatter fallback

### M10 - Reattempt Outcome Funnel

What it means:
Cumulative funnel of calls requiring 1+, 2+, 3+ attempts, including drop-off between attempt stages.

Why it is useful:
Quantifies retry burden and where success degrades. Useful for script tuning and workflow optimization.

SQL logic used:

- CTE pipeline:
  - filtered_calls
  - attempt_buckets (count of details per call)
  - exact_stage_counts
  - cumulative_stage_counts
  - final with LAG for drop-off
- dropOffPct is calculated in SQL and mapped to dropOffPercent in API

API endpoint:

- GET /api/dashboard/reattempt-funnel

Frontend display:

- Card: src/components/metrics/workflow/ReattemptFunnelCard.jsx
- Funnel chart with stage counts
- Annotation chips showing dropOffPercent

### M11 - First Attempt Success Rate

What it means:
Percent of calls that succeed on the first outbound detail attempt.

Why it is useful:
Primary efficiency KPI. Higher first-attempt success reduces repeat calls, queue pressure, and operational cost.

SQL logic used:

- Uses filtered_calls CTE with DISTINCT call IDs
- CROSS APPLY TOP 1 detail by od2.ID ASC to capture first attempt status
- Success statuses: S or C
- Aggregates total and firstAttemptSuccess by day for trend

API endpoint:

- GET /api/dashboard/first-attempt-rate

Frontend display:

- Card: src/components/metrics/workflow/FirstAttemptCard.jsx
- Gauge-like visualization and trend line
- Trend badge derived from current vs previous point

### M13 - Transcription Queue Length

What it means:
Current pending queue and average wait time for transcription processing.

Why it is useful:
Early warning for backlog growth and downstream processing delays.

SQL logic used:

- Filters pending records only: RTRIM(Status) = 'P'
- Rolling 30-day lookback using CallInTime >= DATEADD(day, -@lookbackDays, GETDATE())
- avgWaitSeconds from DATEDIFF_BIG(second, CallInTime, GETDATE())
- History grouped by call date for trend

API endpoint:

- GET /api/dashboard/transcription-queue

Frontend display:

- Card: src/components/metrics/infrastructure/TranscriptionQueueCard.jsx
- Current queue count, avg wait label, threshold bar, trend chart
- Uses avgWaitFormatted from backend when present

### M14 - Transcription Latency

What it means:
Latency from call end to transcription availability, including percentile profile.

Why it is useful:
Measures transcription SLA behavior and tail latency risk (P90/P95).

SQL logic used:

- Source: cdrmaster
- Computes candidate latencies across several timezone offsets
- Keeps valid values in [0, 86400] seconds
- Uses MIN valid candidate as normalized latency
- Calculates AVG, P25, median, P75, P90, P95, max

API endpoint:

- GET /api/dashboard/transcription-time

Frontend display:

- Card: src/components/metrics/infrastructure/TranscriptionLatencyCard.jsx
- Overall P90 plus vendor-style distribution bars
- Uses backend formatted fields (overallP90Formatted, p90Formatted, etc.)

## 4. Database Tables Used

### outboundmaster

Role:
Master call record and queue/transcription status.

Common columns used:

- ID
- CallDate
- CallInTime
- Status
- Remarks

Usage:

- Queue depth (M13)
- Active pending count (M5)
- Date bucketing for several metrics
- Join root for outboundmaster_detail

### outboundmaster_detail

Role:
Per-call detail/attempt records and workflow statuses.

Common columns used:

- ID
- OID (FK to outboundmaster.ID)
- Status
- PracticeCode
- IVR_Insurance (DNIS)
- UniqueIndetifier
- ClaimNo
- NoOfClaims
- Transcription

Usage:

- Core telephony and workflow metrics (M1-M3, M7-M12, M16-M17)
- First-attempt status extraction (M11)
- Reattempt funnel stages (M10)

### cdrmaster

Role:
Call detail records for duration and transcription timing.

Common columns used:

- CallDate
- Duration
- CallEndTime
- TranscribeDateTime
- AppID

Usage:

- Call duration percentiles (M6)
- Transcription latency percentiles (M14)

### Supporting tables

- outboundCallStatus: status description mapping
- application: insurance mapping via AppID for M6 by-insurance rollup

### Relationships

- outboundmaster.ID -> outboundmaster_detail.OID (one-to-many)
- cdrmaster.AppID -> application.AppID (many-to-one)
- outboundmaster_detail.Status -> outboundCallStatus.CallStatus (lookup)

## 5. API Endpoints

Requested endpoints and briefing details:

### /api/dashboard/total-calls

Purpose:
Total initiated call volume and trend over time.

Main SQL logic:

- Count detail rows grouped by CAST(om.CallDate AS DATE)
- Return total, avgDaily, trend, trendData

Example response shape:

- total
- avgDaily
- trend
- trendData[{date, value}]

### /api/dashboard/call-duration

Purpose:
Duration distribution summary and insurance averages.

Main SQL logic:

- Compute overall distribution (AVG/MIN/PERCENTILE_CONT/MAX)
- Group by insurance for averages

Example response shape:

- overall{avg, avgFormatted, p25, median, p90, p95, ...}
- byInsurance[{insurance, avg, avgFormatted, min, max, count}]

### /api/dashboard/transcription-time

Purpose:
Transcription latency percentile analysis.

Main SQL logic:

- Normalize latency with offset candidates
- Filter invalid values
- Compute overall stats and expose vendor list structure

Example response shape:

- overallAvgSeconds
- overallP90Seconds
- overallP90Formatted
- byVendor[{vendor, count, avgSeconds, p25, median, p90, p95, max, formatted fields}]

### /api/dashboard/transcription-queue

Purpose:
Current pending transcription queue and backlog trend.

Main SQL logic:

- Pending filter: RTRIM(Status) = 'P'
- 30-day lookback with CallInTime bounds
- Average wait in seconds + date-grouped history

Example response shape:

- current
- avgWaitSeconds
- avgWaitFormatted
- lookbackDays
- history[{time, value}]

## 6. Important Design Decisions

### SQL is the source of truth

Metrics are computed in SQL/Dapper on the backend, not in browser-side ad-hoc logic.
Impact: avoids drift, prevents double-interpretation, and keeps formulas centralized.

### Backend performs metric calculations

Percentages, percentiles, and aggregations are produced server-side.
Impact: one canonical logic path for all consumers.

### Frontend is display-first

Frontend focuses on presentation and minimal shape adaptation for charts.
Impact: easier to maintain and safer against formula divergence.

### Percentiles use PERCENTILE_CONT

M6 and M14 use SQL Server percentile functions.
Impact: robust distribution analytics and stable P90/P95 behavior.

### API returns formatted durations

Backend now returns numeric and human-readable labels (for example medianSeconds + medianFormatted).
Impact: consistent labels across cards and reduced client-side formatting drift.

### Queue metric uses a lookback window

M13 applies a rolling 30-day window and explicit pending filter.
Impact: avoids stale historical backlog inflating operational queue visibility.

### Configuration anchored to app base directory

Program startup loads appsettings files from AppContext.BaseDirectory.
Impact: API is resilient when DLL is launched from different working directories.

### Metric definitions are versioned artifacts

Metric metadata is stored in JSON and exposed by API.
Impact: transparent formulas, faster onboarding, safer future changes.

## 7. Bugs and Fixes Discovered During Development

### M10 field mismatch: dropOffPercent vs dropoutPercent

Issue:
Frontend previously referenced a non-canonical key in chips.

Fix:
Frontend now uses dropOffPercent from API contract.

Outcome:
Reattempt funnel annotations align with backend response.

### Synthetic frontend percentile risk

Issue:
Frontend risked deriving display values instead of honoring backend outputs.

Fix:
Frontend now prefers backend formatted percentile/duration fields for M6 and M14.

Outcome:
Display values remain contract-aligned with backend computations.

### Queue metric historical backlog inflation

Issue:
Queue averages could be skewed if older records remained in scope.

Fix:
M13 now uses explicit pending filter plus 30-day lookback and consistent bounds.

Outcome:
Operational queue KPI reflects recent backlog behavior.

### First-attempt logic duplication risk

Issue:
First-attempt calculations can be distorted if call rows are duplicated through joins.

Fix:
M11 uses DISTINCT filtered calls and selects first detail record via CROSS APPLY TOP 1 ordered by ID.

Outcome:
First-attempt success rate is closer to true call-level first-touch behavior.

### API runtime configuration sensitivity

Issue:
Running the DLL from incorrect working directory previously caused missing appsettings behavior.

Fix:
Program.cs now sets configuration base path to AppContext.BaseDirectory.

Outcome:
Consistent startup behavior regardless launch directory.

## 8. Data Validation Process

Validation pipeline used for metric confidence:

1. Run direct SQL checks against IVR2 for baseline numbers.
2. Query matching backend endpoints for same time windows.
3. Confirm frontend cards/charts match API values.
4. Repeat with different presets (especially 24H and 6M) to catch edge cases.

Examples of checks used:

- Last 24h call-count sanity check in SQL vs /api/dashboard/total-calls
- M13 queue payload verified for current, avgWaitSeconds, avgWaitFormatted, lookbackDays
- M6 and M14 payloads verified to include formatted and numeric duration fields

Practical rule:
DB result is the reference baseline; API and UI are expected to match that baseline.

## 9. Deployment / Runtime

### Backend runtime

- .NET API starts in api/Program.cs on http://0.0.0.0:5000
- SQL connection string configured in api/appsettings.json
- DbService enforces connection throttling to avoid pool pressure
- Global middleware maps transient SQL failures to HTTP 503

### Frontend runtime

- Vite dev server on localhost:5173
- Proxy forwards /api requests to localhost:5000
- Dashboard loads metric data via TanStack Query hooks

### Build commands

- npm run dev: concurrent API + frontend
- npm run build: frontend production bundle
- npm run build:api: backend publish output

### Runtime considerations

- Port 5000 must be free for API startup
- If 503 occurs, frontend shows connection alert and polls /api/health
- Startup config now uses AppContext.BaseDirectory so appsettings load is robust even when launched from outside the api folder

## 10. How to Explain This Project to a Manager (Executive Summary)

Use this in meetings:

This dashboard gives operations and leadership a live view of IVR performance across call success, workflow efficiency, and transcription infrastructure health. It combines 17 operational metrics with drill-down capability so teams can quickly identify where retries, failures, or queue backlogs are happening. The system is designed for data trust: SQL is the source of truth, metric formulas are computed in the backend, and the frontend is intentionally display-focused. We also added metric definitions as a versioned API-accessible catalog, so formula intent is documented and less likely to break as the system evolves. In practice, this helps teams monitor service quality, reduce reattempt volume, and respond faster to bottlenecks.

## 11. Future Improvements

High-value next steps:

- Add automated metric contract tests that compare SQL baselines to API outputs in CI
- Add caching for expensive metric windows (especially percentile-heavy endpoints)
- Introduce historical snapshots for weekly/monthly trend and anomaly analysis
- Add alerting (email/Slack/Teams) for threshold breaches (queue, error rate, first-attempt drops)
- Extend vendor model in M14/M15 beyond single-vendor output
- Add OpenAPI examples for all dashboard endpoints
- Add role-based access and audit logs for operations exports and settings changes
- Introduce TypeScript in frontend for stronger contract safety
- Add query-performance instrumentation and index recommendations for large windows
- Implement explicit server-side callType filtering where business logic requires it

## Appendix A: Quick Reference Paths

Frontend:

- src/hooks/useDashboardData.js
- src/services/dashboardApi.js
- src/components/metrics/telephony/CallDurationCard.jsx
- src/components/metrics/workflow/ReattemptFunnelCard.jsx
- src/components/metrics/workflow/FirstAttemptCard.jsx
- src/components/metrics/infrastructure/TranscriptionQueueCard.jsx
- src/components/metrics/infrastructure/TranscriptionLatencyCard.jsx
- src/pages/Operations/OperationsTable.jsx

Backend:

- api/Controllers/DashboardController.cs
- api/Controllers/OperationsController.cs
- api/Controllers/HealthController.cs
- api/Services/DbService.cs
- api/Helpers/FilterHelper.cs
- api/Program.cs
- api/Definitions/metric-definitions.json
- api/Services/MetricDefinitionService.cs
