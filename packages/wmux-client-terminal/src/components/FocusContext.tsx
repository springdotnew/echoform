/** @jsxImportSource @opentui/react */
import { createContext, useContext, type ReactNode, type MutableRefObject } from "react";

// ── Prefix key context ─────────────────────────────────────
// Uses a ref so both WmuxApp and WmuxTerminal can read the
// prefix state synchronously within the same useKeyboard tick.

interface PrefixContextValue {
  /** True when Ctrl+B was pressed and control mode is active */
  readonly prefixRef: MutableRefObject<boolean>;
  readonly searchOpenRef: MutableRefObject<boolean>;
  readonly hasSelectionRef: MutableRefObject<boolean>;
  readonly activeTabId: string;
  readonly hasSelection: boolean;
}

const PrefixContext = createContext<PrefixContextValue>({
  prefixRef: { current: false },
  searchOpenRef: { current: false },
  hasSelectionRef: { current: false },
  activeTabId: "",
  hasSelection: false,
});

export const PrefixProvider = ({
  prefixRef,
  searchOpenRef,
  hasSelectionRef,
  activeTabId,
  hasSelection,
  children,
}: {
  readonly prefixRef: MutableRefObject<boolean>;
  readonly searchOpenRef: MutableRefObject<boolean>;
  readonly hasSelectionRef: MutableRefObject<boolean>;
  readonly activeTabId: string;
  readonly hasSelection: boolean;
  readonly children: ReactNode;
}): ReactNode => (
  <PrefixContext.Provider value={{ prefixRef, searchOpenRef, hasSelectionRef, activeTabId, hasSelection }}>
    {children}
  </PrefixContext.Provider>
);

export const usePrefixContext = (): PrefixContextValue => useContext(PrefixContext);

// ── TUI-level config context (web URL, etc.) ───────────────

interface TUIContextValue {
  readonly webUrl?: string;
}

const TUIContext = createContext<TUIContextValue>({});

export const TUIProvider = ({
  webUrl,
  children,
}: {
  readonly webUrl?: string;
  readonly children: ReactNode;
}): ReactNode => (
  <TUIContext.Provider value={{ webUrl }}>
    {children}
  </TUIContext.Provider>
);

export const useTUIContext = (): TUIContextValue => useContext(TUIContext);
