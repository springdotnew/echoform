import React from "react";
import type { ViewData, ExistingSharedViewData, Transport, SerializableValue } from "../shared/types";
import type { ViewUid, StreamUid } from "../shared/branded.types";
export interface AppContextValue {
  readonly views: ReadonlyArray<ExistingSharedViewData>;
  readonly addClient: <TClientEvents extends Record<string | number, unknown>>(client: Transport<TClientEvents>) => void;
  readonly removeClient: <TClientEvents extends Record<string | number, unknown>>(client: Transport<TClientEvents>) => void;
  readonly updateRunningView: (viewData: ViewData) => void;
  readonly deleteRunningView: (uid: ViewUid) => void;
  readonly broadcastStreamChunk: (streamUid: StreamUid, chunk: SerializableValue) => void;
  readonly broadcastStreamEnd: (streamUid: StreamUid) => void;
}

export const AppContext = React.createContext<AppContextValue | undefined>(undefined);
