/**
 * Dashboard API - All 17 metric data fetchers
 * Uses mock data when VITE_USE_MOCK=true, else real API with shape transforms.
 */
import { USE_MOCK, apiFetch, buildFilterParams } from "./api";
import * as mock from "../mock/mockDashboardData";

const mockDelay = () =>
  new Promise((r) => setTimeout(r, Math.random() * 300 + 100));

// -- M1: Total Calls Initiated --
export async function fetchTotalCalls(filters) {
  if (USE_MOCK) {
    await mockDelay();
    return mock.generateTotalCalls(filters);
  }
  return apiFetch(`/dashboard/total-calls?${buildFilterParams(filters)}`);
}

// -- M2: Successful Connection Rate --
export async function fetchConnectionRate(filters) {
  if (USE_MOCK) {
    await mockDelay();
    return mock.generateConnectionRate(filters);
  }
  return apiFetch(`/dashboard/connection-rate?${buildFilterParams(filters)}`);
}

// -- M3: Call Drop Rate --
export async function fetchDropRate(filters) {
  if (USE_MOCK) {
    await mockDelay();
    return mock.generateDropRate(filters);
  }
  const raw = await apiFetch(
    `/dashboard/drop-rate?${buildFilterParams(filters)}`,
  );
  return {
    overall: raw.overall,
    trend: parseFloat(raw.trend) || 0,
    byInsurance: (raw.byInsurance || []).map((r) => ({
      insurance: r.insurance,
      dropRate: r.dropRate,
      totalCalls: r.total,
    })),
  };
}

// -- M4: Peak Calling Hours (Nivo heatmap format) --
export async function fetchPeakHours(filters) {
  if (USE_MOCK) {
    await mockDelay();
    return mock.generatePeakHours(filters);
  }
  const raw = await apiFetch(
    `/dashboard/peak-hours?${buildFilterParams(filters)}`,
  );
  // Transform heatmapData [{x, y(dayOfWeek), value}] -> [{id: "MON", data: [{x, y: value}]}]
  const dayMap = {};
  const dayAbbrev = {
    Monday: "MON",
    Tuesday: "TUE",
    Wednesday: "WED",
    Thursday: "THU",
    Friday: "FRI",
    Saturday: "SAT",
    Sunday: "SUN",
  };
  (raw.heatmapData || []).forEach((pt) => {
    const id = dayAbbrev[pt.y] || pt.y;
    if (!dayMap[id]) dayMap[id] = {};
    dayMap[id][pt.x] = (dayMap[id][pt.x] || 0) + pt.value;
  });
  const allDays = ["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"];
  return allDays
    .filter((d) => dayMap[d])
    .map((id) => ({
      id,
      data: Object.entries(dayMap[id])
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([x, y]) => ({ x, y })),
    }));
}

// -- M5: Active Calls Real-Time --
export async function fetchActiveCalls() {
  if (USE_MOCK) {
    await mockDelay();
    return mock.generateActiveCalls();
  }
  const raw = await apiFetch("/dashboard/active-calls");
  return {
    total: raw.current || 0,
    capacity: raw.capacity || 500,
    utilizationPercent: raw.utilizationPct || 0,
    breakdown: (raw.statusBreakdown || []).map((s) => ({
      segment: s.status,
      value: s.count,
    })),
    timestamp: new Date().toISOString(),
  };
}

// -- M6: Call Duration (P90/P95) --
export async function fetchCallDuration(filters) {
  if (USE_MOCK) {
    await mockDelay();
    return mock.generateCallDuration(filters);
  }
  const raw = await apiFetch(
    `/dashboard/call-duration?${buildFilterParams(filters)}`,
  );
  const ins = raw.byInsurance || [];
  return {
    boxPlot: {
      min: raw.overall?.min || 0,
      minFormatted: raw.overall?.minFormatted || null,
      p25: Math.round(raw.overall?.p25 || 0),
      p25Formatted: raw.overall?.p25Formatted || null,
      median: Math.round(raw.overall?.median || 0),
      medianFormatted: raw.overall?.medianFormatted || null,
      p75: Math.round(raw.overall?.p75 || 0),
      p75Formatted: raw.overall?.p75Formatted || null,
      p90: Math.round(raw.overall?.p90 || 0),
      p90Formatted: raw.overall?.p90Formatted || null,
      p95: Math.round(raw.overall?.p95 || 0),
      p95Formatted: raw.overall?.p95Formatted || null,
      max: raw.overall?.max || 0,
      maxFormatted: raw.overall?.maxFormatted || null,
    },
    meanDuration: Math.round(raw.overall?.avg || 0),
    meanDurationFormatted: raw.overall?.avgFormatted || null,
    p99Outlier: raw.overall?.max || 0,
    trendData: ins.map((r) => ({
      date: r.insurance,
      value: Math.round(r.avg),
      valueFormatted: r.avgFormatted || null,
    })),
  };
}

