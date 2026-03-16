import { ResponsiveBar } from "@nivo/bar";
import { nivoTheme } from "../../config/chartTheme";

/**
 * Horizontal bar chart - good for "Top N" rankings
 */
export default function HorizontalBarChart({
  data,
  keys,
  indexBy = "label",
  colors,
  xLabel = "",
  enableLabel = true,
  labelTextColor = { from: "color", modifiers: [["darker", 1.6]] },
  margin = { top: 10, right: 24, bottom: 40, left: 140 },
  ...rest
}) {
  return (
    <ResponsiveBar
      data={data}
      keys={keys}
      indexBy={indexBy}
      theme={nivoTheme}
      margin={margin}
      layout="horizontal"
      padding={0.35}
      valueScale={{ type: "linear" }}
      indexScale={{ type: "band", round: true }}
      colors={colors || { scheme: "category10" }}
      borderRadius={3}
      axisBottom={{
        tickSize: 4,
        tickPadding: 8,
        legend: xLabel,
        legendPosition: "middle",
        legendOffset: 32,
      }}
      axisLeft={{
        tickSize: 0,
        tickPadding: 8,
      }}
      enableLabel={enableLabel}
      labelSkipWidth={12}
      labelTextColor={labelTextColor}
      animate
      motionConfig="gentle"
      {...rest}
    />
  );
}
