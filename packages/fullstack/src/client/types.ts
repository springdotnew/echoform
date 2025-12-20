import type React from "react";
import type { Views, ViewProps, SerializableValue } from "../shared/types";

/**
 * Maps view definitions to React component types.
 */
export type ViewsToComponents<ViewsToTransform extends Views> = {
  readonly [ViewName in keyof ViewsToTransform]:
    | React.ComponentClass<TransformViewProps<ViewsToTransform[ViewName]["props"]>>
    | React.FunctionComponent<TransformViewProps<ViewsToTransform[ViewName]["props"]>>;
};

/**
 * Transforms view props to client-side props where function results become promises.
 */
export type TransformViewProps<Props extends ViewProps> = {
  readonly [Key in keyof Props]: MapResultToPromise<Props[Key]>;
};

/**
 * Maps function return types to promises.
 * Non-function types are passed through unchanged.
 */
type MapResultToPromise<T> = T extends (...args: infer U) => infer R
  ? R extends Promise<SerializableValue>
    ? (...args: U) => R
    : (...args: U) => Promise<R>
  : T;
