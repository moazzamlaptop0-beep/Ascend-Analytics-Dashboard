import { useApiUsage } from "../../../hooks/useDashboardData";
import { MetricCard } from "../../ui";
import { StackedBarChart } from "../../charts";
import { COLORS } from "../../../config/constants";
import { formatNumber } from "../../../utils/formatters";

export default function ApiUsageCard() {
  const { data, isLoading, error } = useApiUsage();

  const chartData = data?.data ?? [];
  const vendors = data?.vendors ?? [];
  const tickStep = Math.max(1, Math.ceil(chartData.length / 8));
  const tickValues = chartData
    .filter((_, i) => i % tickStep === 0)
    .map((d) => d.date);

  if (chartData.length > 0) {
    const lastDate = chartData[chartData.length - 1].date;
    if (tickValues[tickValues.length - 1] !== lastDate) {
      tickValues.push(lastDate);
    }
  }

  return (
    <MetricCard
      title="M15 - Transcription API Usage"
      subtitle="Daily API calls by vendor"
      loading={isLoading}
      error={error}
    >
      <div className="flex flex-col gap-4">
        {/* Vendor totals */}
        {data?.totalByVendor && (
          <div className="flex gap-4">
            {data.totalByVendor.map((v, i) => (
              <div key={v.vendor} className="flex items-center gap-2">
                <span
                  className="w-2.5 h-2.5 rounded-full"
                  style={{
                    backgroundColor: COLORS.chart[i % COLORS.chart.length],
                  }}
                />
                <span className="text-xs text-gray-500">
                  {v.vendor}:{" "}
                  <span className="font-semibold text-gray-700">
                    {formatNumber(v.total)}
                  </span>
                </span>
              </div>
            ))}
          </div>
        )}

        <div style={{ height: 220 }}>
          <StackedBarChart
            data={chartData}
            keys={vendors}
            indexBy="date"
            colors={COLORS.chart.slice(0, vendors.length)}
            yLabel="API Calls"
            axisBottomTickRotation={-55}
            margin={{ top: 10, right: 130, bottom: 62, left: 52 }}
            axisBottom={{
              tickSize: 4,
              tickPadding: 8,
              tickRotation: -55,
              tickValues,
              legend: "",
              legendPosition: "middle",
              legendOffset: 40,
            }}
            enableLabel={false}
          />
        </div>
      </div>
    </MetricCard>
  );
}
