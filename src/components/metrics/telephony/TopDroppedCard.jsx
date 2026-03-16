import { useTopDropped } from "../../../hooks/useDashboardData";
import { MetricCard } from "../../ui";
import { HorizontalBarChart } from "../../charts";
import { THRESHOLDS, COLORS } from "../../../config/constants";

export default function TopDroppedCard() {
  const { data, isLoading, error } = useTopDropped();

  const barData = (data ?? []).map((d) => ({
    label: d.insurance,
    "Dropped Calls": d.droppedCalls,
    "Drop Rate %": d.dropRate,
  }));

  return (
    <MetricCard
      title="M7 - Top Dropped Insurances"
      subtitle="Insurances with highest call drop counts"
      loading={isLoading}
      error={error}
    >
      <div style={{ height: 240 }}>
        <HorizontalBarChart
          data={barData}
          keys={["Dropped Calls"]}
          indexBy="label"
          xLabel="Dropped Calls"
          colors={({ data: d }) =>
            d["Drop Rate %"] > THRESHOLDS.DROP_RATE.warning
              ? COLORS.danger
              : COLORS.warning
          }
          enableLabel
          labelTextColor="#ffffff"
          margin={{ top: 10, right: 24, bottom: 40, left: 120 }}
          tooltip={({ data: d }) => (
            <div className="bg-white shadow-lg border rounded-lg px-3 py-2 text-xs">
              <p className="font-semibold text-gray-800">{d.label}</p>
              <p className="text-gray-500">
                {d["Dropped Calls"]} dropped ({d["Drop Rate %"]}%)
              </p>
            </div>
          )}
        />
      </div>
    </MetricCard>
  );
}
