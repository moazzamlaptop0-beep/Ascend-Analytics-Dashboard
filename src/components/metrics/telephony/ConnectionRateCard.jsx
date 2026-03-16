import { useConnectionRate } from "../../../hooks/useDashboardData";
import { GaugeChart, KpiCard, MetricCard } from "../../ui";
import { LineChart } from "../../charts";
import { THRESHOLDS } from "../../../config/constants";
import { RiSignalWifiFill } from "@remixicon/react";

export default function ConnectionRateCard() {
  const { data, isLoading, error } = useConnectionRate();

  const lineData = data?.trendData
    ? [
        {
          id: "Connection %",
          data: data.trendData.map((d) => ({ x: d.date, y: d.value })),
        },
      ]
    : [];

  return (
    <div className="flex flex-col gap-4">
      {/* Gauge + KPI */}
      <div className="bg-white rounded-xl border border-gray-200 p-5 card-hover flex items-center gap-6">
        <GaugeChart
          value={data?.current ?? 0}
          greenThreshold={THRESHOLDS.CONNECTION_RATE.green}
          yellowThreshold={THRESHOLDS.CONNECTION_RATE.yellow}
          label="Connection"
          size={140}
          loading={isLoading}
        />
        <div className="flex-1">
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">
            Successful Connection Rate
          </p>
          <p className="text-2xl font-bold text-gray-900">
            {data ? `${data.current}%` : "-"}
          </p>
          <p className="text-xs text-gray-400 mt-1">
            {data
              ? `${data.connected.toLocaleString()} connected / ${data.initiated.toLocaleString()} initiated`
              : ""}
          </p>
        </div>
      </div>

      {/* Trend */}
      <MetricCard
        title="M2 - Connection Rate Trend"
        subtitle="Daily connection success %"
        loading={isLoading}
        error={error}
      >
        <div style={{ height: 200 }}>
          <LineChart
            data={lineData}
            yLabel="%"
            yFormat={(v) => `${v}%`}
            colors={["#10b981"]}
            enableArea
            enablePoints={lineData[0]?.data?.length <= 14}
            maxXTicks={9}
            axisBottomTickRotation={-30}
            margin={{ top: 20, right: 24, bottom: 62, left: 52 }}
          />
        </div>
      </MetricCard>
    </div>
  );
}
