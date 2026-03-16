import { useErrorRate } from "../../../hooks/useDashboardData";
import { KpiCard, MetricCard } from "../../ui";
import { LineChart, DonutChart } from "../../charts";
import { THRESHOLDS, COLORS } from "../../../config/constants";
import { formatNumber } from "../../../utils/formatters";
import { RiAlertLine } from "@remixicon/react";

export default function ErrorRateCard() {
  const { data, isLoading, error } = useErrorRate();

  const lineData = data?.trendData
    ? [
        {
          id: "Error %",
          data: data.trendData.map((d) => ({ x: d.date, y: d.value })),
        },
      ]
    : [];
  const trendPoints = lineData[0]?.data ?? [];
  const hasTrendPoints = trendPoints.length > 0;
  const hasNonZeroTrend = trendPoints.some((p) => Number(p.y) > 0);

  const donutData =
    data?.byCategory?.map((c) => ({
      id: c.category,
      label: c.category,
      value: c.count,
    })) ?? [];
  const hasCategoryData = donutData.some((d) => (d.value ?? 0) > 0);
  const showNoDataSummary = !hasNonZeroTrend && !hasCategoryData;

  const alerting = data?.current > THRESHOLDS.ERROR_RATE.warning;

  return (
    <div className="flex flex-col gap-4">
      <KpiCard
        title="Global Error Rate"
        value={data ? `${data.current}%` : "-"}
        subtitle={
          data ? `${formatNumber(data.totalErrors)} total errors` : undefined
        }
        trend={data?.trend ? Number(data.trend) : undefined}
        icon={RiAlertLine}
        loading={isLoading}
        className={alerting ? "border-red-300 bg-red-50/30" : ""}
      />

      <MetricCard
        title="M17 - Error Rate Trend & Breakdown"
        subtitle="Error rate over time + category distribution"
        loading={isLoading}
        error={error}
      >
        {showNoDataSummary && (
          <div className="mb-3 rounded-lg border border-dashed border-gray-300 bg-gray-50 px-3 py-2">
            <p className="text-xs font-medium text-gray-700">
              No error activity for selected range
            </p>
            <p className="text-xs text-gray-500 mt-0.5">
              Trend and category breakdown are empty or 0%.
            </p>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Trend line */}
          <div style={{ height: 200 }}>
            {hasTrendPoints && hasNonZeroTrend ? (
              <LineChart
                data={lineData}
                yLabel="%"
                yFormat={(v) => `${v}%`}
                colors={[alerting ? COLORS.danger : COLORS.warning]}
                enableArea
                enablePoints={lineData[0]?.data?.length <= 14}
                maxXTicks={8}
                axisBottomTickRotation={-55}
                margin={{ top: 10, right: 16, bottom: 64, left: 48 }}
              />
            ) : (
              <div className="h-full flex items-center justify-center rounded-lg border border-dashed border-gray-200 bg-gray-50/60">
                <p className="text-xs text-gray-500">
                  {hasTrendPoints
                    ? "Error trend is 0% across selected range"
                    : "No trend data for selected range"}
                </p>
              </div>
            )}
          </div>

          {/* Category donut */}
          <div style={{ height: 200 }}>
            <div className="h-full rounded-lg border border-gray-100 bg-gray-50/30 p-2">
              <div className="h-32">
                <DonutChart
                  data={donutData}
                  colors={COLORS.chart}
                  innerRadius={0.5}
                  enableArcLinkLabels={false}
                  enableArcLabels={false}
                  margin={{ top: 8, right: 8, bottom: 8, left: 8 }}
                  valueFormat={(v) => formatNumber(v)}
                  emptyText="Fail Empty - No category breakdown available"
                />
              </div>

              {hasCategoryData && (
                <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1">
                  {donutData.map((d, i) => (
                    <div
                      key={d.id}
                      className="inline-flex items-center gap-1.5 text-xs text-gray-700"
                    >
                      <span
                        className="w-2.5 h-2.5 rounded-full"
                        style={{
                          backgroundColor:
                            COLORS.chart[i % COLORS.chart.length],
                        }}
                      />
                      <span className="font-medium">{d.label}</span>
                      <span className="text-gray-500">
                        ({formatNumber(d.value)})
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </MetricCard>
    </div>
  );
}
