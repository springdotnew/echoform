import { createContext, useContext, useRef, type ReactNode, type MutableRefObject } from "react";

// ── Prefix key context ─────────────────────────────────────
// Uses a ref so both WmuxApp and WmuxTerminal can read the
// prefix state synchronously within the same useKeyboard tick.

interface PrefixContextValue {
  /** True when Ctrl+B was just pressed and the next key is a TUI command */
  readonly prefixRef: MutableRefObject<boolean>;
  readonly activeTabId: string;
}

const PrefixContext = createContext<PrefixContextValue>({
  prefixRef: { current: false },
  activeTabId: "",
});

export const PrefixProvider = ({
  prefixRef,
  activeTabId,
  children,
}: {
  readonly prefixRef: MutableRefObject<boolean>;
  readonly activeTabId: string;
  readonly children: ReactNode;
}): ReactNode => (
  <PrefixContext.Provider value={{ prefixRef, activeTabId }}>
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