// -- M7: Top Dropped Insurances --
export async function fetchTopDropped(filters) {
  if (USE_MOCK) {
    await mockDelay();
    return mock.generateTopDropped(filters);
  }
  const raw = await apiFetch(
    `/dashboard/top-dropped?${buildFilterParams(filters)}`,
  );
  return (raw.insurances || []).slice(0, 5).map((r) => ({
    insurance: r.insurance,
    dropRate: r.dropPct || 0,
    droppedCalls: r.dropped,
    totalCalls: r.total,
  }));
}

// -- M8: Initiation Source (status breakdown as pie) --
export async function fetchInitiationSource(filters) {
  if (USE_MOCK) {
    await mockDelay();
    return mock.generateInitiationSource(filters);
  }
  const raw = await apiFetch(
    `/dashboard/initiation-source?${buildFilterParams(filters)}`,
  );
  const total = (raw.sources || []).reduce((s, r) => s + r.value, 0);
  return {
    data: (raw.sources || []).map((r) => ({
      id: r.id,
      label: r.label,
      value: r.value,
      percent: r.pct || 0,
    })),
    total,
  };
}

// -- M9: Claim Status Completion Rate --
export async function fetchClaimCompletion(filters) {
  if (USE_MOCK) {
    await mockDelay();
    return mock.generateClaimCompletion(filters);
  }
  const raw = await apiFetch(
    `/dashboard/claim-completion?${buildFilterParams(filters)}`,
  );
  const completed = (raw.statuses || []).find(
    (s) =>
      s.status === "Completed" ||
      s.status === "Claim status found and was transcribed",
  );
  const completedCount = completed?.count || 0;
  return {
    current: raw.completionRate || 0,
    trend: 0,
    completedCalls: completedCount,
    totalAttempted: raw.total || 0,
    trendData: (raw.statuses || []).map((s) => ({
      date: s.status,
      value: s.pct || 0,
    })),
  };
}

// -- M10: Reattempt Outcome Funnel --
export async function fetchReattemptFunnel(filters) {
  if (USE_MOCK) {
    await mockDelay();
    return mock.generateReattemptFunnel(filters);
  }
  const raw = await apiFetch(
    `/dashboard/reattempt-funnel?${buildFilterParams(filters)}`,
  );
  return { stages: raw.stages || [] };
}

// -- M11: First Attempt Success Rate --
export async function fetchFirstAttemptRate(filters) {
  if (USE_MOCK) {
    await mockDelay();
    return mock.generateFirstAttemptRate(filters);
  }
  const raw = await apiFetch(
    `/dashboard/first-attempt-rate?${buildFilterParams(filters)}`,
  );
  const td = raw.trendData || [];
  const current = raw.rate || 0;
  const prev = td.length > 1 ? td[td.length - 2].value : current;
  return {
    current,
    trend: parseFloat((current - prev).toFixed(1)),
    trendData: td,
  };
}

// -- M12: Top Incomplete Steps --
export async function fetchIncompleteSteps(filters) {
  if (USE_MOCK) {
    await mockDelay();
    return mock.generateIncompleteSteps(filters);
  }
  const raw = await apiFetch(
    `/dashboard/incomplete-steps?${buildFilterParams(filters)}`,
  );
  const totalAll = (raw.steps || []).reduce((s, r) => s + r.count, 0);
  return (raw.steps || []).map((r) => ({
    step: r.step,
    incompleteCount: r.count,
    totalAttempts: totalAll,
    incompletePercent: r.pct || 0,
  }));
}

// -- M13: Transcription Queue Length --
export async function fetchTranscriptionQueue() {
  if (USE_MOCK) {
    await mockDelay();
    return mock.generateTranscriptionQueue();
  }
  const raw = await apiFetch("/dashboard/transcription-queue");
  const history = raw.history || [];
  return {
    current: raw.current || 0,
    avgWaitSeconds: raw.avgWaitSeconds || 0,
    avgWaitFormatted: raw.avgWaitFormatted || null,
    lookbackDays: raw.lookbackDays || null,
    historicalPending: raw.historicalPending || 0,
    trend:
      history.length >= 2
        ? history[history.length - 1].value - history[history.length - 2].value
        : 0,
    trendData: history.map((h) => ({ hour: h.time, value: h.value })),
  };
}

