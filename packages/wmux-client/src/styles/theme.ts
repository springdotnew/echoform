// Deterministic category colors — same list as server
export const CATEGORY_COLORS = [
  "#3b82f6", // blue
  "#8b5cf6", // violet
  "#ec4899", // pink
  "#f97316", // orange
  "#14b8a6", // teal
  "#eab308", // yellow
  "#06b6d4", // cyan
  "#f43f5e", // rose
  "#84cc16", // lime
  "#a855f7", // purple
];

export const STATUS_COLORS: Record<string, string> = {
  running: "oklch(0.627 0.194 149.214)", // success green
  idle: "#3f3f46",
  stopped: "#52525b",
  failed: "oklch(0.704 0.191 22.216)", // destructive red
};
