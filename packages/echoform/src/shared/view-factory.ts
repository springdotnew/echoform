import { createContext, type ReactElement, type ReactNode } from "react";
import type { ViewProps } from "./types";

export type ViewFactory = (name: string, props: ViewProps & { readonly children?: ReactNode }) => ReactElement;
export const ViewFactoryContext = createContext<ViewFactory | null>(null);
