import { useLocation } from "react-router-dom";
import { RiLiveLine, RiFilter3Line, RiRefreshLine } from "@remixicon/react";
import { useGlobalFilters } from "../hooks/useGlobalFilters";
import { useFilterOptions } from "../hooks/useFilterOptions";
import { useConnection } from "../hooks/useConnection";
import FilterDropdown from "../components/ui/FilterDropdown";
import {
  INSURANCES,
  PRACTICES,
  DNIS_LIST,
  CALL_TYPES,
  DATE_PRESETS,
} from "../config/constants";

export default function TopBar() {
  const location = useLocation();
  const { dbDown } = useConnection();
  const {
    filters,
    updateFilter,
    updateDateRange,
    resetFilters,
    activeFilterCount,
  } = useGlobalFilters();

  // Dynamic filter options from DB (falls back to constants)
  const { data: filterOpts } = useFilterOptions();
  const insuranceOpts = filterOpts?.insurances?.length
    ? filterOpts.insurances
    : INSURANCES;
  const practiceOpts = filterOpts?.practices?.length
    ? filterOpts.practices
    : PRACTICES;
  const dnisOpts = filterOpts?.dnis?.length ? filterOpts.dnis : DNIS_LIST;
  const callTypeOpts = filterOpts?.callTypes?.length
    ? filterOpts.callTypes
    : CALL_TYPES;

  // Page title based on route
  const pageTitle = location.pathname.includes("/operations")
    ? "Operations Data"
    : location.pathname.includes("/settings")
      ? "Settings"
      : "Dashboard";

  return (
    <header className="h-16 bg-white border-b border-gray-200 flex items-center justify-between px-6 sticky top-0 z-30">
      {/* Left: Live badge + page context */}
      <div className="flex items-center gap-4">
        <div
          className={`flex items-center gap-2 px-3 py-1.5 border rounded-full transition-colors ${
            dbDown ? "bg-red-50 border-red-200" : "bg-green-50 border-green-200"
          }`}
        >
          <div
            className={`w-2 h-2 rounded-full ${
              dbDown
                ? "bg-red-500 animate-pulse"
                : "bg-green-500 animate-pulse-live"
            }`}
          />
          <span
            className={`text-xs font-medium ${
              dbDown ? "text-red-700" : "text-green-700"
            }`}
          >
            {dbDown ? "OFFLINE" : "LIVE"}
          </span>
        </div>
        <span className="text-sm text-gray-400">|</span>
        <span className="text-sm font-medium text-gray-700">{pageTitle}</span>
      </div>

      {/* Right: Filters */}
      <div className="flex items-center gap-3">
        {/* Date Range */}
        <div className="flex items-center gap-1 bg-gray-50 rounded-lg border border-gray-200 p-0.5">
          {DATE_PRESETS.filter((p) => p.value !== "custom").map((preset) => (
            <button
              key={preset.value}
              onClick={() => updateDateRange(preset.value)}
              className={`px-2.5 py-1.5 text-xs font-medium rounded-md transition-colors ${
                filters.dateRange.preset === preset.value
                  ? "bg-white text-blue-600 shadow-sm"
                  : "text-gray-500 hover:text-gray-700"
              }`}
            >
              {/* Short labels for compact display */}
              {{
                "24h": "24H",
                "7d": "7D",
                "30d": "30D",
                "90d": "90D",
                "6m": "6M",
                "1y": "1Y",
              }[preset.value] ?? preset.label}
            </button>
          ))}
        </div>

        <span className="text-gray-300">|</span>

        {/* Filter dropdowns */}
        <FilterDropdown
          label="Insurance"
          options={insuranceOpts}
          selected={filters.insurance}
          onChange={(val) => updateFilter("insurance", val)}
        />
        <FilterDropdown
          label="Practice"
          options={practiceOpts}
          selected={filters.practice}
          onChange={(val) => updateFilter("practice", val)}
        />
        <FilterDropdown
          label="DNIS"
          options={dnisOpts}
          selected={filters.dnis}
          onChange={(val) => updateFilter("dnis", val)}
        />
        <FilterDropdown
          label="Call Type"
          options={callTypeOpts}
          selected={filters.callType}
          onChange={(val) => updateFilter("callType", val)}
        />

        {/* Reset */}
        {activeFilterCount > 0 && (
          <button
            onClick={resetFilters}
            className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-red-600 bg-red-50 border border-red-200 rounded-lg hover:bg-red-100 transition-colors"
          >
            <RiRefreshLine size={14} />
            Reset ({activeFilterCount})
          </button>
        )}
      </div>
    </header>
  );
}
