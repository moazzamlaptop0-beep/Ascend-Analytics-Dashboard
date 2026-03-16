import { useReattemptFunnel } from "../../../hooks/useDashboardData";
import { MetricCard } from "../../ui";
import { FunnelChart } from "../../charts";

export default function ReattemptFunnelCard() {
  const { data, isLoading, error } = useReattemptFunnel();

  const funnelData =
    data?.stages?.map((s) => ({
      label: s.label,
      value: s.count,
    })) ?? [];

  return (
    <MetricCard
      title="M10 - Reattempt Outcome Funnel"
      subtitle="Drop-off through attempt stages"
      loading={isLoading}
      error={error}
    >
      <FunnelChart data={funnelData} height={200} />

      {/* Drop-off annotations */}
      {data?.stages && (
        <div className="flex flex-wrap gap-2 mt-2 max-h-24 overflow-y-auto pr-1">
          {data.stages
            .filter((s) => s.dropOffPercent != null)
            .map((s) => (
              <span
                key={s.label}
                className="text-[11px] text-gray-500 bg-gray-50 px-2 py-1 rounded"
              >
                → {s.label}: {s.dropOffPercent}% drop-off
              </span>
            ))}
        </div>
      )}
    </MetricCard>
  );
}
