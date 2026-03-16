import { useTranscriptionQueue } from "../../../hooks/useDashboardData";
import { KpiCard, ThresholdBar, MetricCard } from "../../ui";
import { LineChart } from "../../charts";
import { THRESHOLDS } from "../../../config/constants";
import { RiStackLine } from "@remixicon/react";
import { formatDuration } from "../../../utils/formatters";

export default function TranscriptionQueueCard() {
  const { data, isLoading, error } = useTranscriptionQueue();

  const lineData = data?.trendData
    ? [
        {
          id: "Queue",
          data: data.trendData.map((d) => ({ x: d.hour, y: d.value })),
        },
      ]
    : [];

  const alerting = data?.current > THRESHOLDS.TRANSCRIPTION_QUEUE.warning;
  const hasTrendData = (data?.trendData?.length ?? 0) > 0;
  const showHistoricalFallback =
    (data?.current ?? 0) === 0 && (data?.historicalPending ?? 0) > 0;

  return (
    <MetricCard
      title="M13 - Transcription Queue Length"
      subtitle="Items pending processing - refreshes every 30s"
      loading={isLoading}
      error={error}
      actions={
        <span className="inline-flex items-center gap-1.5 text-xs text-green-600 font-medium">
          <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse-live" />
          Live
        </span>
      }
    >
      <div className="flex flex-col gap-4">
        {/* Current queue stats */}
        <div className="flex items-center gap-6">
          <div>
            <p
              className={`text-3xl font-bold ${alerting ? "text-red-600" : "text-gray-900"}`}
            >
              {data?.current ?? "-"}
            </p>
            <p className="text-xs text-gray-400">items in queue</p>
          </div>
          <div>
            <p className="text-lg font-semibold text-gray-800">
              {data
                ? data.avgWaitFormatted || formatDuration(data.avgWaitSeconds)
                : "-"}
            </p>
            <p className="text-xs text-gray-400">avg wait time</p>
          </div>
        </div>

        {data && (
          <ThresholdBar
            value={data.current}
            max={THRESHOLDS.TRANSCRIPTION_QUEUE.warning * 1.5}
            label="Queue Capacity"
            warningThreshold={0.67}
          />
        )}

        {showHistoricalFallback && (
          <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2">
            <p className="text-xs font-medium text-amber-800">
              No pending items in last {data.lookbackDays} days
            </p>
            <p className="text-xs text-amber-700 mt-0.5">
              {data.historicalPending.toLocaleString()} historical pending
              records exist
            </p>
          </div>
        )}

        <div style={{ height: 160 }}>
          {hasTrendData ? (
            <LineChart
              data={lineData}
              yLabel="Items"
              colors={[alerting ? "#ef4444" : "#3b82f6"]}
              enableArea
              enablePoints={false}
              axisBottomTickRotation={-45}
            />
          ) : (
            <div className="h-full flex items-center justify-center rounded-lg border border-dashed border-gray-200 bg-gray-50/60">
              <p className="text-xs text-gray-500">
                No queue history for selected lookback window
              </p>
            </div>
          )}
        </div>
      </div>
    </MetricCard>
  );
}
