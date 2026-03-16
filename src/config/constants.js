// ── App-wide constants ──

export const APP_NAME = "IVR Analytics Portal";
export const APP_SUBTITLE = "Infrastructure & Billing Intelligence";

// ── Refresh intervals (ms) ──
export const REFRESH_INTERVALS = {
  ACTIVE_CALLS: 30_000, // 30 seconds
  REAL_TIME_METRICS: 30_000,
  DASHBOARD_STALE: 60_000, // 1 minute staleTime for TanStack Query
  SIGNALR_RECONNECT: 5_000,
};

// ── Thresholds ──
export const THRESHOLDS = {
  CONNECTION_RATE: { green: 95, yellow: 90 }, // >95 green, 90-95 yellow, <90 red
  DROP_RATE: { warning: 10 }, // >10% = red
  FIRST_ATTEMPT: { warning: 85 }, // <85% = red
  CLAIM_COMPLETION: { warning: 80 }, // <80% = red
  TRANSCRIPTION_QUEUE: { warning: 100 }, // >100 = red alert
  TRANSCRIPTION_P90: { warning: 4 }, // >4s = red
  CAPACITY: { warning: 90 }, // >90% = red
  ABANDONMENT: { warning: 15 }, // >15% = red
  ERROR_RATE: { warning: 10 }, // >10% = red
};

// ── Color palette ──
export const COLORS = {
  primary: "#3b82f6",
  primaryDark: "#1d4ed8",
  success: "#10b981",
  warning: "#f59e0b",
  danger: "#ef4444",
  info: "#6366f1",
  neutral: "#6b7280",

  // Chart palette (8 distinct colors)
  chart: [
    "#3b82f6", // blue
    "#10b981", // emerald
    "#f59e0b", // amber
    "#ef4444", // red
    "#8b5cf6", // violet
    "#ec4899", // pink
    "#14b8a6", // teal
    "#f97316", // orange
  ],

  // Gauge zones
  gauge: {
    green: "#10b981",
    yellow: "#f59e0b",
    red: "#ef4444",
    background: "#e5e7eb",
  },

  // Heatmap gradient
  heatmap: ["#f0fdf4", "#86efac", "#22c55e", "#15803d", "#052e16"],
};

// ── Insurance list ──
export const INSURANCES = [
  "Aetna",
  "Blue Cross",
  "Cigna",
  "UnitedHealth",
  "Humana",
  "Kaiser",
  "Anthem",
  "Molina",
  "Centene",
  "WellCare",
  "Ambetter",
  "Oscar Health",
  "Bright Health",
  "Clover Health",
  "Devoted Health",
];

// ── Practice units ──
export const PRACTICES = [
  "Unit A",
  "Unit B",
  "Unit C",
  "Unit D",
  "Unit E",
  "Unit F",
  "Unit G",
  "Unit H",
];

// ── DNIS numbers ──
export const DNIS_LIST = [
  "800-555-0101",
  "800-555-0102",
  "800-555-0103",
  "800-555-0104",
  "800-555-0105",
  "800-555-0106",
  "800-555-0107",
  "800-555-0108",
  "800-555-0109",
  "800-555-0110",
];

// ── Call types ──
export const CALL_TYPES = [
  "Inbound",
  "Outbound",
  "Transfer",
  "Redirect",
  "Emergency",
];

// ── Initiation sources ──
export const INITIATION_SOURCES = ["Bot", "Human"];

// ── Transcription vendors ──
export const TRANSCRIPTION_VENDORS = [
  "AWS Transcribe",
  "Google Speech",
  "Azure Speech",
  "Deepgram",
];

// ── IVR Steps (for incomplete steps metric) ──
export const IVR_STEPS = [
  "Welcome Prompt",
  "Insurance Verification",
  "Member ID Entry",
  "Claim Lookup",
  "Status Retrieval",
  "Result Playback",
  "Transfer to Agent",
  "Call Completion",
];

// ── Date range presets ──
export const DATE_PRESETS = [
  { label: "Last 24 Hours", value: "24h" },
  { label: "Last 7 Days", value: "7d" },
  { label: "Last 30 Days", value: "30d" },
  { label: "Last 90 Days", value: "90d" },
  { label: "Last 6 Months", value: "6m" },
  { label: "Last 1 Year", value: "1y" },
  { label: "Custom", value: "custom" },
];
