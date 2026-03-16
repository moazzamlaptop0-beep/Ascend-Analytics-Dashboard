import { useFirstAttemptRate } from "../../../hooks/useDashboardData";
import { GaugeChart, MetricCard, TrendBadge } from "../../ui";
import { LineChart } from "../../charts";
import { THRESHOLDS } from "../../../config/constants";

export default function FirstAttemptCard() {
  const { data, isLoading, error } = useFirstAttemptRate();

  const lineData = data?.trendData
    ? [
        {
          id: "First Attempt %",
          data: data.trendData.map((d) => ({ x: d.date, y: d.value })),
        },
      ]
    : [];

  return (
    <MetricCard
      title="M11 - First Attempt Success Rate"
      subtitle="Claims resolved on the first IVR call"
      loading={isLoading}
      error={error}
    >
      <div className="flex flex-col gap-4">
        <div className="flex items-center gap-6">
          <GaugeChart
            value={data?.current ?? 0}
            greenThreshold={92}
            yellowThreshold={THRESHOLDS.FIRST_ATTEMPT.warning}
            label="1st Attempt"
            size={130}
            loading={isLoading}
          />
          <div>
            <p className="text-2xl font-bold text-gray-900">
              {data ? `${data.current}%` : "-"}
            </p>
            {data?.trend != null && <TrendBadge value={Number(data.trend)} />}
          </div>
        </div>

        <div style={{ height: 160 }}>
          <LineChart
            data={lineData}
            yLabel="%"
            yFormat={(v) => `${v}%`}
            colors={["#6366f1"]}
            enableArea
            enablePoints={lineData[0]?.data?.length <= 14}
            maxXTicks={8}
            axisBottomTickRotation={-55}
            margin={{ top: 10, right: 16, bottom: 64, left: 48 }}
          />
        </div>
      </div>
    </MetricCard>
  );
}
