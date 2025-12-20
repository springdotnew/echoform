import type React from "react";
import type { Views } from "../shared/types";

export type ViewsToServerComponents<ViewsToTransform extends Views> = {
  readonly [ViewName in keyof ViewsToTransform]: React.FunctionComponent<
    ViewsToTransform[ViewName]["props"]
  >;
};
