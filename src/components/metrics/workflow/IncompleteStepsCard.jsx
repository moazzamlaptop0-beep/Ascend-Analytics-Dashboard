import { useIncompleteSteps } from "../../../hooks/useDashboardData";
import { MetricCard } from "../../ui";
import { HorizontalBarChart } from "../../charts";
import { COLORS } from "../../../config/constants";

export default function IncompleteStepsCard() {
  const { data, isLoading, error } = useIncompleteSteps();

  const barData = (data ?? []).slice(0, 8).map((d) => ({
    label: d.step,
    Incomplete: d.incompleteCount,
  }));

  return (
    <MetricCard
      title="M12 - Top Incomplete IVR Steps"
      subtitle="Steps where callers drop off most frequently"
      loading={isLoading}
      error={error}
      minHeight={320}
    >
      <div style={{ height: 280 }}>
        <HorizontalBarChart
          data={barData}
          keys={["Incomplete"]}
          indexBy="label"
          xLabel="Incomplete Count"
          colors={[COLORS.danger]}
          enableLabel
          labelTextColor="#ffffff"
          margin={{ top: 10, right: 24, bottom: 40, left: 140 }}
          tooltip={({ data: d }) => {
            const src = (data ?? []).find((s) => s.step === d.label);
            return (
              <div className="bg-white shadow-lg border rounded-lg px-3 py-2 text-xs">
                <p className="font-semibold text-gray-800">{d.label}</p>
                <p className="text-gray-500">
                  {d.Incomplete.toLocaleString()} incomplete
                  {src ? ` (${src.incompletePercent}%)` : ""}
                </p>
              </div>
            );
          }}
        />
      </div>
    </MetricCard>
  );
}
