import React from "react";
import type { ViewData, ExistingSharedViewData, Transport } from "../shared";

export interface AppContextValue {
  views: ExistingSharedViewData[];
  addClient: (client: Transport<any>) => void;
  removeClient: (client: Transport<any>) => void;
  updateRunningView: (viewData: ViewData) => void;
  deleteRunningView: (uid: string) => void;
}

export const AppContext = React.createContext<AppContextValue | undefined>(undefined);
