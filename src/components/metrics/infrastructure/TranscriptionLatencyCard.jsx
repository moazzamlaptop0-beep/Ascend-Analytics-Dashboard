import { useTranscriptionLatency } from "../../../hooks/useDashboardData";
import { MetricCard } from "../../ui";
import { THRESHOLDS, COLORS } from "../../../config/constants";

export default function TranscriptionLatencyCard() {
  const { data, isLoading, error } = useTranscriptionLatency();

  const vendors = data?.vendors ?? [];
  const overallP90 = data?.overallP90;
  const p90Warning = overallP90 > THRESHOLDS.TRANSCRIPTION_P90.warning;
  const maxScale = Math.max(
    ...vendors.map((v) => v.max || 0),
    overallP90 || 0,
    1,
  );

  return (
    <MetricCard
      title="M14 - Avg Transcription Latency"
      subtitle="P90 latency by vendor (seconds)"
      loading={isLoading}
      error={error}
    >
      <div className="flex flex-col gap-4">
        {/* Overall P90 */}
        <div className="flex items-center gap-3">
          <span
            className={`text-2xl font-bold ${p90Warning ? "text-red-600" : "text-gray-900"}`}
          >
            {data?.overallP90Formatted || `${overallP90 ?? "-"}s`}
          </span>
          <span className="text-xs text-gray-400">overall P90</span>
          {p90Warning && (
            <span className="text-xs text-red-500 bg-red-50 px-2 py-0.5 rounded font-medium">
              ⚠ Above {THRESHOLDS.TRANSCRIPTION_P90.warning}s threshold
            </span>
          )}
        </div>

        {/* Vendor breakdown - custom box-plot-like bars */}
        <div className="space-y-3">
          {vendors.map((v) => {
            const toPercent = (val) => Math.min((val / maxScale) * 100, 100);
            const vendorP90Alert = v.p90 > THRESHOLDS.TRANSCRIPTION_P90.warning;

            return (
              <div key={v.vendor}>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-medium text-gray-700">
                    {v.vendor}
                  </span>
                  <span
                    className={`text-xs font-semibold ${vendorP90Alert ? "text-red-600" : "text-gray-600"}`}
                  >
                    P90: {v.p90Formatted || `${v.p90}s`}
                  </span>
                </div>
                <div className="relative w-full h-4 bg-gray-100 rounded-full overflow-hidden">
                  {/* Full range (min to max) */}
                  <div
                    className="absolute h-full bg-gray-200 rounded-full"
                    style={{
                      left: `${toPercent(v.min)}%`,
                      width: `${toPercent(v.max) - toPercent(v.min)}%`,
                    }}
                  />
                  {/* IQR (p25 to p75) */}
                  <div
                    className="absolute h-full rounded"
                    style={{
                      left: `${toPercent(v.p25)}%`,
                      width: `${toPercent(v.p75) - toPercent(v.p25)}%`,
                      backgroundColor: vendorP90Alert
                        ? COLORS.danger
                        : COLORS.primary,
                      opacity: 0.6,
                    }}
                  />
                  {/* Median line */}
                  <div
                    className="absolute h-full w-0.5 bg-gray-800"
                    style={{ left: `${toPercent(v.median)}%` }}
                  />
                  {/* P90 marker */}
                  <div
                    className="absolute h-full w-0.5"
                    style={{
                      left: `${toPercent(v.p90)}%`,
                      backgroundColor: vendorP90Alert
                        ? COLORS.danger
                        : COLORS.warning,
                    }}
                  />
                </div>
              </div>
            );
          })}
        </div>

        {/* Legend */}
        <div className="flex items-center gap-4 text-[10px] text-gray-400 mt-1">
          <span className="flex items-center gap-1">
            <span className="w-3 h-1.5 bg-gray-200 rounded" /> Range
          </span>
          <span className="flex items-center gap-1">
            <span className="w-3 h-1.5 bg-blue-400 rounded opacity-60" /> IQR
          </span>
          <span className="flex items-center gap-1">
            <span className="w-3 h-0.5 bg-gray-800" /> Median
          </span>
          <span className="flex items-center gap-1">
            <span className="w-3 h-0.5 bg-amber-500" /> P90
          </span>
        </div>
      </div>
    </MetricCard>
  );
}
