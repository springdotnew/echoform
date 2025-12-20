import React from "react";
import type { ViewData, ExistingSharedViewData, Transport } from "../shared/types";
import type { ViewUid } from "../shared/branded.types";

export interface AppContextValue {
  readonly views: ReadonlyArray<ExistingSharedViewData>;
  readonly addClient: <TClientEvents extends Record<string | number, unknown>>(client: Transport<TClientEvents>) => void;
  readonly removeClient: <TClientEvents extends Record<string | number, unknown>>(client: Transport<TClientEvents>) => void;
  readonly updateRunningView: (viewData: ViewData) => void;
  readonly deleteRunningView: (uid: ViewUid) => void;
}

export const AppContext = React.createContext<AppContextValue | undefined>(undefined);
