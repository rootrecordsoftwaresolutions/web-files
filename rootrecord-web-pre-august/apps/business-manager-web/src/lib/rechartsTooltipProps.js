/** Recharts uses payload color for tooltip text; dark categories need explicit light copy. */
export const rechartsTooltipProps = {
  contentStyle: {
    background: "rgba(20, 28, 28, 0.96)",
    border: "1px solid rgba(255, 255, 255, 0.12)",
    borderRadius: 8,
    color: "#f8fafa",
  },
  itemStyle: { color: "#f8fafa" },
  labelStyle: { color: "#f8fafa" },
};
