import { useCallDuration } from "../../../hooks/useDashboardData";
import { MetricCard } from "../../ui";
import { HorizontalBarChart } from "../../charts";
import { formatDurationShort } from "../../../utils/formatters";

export default function CallDurationCard() {
  const { data, isLoading, error } = useCallDuration();

  const durationBars = (data?.trendData ?? []).slice(0, 10).map((d) => ({
    label: d.date.length > 24 ? `${d.date.slice(0, 24)}...` : d.date,
    fullLabel: d.date,
    "Avg Duration": d.value,
  }));

  const bp = data?.boxPlot;

  return (
    <MetricCard
      title="M6 - Call Duration Analysis"
      subtitle="Duration distribution with P90/P95 indicators"
      loading={isLoading}
      error={error}
    >
      <div className="flex flex-col gap-4">
        {/* Box Plot summary stats */}
        {bp && (
          <div className="grid grid-cols-5 gap-3 text-center">
            {[
              { label: "Min", val: bp.min, formatted: bp.minFormatted },
              { label: "P25", val: bp.p25, formatted: bp.p25Formatted },
              {
                label: "Median",
                val: bp.median,
                formatted: bp.medianFormatted,
              },
              {
                label: "P90",
                val: bp.p90,
                formatted: bp.p90Formatted,
                highlight: true,
              },
              {
                label: "P95",
                val: bp.p95,
                formatted: bp.p95Formatted,
                highlight: true,
              },
            ].map((s) => (
              <div
                key={s.label}
                className={`rounded-lg py-2 px-1 ${
                  s.highlight
                    ? "bg-amber-50 border border-amber-200"
                    : "bg-gray-50"
                }`}
              >
                <p className="text-[10px] text-gray-400 uppercase">{s.label}</p>
                <p
                  className={`text-sm font-bold ${s.highlight ? "text-amber-600" : "text-gray-700"}`}
                >
                  {s.formatted || formatDurationShort(s.val)}
                </p>
              </div>
            ))}
          </div>
        )}

        {/* Avg duration by insurance (top entries for readability) */}
        <div style={{ height: 210 }}>
          <HorizontalBarChart
            data={durationBars}
            keys={["Avg Duration"]}
            indexBy="label"
            xLabel="sec"
            enableLabel={false}
            margin={{ top: 10, right: 20, bottom: 36, left: 140 }}
            colors={["#8b5cf6"]}
            tooltip={({ data: d }) => (
              <div className="bg-white shadow-lg border rounded-lg px-3 py-2 text-xs">
                <p className="font-semibold text-gray-800">{d.fullLabel}</p>
                <p className="text-gray-500">
                  Avg Duration: {d["Avg Duration"]} sec
                </p>
              </div>
            )}
          />
        </div>
      </div>
    </MetricCard>
  );
}
