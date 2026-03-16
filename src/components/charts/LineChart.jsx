import { ResponsiveLine } from "@nivo/line";
import { nivoTheme } from "../../config/chartTheme";

export default function LineChart({
  data,
  xLabel = "",
  yLabel = "",
  enableArea = false,
  curve = "monotoneX",
  colors,
  enablePoints = true,
  yFormat,
  xTickValues,
  maxXTicks = 10,
  axisBottomTickRotation = 0,
  margin = { top: 20, right: 24, bottom: 50, left: 52 },
  ...rest
}) {
  const firstSeries = Array.isArray(data?.[0]?.data) ? data[0].data : [];
  let computedTickValues = xTickValues;

  if (
    !computedTickValues &&
    typeof maxXTicks === "number" &&
    maxXTicks > 0 &&
    firstSeries.length > maxXTicks
  ) {
    const step = Math.ceil(firstSeries.length / maxXTicks);
    computedTickValues = firstSeries
      .filter((_, idx) => idx % step === 0 || idx === firstSeries.length - 1)
      .map((pt) => pt.x);

    // Keep point-scale ticks unique while preserving order.
    computedTickValues = [...new Set(computedTickValues)];
  }

  return (
    <ResponsiveLine
      data={data}
      theme={nivoTheme}
      margin={margin}
      xScale={{ type: "point" }}
      yScale={{ type: "linear", min: "auto", max: "auto", stacked: false }}
      curve={curve}
      axisBottom={{
        tickSize: 4,
        tickPadding: 8,
        tickRotation: axisBottomTickRotation,
        tickValues: computedTickValues,
        legend: xLabel,
        legendOffset: 40,
        legendPosition: "middle",
      }}
      axisLeft={{
        tickSize: 4,
        tickPadding: 8,
        legend: yLabel,
        legendOffset: -44,
        legendPosition: "middle",
        format: yFormat,
      }}
      enableArea={enableArea}
      areaOpacity={0.08}
      colors={colors || { scheme: "category10" }}
      pointSize={enablePoints ? 6 : 0}
      pointColor={{ theme: "background" }}
      pointBorderWidth={2}
      pointBorderColor={{ from: "serieColor" }}
      useMesh
      enableSlices="x"
      animate
      motionConfig="gentle"
      {...rest}
    />
  );
}
