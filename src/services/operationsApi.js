/**
 * Operations API - Call logs data fetcher
 * Transforms API response to match the column keys expected by OperationsTable
 */
import { USE_MOCK, apiFetch, buildFilterParams } from "./api";
import { getOperationsPage } from "../mock/mockOperationsData";

const mockDelay = () =>
  new Promise((r) => setTimeout(r, Math.random() * 200 + 50));

// Map single-char status codes to display labels used by STATUS_COLORS in OperationsTable
const STATUS_MAP = {
  S: "Completed",
  C: "Completed",
  D: "Dropped",
  F: "Failed",
  R: "Failed",
  I: "In Progress",
  Q: "In Progress",
  E: "Failed",
  G: "Failed",
  N: "In Progress",
  T: "Transferred",
};

function formatTimestamp(callDate, callInTime) {
  if (callInTime) {
    const d = new Date(callInTime);
    if (!isNaN(d.getTime())) {
      return d.toLocaleString("en-US", {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hour12: false,
      });
    }
  }
  if (callDate) return new Date(callDate).toLocaleDateString("en-US");
  return "-";
}

function formatClaimId(claimValue) {
  if (!claimValue) return null;

  if (typeof claimValue !== "string") {
    return String(claimValue);
  }

  const trimmed = claimValue.trim();
  if (!trimmed.startsWith("[")) {
    return trimmed;
  }

  try {
    const parsed = JSON.parse(trimmed);
    if (!Array.isArray(parsed)) return trimmed;

    const claimNos = parsed
      .map((entry) => entry?.ClaimNo)
      .filter(Boolean)
      .map((value) => String(value).trim());

    return claimNos.length ? claimNos.join(", ") : trimmed;
  } catch {
    return trimmed;
  }
}

function transformRow(row) {
  return {
    id: `CALL-${String(row.CallID).padStart(7, "0")}`,
    timestamp: row.CallInTime || row.CallDate,
    timestampFormatted: formatTimestamp(row.CallDate, row.CallInTime),
    insurance: row.Insurance || "-",
    practice: row.Practice || "-",
    dnis: row.DNIS || "-",
    callType: "Outbound",
    source: "Bot",
    status:
      STATUS_MAP[row.Status] ||
      row.StatusDescription ||
      row.Status ||
      "Unknown",
    duration: 0,
    durationFormatted: "-",
    lastStep: row.StatusDescription || "-",
    attempts: row.NoOfClaims || 1,
    errors:
      row.Status === "F" || row.Status === "E" || row.Status === "G" ? 1 : 0,
    claimId: formatClaimId(row.ClaimNo),
    uniqueId: row.UniqueId,
    transcriptionPreview: row.TranscriptionPreview,
  };
}

export async function fetchOperationsLogs({
  page,
  pageSize,
  sort,
  dir,
  filters,
  search,
}) {
  if (USE_MOCK) {
    await mockDelay();
    return getOperationsPage({ page, pageSize, sort, dir, filters, search });
  }

  // Map frontend sort keys to backend column names
  const SORT_KEY_MAP = {
    id: "CallID",
    timestampFormatted: "CallInTime",
    insurance: "Insurance",
    practice: "Practice",
    dnis: "DNIS",
    status: "Status",
    attempts: "NoOfClaims",
    claimId: "ClaimNo",
  };

  const params = new URLSearchParams();
  params.set("page", page);
  params.set("size", pageSize);
  if (sort) params.set("sort", SORT_KEY_MAP[sort] || "CallDate");
  if (dir) params.set("dir", dir);
  if (search) params.set("search", search);
  if (filters?.status) params.set("status", filters.status);

  const filterStr = buildFilterParams(filters);
  const fullParams = filterStr
    ? `${params.toString()}&${filterStr}`
    : params.toString();

  const raw = await apiFetch(`/operations/logs?${fullParams}`);

  return {
    data: (raw.rows || []).map(transformRow),
    totalRecords: raw.total || 0,
    page: raw.page || page,
    pageSize: raw.pageSize || pageSize,
    totalPages: raw.totalPages || 0,
  };
}
