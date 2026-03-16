// ── Number formatting ──
export function formatNumber(num) {
  if (num == null) return "-";
  if (num >= 1_000_000) return `${(num / 1_000_000).toFixed(1)}M`;
  if (num >= 1_000) return `${(num / 1_000).toFixed(1)}k`;
  return num.toLocaleString();
}

export function formatNumberFull(num) {
  if (num == null) return "-";
  return num.toLocaleString();
}

// ── Percent formatting ──
export function formatPercent(value, decimals = 1) {
  if (value == null) return "-";
  return `${value.toFixed(decimals)}%`;
}

// ── Duration formatting (seconds → human readable) ──
export function formatDuration(seconds) {
  if (seconds == null) return "-";
  if (seconds < 60) return `${Math.round(seconds)}s`;
  const mins = Math.floor(seconds / 60);
  const secs = Math.round(seconds % 60);
  if (mins < 60) return `${mins}m ${secs}s`;
  const hrs = Math.floor(mins / 60);
  const remainMins = mins % 60;
  if (hrs < 24) return `${hrs}h ${remainMins}m`;
  const days = Math.floor(hrs / 24);
  const remainHours = hrs % 24;
  return `${days}d ${remainHours}h`;
}

// ── Duration formatting (seconds → "4m 24s" style) ──
export function formatDurationShort(seconds) {
  if (seconds == null) return "-";
  const mins = Math.floor(seconds / 60);
  const secs = Math.round(seconds % 60);
  return `${mins}m ${String(secs).padStart(2, "0")}s`;
}

// ── Trend formatting (+0.4%, -2.1%) ──
export function formatTrend(value) {
  if (value == null) return "-";
  const sign = value >= 0 ? "+" : "";
  return `${sign}${value.toFixed(1)}%`;
}
