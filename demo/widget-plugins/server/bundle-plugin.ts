import { build } from "esbuild";
import type { Plugin } from "esbuild";
import type { BundleResult } from "../shared/plugin-types";

const widgetUiModule = `
export const Stack = "Stack";
export const Section = "Section";
export const TextBlock = "TextBlock";
export const Badge = "Badge";
export const MetricCard = "MetricCard";
export const ProgressBar = "ProgressBar";
export const StatList = "StatList";
export const LineChart = "LineChart";
export const SparkBars = "SparkBars";
export const DataTable = "DataTable";
export const EditableTable = "EditableTable";
export const Timeline = "Timeline";
export const Notice = "Notice";
export const Checklist = "Checklist";
export const SegmentedControl = "SegmentedControl";
export const ToggleSwitch = "ToggleSwitch";
export const SliderControl = "SliderControl";
export const ActionButton = "ActionButton";
`;

const widgetUiPlugin: Plugin = {
  name: "widget-ui",
  setup(buildContext) {
    buildContext.onResolve({ filter: /^@widget\/ui$/ }, () => ({
      path: "widget-ui",
      namespace: "widget-ui",
    }));

    buildContext.onLoad({ filter: /.*/, namespace: "widget-ui" }, () => ({
      contents: widgetUiModule,
      loader: "js",
    }));
  },
};

function formatEsbuildError(error: unknown): string {
  if (error instanceof Error && "errors" in error) {
    const maybeErrors = (error as { readonly errors?: readonly { readonly text?: string; readonly location?: { readonly line: number; readonly column: number } | null }[] }).errors;
    if (maybeErrors && maybeErrors.length > 0) {
      return maybeErrors
        .map((item) => {
          const location = item.location ? `${item.location.line}:${item.location.column} ` : "";
          return `${location}${item.text ?? "Unknown bundling error"}`;
        })
        .join("\n");
    }
  }

  return error instanceof Error ? error.message : String(error);
}

export async function bundlePluginSource(widgetId: string, source: string): Promise<BundleResult> {
  try {
    const result = await build({
      stdin: {
        contents: source,
        loader: "tsx",
        resolveDir: ".",
        sourcefile: `${widgetId}.tsx`,
      },
      bundle: true,
      write: false,
      format: "iife",
      globalName: "__widgetModule",
      platform: "browser",
      target: "es2020",
      jsxFactory: "__widgetRuntime.h",
      jsxFragment: "__widgetRuntime.Fragment",
      plugins: [widgetUiPlugin],
      logLevel: "silent",
    });

    const output = result.outputFiles[0]?.text;
    if (!output) {
      return { ok: false, error: "Bundler produced no output.", warnings: [] };
    }

    const warnings = result.warnings.map((warning) => warning.text);
    const code = `${output}
if (!__widgetModule || typeof __widgetModule.default !== "function") {
  throw new Error("Plugin must export a default function component.");
}
globalThis.__widgetDefault = __widgetModule.default;`;

    return { ok: true, code, warnings };
  } catch (error) {
    return { ok: false, error: formatEsbuildError(error), warnings: [] };
  }
}
