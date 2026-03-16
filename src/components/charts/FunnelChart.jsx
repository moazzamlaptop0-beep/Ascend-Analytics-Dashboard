import { COLORS } from "../../config/constants";

/**
 * Funnel chart using plain SVG (Nivo doesn't have a built-in funnel).
 * Data format: [{ label: 'Step 1', value: 1200 }, ...]
 */
export default function FunnelChart({
  data = [],
  height = 260,
  barColor,
  showPercent = true,
}) {
  if (!data.length) return null;

  const maxValue = data[0].value;
  const palette = COLORS.chart;
  const shouldScroll = data.length > 6;

  return (
    <div
      className={`w-full ${shouldScroll ? "overflow-y-auto pr-1" : ""}`}
      style={{ height }}
    >
      <div
        className={`flex flex-col gap-2 ${
          shouldScroll ? "py-1" : "h-full justify-center"
        }`}
      >
        {data.map((step, i) => {
          const pct = maxValue > 0 ? (step.value / maxValue) * 100 : 0;
          const conversionPct =
            i > 0 && data[i - 1].value > 0
              ? ((step.value / data[i - 1].value) * 100).toFixed(1)
              : null;
          const color = barColor || palette[i % palette.length];

          return (
            <div key={step.label} className="flex items-center gap-3">
              {/* Label */}
              <div className="w-32 text-right text-xs text-gray-500 truncate">
                {step.label}
              </div>
              {/* Bar */}
              <div className="flex-1 relative h-7 bg-gray-50 rounded overflow-hidden">
                <div
                  className="h-full rounded transition-all duration-500"
                  style={{
                    width: `${pct}%`,
                    backgroundColor: color,
                    opacity: 1 - i * 0.08,
                  }}
                />
                <span className="absolute inset-0 flex items-center px-2 text-xs font-medium text-gray-800">
                  {step.value.toLocaleString()}
                  {showPercent && conversionPct && (
                    <span className="ml-auto text-gray-400 text-[10px]">
                      {conversionPct}% of prev
                    </span>
                  )}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