// -- M14: Avg Transcription Latency --
export async function fetchTranscriptionLatency(filters) {
  if (USE_MOCK) {
    await mockDelay();
    return mock.generateTranscriptionLatency(filters);
  }
  const raw = await apiFetch(
    `/dashboard/transcription-time?${buildFilterParams(filters)}`,
  );
  return {
    vendors: (raw.byVendor || []).map((v) => ({
      vendor: v.vendor,
      count: v.count || 0,
      avg: v.avgSeconds || 0,
      avgFormatted: v.avgFormatted || null,
      min: v.min || 0,
      minFormatted: v.minFormatted || null,
      p25: v.p25 || 0,
      p25Formatted: v.p25Formatted || null,
      median: v.median || 0,
      medianFormatted: v.medianFormatted || null,
      p75: v.p75 || 0,
      p75Formatted: v.p75Formatted || null,
      p90: v.p90 || 0,
      p90Formatted: v.p90Formatted || null,
      p95: v.p95 || 0,
      p95Formatted: v.p95Formatted || null,
      max: v.max || 0,
      maxFormatted: v.maxFormatted || null,
    })),
    overallP90: raw.overallP90Seconds || 0,
    overallP90Formatted: raw.overallP90Formatted || null,
  };
}

// -- M15: Transcription API Usage --
export async function fetchApiUsage(filters) {
  if (USE_MOCK) {
    await mockDelay();
    return mock.generateApiUsage(filters);
  }
  const raw = await apiFetch(
    `/dashboard/transcription-api-usage?${buildFilterParams(filters)}`,
  );
  const vendors = raw.vendors || [];
  const vendorNames = vendors.map((v) => v.vendor);
  // Pivot daily data into {date, "Vendor1": n, "Vendor2": n}
  const dateMap = {};
  vendors.forEach((v) => {
    (v.daily || []).forEach((d) => {
      if (!dateMap[d.date]) dateMap[d.date] = { date: d.date };
      dateMap[d.date][v.vendor] = d.calls;
    });
  });
  return {
    data: Object.values(dateMap),
    totalByVendor: vendors.map((v) => ({
      vendor: v.vendor,
      total: v.totalCalls,
    })),
    vendors: vendorNames,
  };
}

// -- M16: Concurrent Peak Monitoring --
export async function fetchConcurrentPeaks(filters) {
  if (USE_MOCK) {
    await mockDelay();
    return mock.generateConcurrentPeaks(filters);
  }
  const raw = await apiFetch(
    `/dashboard/concurrent-peaks?${buildFilterParams(filters)}`,
  );
  const threshold = raw.capacity || 500;
  // Group hourly data to get per-hour aggregates
  const hourMap = {};
  (raw.hourly || []).forEach((h) => {
    if (!hourMap[h.hour]) hourMap[h.hour] = 0;
    hourMap[h.hour] += h.concurrent;
  });
  const data = Array.from({ length: 24 }, (_, i) => {
    const hour = `${String(i).padStart(2, "0")}:00`;
    const value = hourMap[hour] || 0;
    return { hour, value, isPeak: value > threshold * 0.85 };
  });
  const peakValue = Math.max(...data.map((d) => d.value), 0);
  const peakHour = data.find((d) => d.value === peakValue)?.hour || "N/A";
  return { data, peakValue, peakHour, threshold };
}

// -- M17: Global System Error Rate --
export async function fetchErrorRate(filters) {
  if (USE_MOCK) {
    await mockDelay();
    return mock.generateErrorRate(filters);
  }
  const raw = await apiFetch(
    `/dashboard/error-rate?${buildFilterParams(filters)}`,
  );
  const totalErrors = raw.totalErrors || 0;
  return {
    current: raw.rate || 0,
    trend: 0,
    totalErrors,
    byCategory: (raw.breakdown || []).map((b) => ({
      category: b.type,
      count: b.count,
      percent:
        totalErrors > 0
          ? parseFloat(((b.count / totalErrors) * 100).toFixed(1))
          : 0,
    })),
    trendData: raw.trendData || [],
  };
}

// -- Filter Options (dynamic from DB) --
export async function fetchFilterOptions() {
  if (USE_MOCK) {
    const { INSURANCES, PRACTICES, DNIS_LIST, CALL_TYPES } =
      await import("../config/constants");
    return {
      insurances: INSURANCES,
      practices: PRACTICES,
      dnis: DNIS_LIST,
      callTypes: CALL_TYPES,
    };
  }
  const raw = await apiFetch("/dashboard/filter-options");
  return {
    insurances: raw.insurances || [],
    practices: raw.practices || [],
    dnis: raw.dnis || [],
    callTypes: ["Outbound"],
  };
}
