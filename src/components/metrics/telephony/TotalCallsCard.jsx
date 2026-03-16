import { useTotalCalls } from "../../../hooks/useDashboardData";
import { KpiCard, MetricCard } from "../../ui";
import { LineChart } from "../../charts";
import { formatNumber } from "../../../utils/formatters";
import { RiPhoneLine } from "@remixicon/react";

export default function TotalCallsCard() {
  const { data, isLoading, error } = useTotalCalls();

  // Line chart data shape for Nivo
  const lineData = data?.trendData
    ? [
        {
          id: "Calls",
          data: data.trendData.map((d) => ({ x: d.date, y: d.value })),
        },
      ]
    : [];

  return (
    <div className="flex flex-col gap-4">
      {/* KPI header */}
      <KpiCard
        title="Total Calls Initiated"
        value={data ? formatNumber(data.total) : "-"}
        subtitle={data ? `${formatNumber(data.avgDaily)} avg/day` : undefined}
        trend={data?.trend ? Number(data.trend) : undefined}
        icon={RiPhoneLine}
        loading={isLoading}
      />

      {/* Trend chart */}
      <MetricCard
        title="M1 - Call Volume Trend"
        subtitle="Daily total calls over selected period"
        loading={isLoading}
        error={error}
      >
        <div style={{ height: 220 }}>
          <LineChart
            data={lineData}
            yLabel="Calls"
            enableArea
            colors={["#3b82f6"]}
            enablePoints={lineData[0]?.data?.length <= 14}
            maxXTicks={10}
            axisBottomTickRotation={-30}
            margin={{ top: 20, right: 24, bottom: 62, left: 52 }}
          />
        </div>
      </MetricCard>
    </div>
  );
}
