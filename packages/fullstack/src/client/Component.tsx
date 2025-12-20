import type { TransformViewProps } from "./types";
import type { View as ViewType, ViewProps } from "../shared/types";

/**
 * Type helper for creating view component props.
 * Use this to type your functional component props when implementing views.
 *
 * @example
 * ```tsx
 * import { ViewComponentProps } from "@react-fullstack/fullstack/client";
 *
 * const Login: React.FC<ViewComponentProps<typeof Views["Login"]>> = (props) => {
 *   // props are properly typed based on the view definition
 * };
 * ```
 */
export type ViewComponentProps<View extends ViewType<ViewProps>> = TransformViewProps<View["props"]>;
