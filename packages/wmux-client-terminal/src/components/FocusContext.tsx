/** @jsxImportSource @opentui/react */
import { createContext, useContext, useRef, type ReactNode, type MutableRefObject } from "react";

// ── Prefix key context ─────────────────────────────────────
// Uses a ref so both WmuxApp and WmuxTerminal can read the
// prefix state synchronously within the same useKeyboard tick.

interface PrefixContextValue {
  /** True when Ctrl+B was pressed and control mode is active */
  readonly prefixRef: MutableRefObject<boolean>;
  readonly searchOpenRef: MutableRefObject<boolean>;
  readonly activeTabId: string;
}

const PrefixContext = createContext<PrefixContextValue>({
  prefixRef: { current: false },
  searchOpenRef: { current: false },
  activeTabId: "",
});

export const PrefixProvider = ({
  prefixRef,
  searchOpenRef,
  activeTabId,
  children,
}: {
  readonly prefixRef: MutableRefObject<boolean>;
  readonly searchOpenRef: MutableRefObject<boolean>;
  readonly activeTabId: string;
  readonly children: ReactNode;
}): ReactNode => (
  <PrefixContext.Provider value={{ prefixRef, searchOpenRef, activeTabId }}>
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
