import { useDropRate } from "../../../hooks/useDashboardData";
import { KpiCard, MetricCard } from "../../ui";
import { HorizontalBarChart } from "../../charts";
import { THRESHOLDS, COLORS } from "../../../config/constants";
import { RiSignalWifiOffLine } from "@remixicon/react";

export default function DropRateCard() {
  const { data, isLoading, error } = useDropRate();

  const barData =
    data?.byInsurance?.slice(0, 8).map((d) => ({
      label: d.insurance,
      "Drop Rate": d.dropRate,
    })) ?? [];

  return (
    <div className="flex flex-col gap-4">
      <KpiCard
        title="Call Drop Rate"
        value={data ? `${data.overall}%` : "-"}
        subtitle="Overall across all insurances"
        trend={data?.trend ? Number(data.trend) : undefined}
        icon={RiSignalWifiOffLine}
        loading={isLoading}
        className={
          data?.overall > THRESHOLDS.DROP_RATE.warning
            ? "border-red-300 bg-red-50/30"
            : ""
        }
      />

      <MetricCard
        title="M3 - Drop Rate by Insurance"
        subtitle="Top 8 insurances by drop rate %"
        loading={isLoading}
        error={error}
      >
        <div style={{ height: 260 }}>
          <HorizontalBarChart
            data={barData}
            keys={["Drop Rate"]}
            indexBy="label"
            xLabel="Drop %"
            colors={(d) =>
              d.data["Drop Rate"] > THRESHOLDS.DROP_RATE.warning
                ? COLORS.danger
                : COLORS.primary
            }
            enableLabel
            labelTextColor="#ffffff"
            margin={{ top: 10, right: 24, bottom: 40, left: 120 }}
          />
        </div>
      </MetricCard>
    </div>
  );
}
