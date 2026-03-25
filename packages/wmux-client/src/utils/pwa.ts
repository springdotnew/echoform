import { useState, useEffect } from "react";

/** Returns true when the app is running as an installed PWA (standalone mode). */
export const isStandaloneMode: boolean =
  window.matchMedia("(display-mode: standalone)").matches ||
  (navigator as unknown as { standalone?: boolean }).standalone === true;

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

let deferredPrompt: BeforeInstallPromptEvent | null = null;
const listeners = new Set<() => void>();

function notify(): void {
  for (const fn of listeners) fn();
}

window.addEventListener("beforeinstallprompt", (e) => {
  e.preventDefault();
  deferredPrompt = e as BeforeInstallPromptEvent;
  notify();
});

window.addEventListener("appinstalled", () => {
  deferredPrompt = null;
  notify();
});

export function usePwaInstall(): { canInstall: boolean; install: () => void } {
  const [canInstall, setCanInstall] = useState(deferredPrompt != null);

  useEffect(() => {
    const update = (): void => setCanInstall(deferredPrompt != null);
    listeners.add(update);
    update();
    return () => { listeners.delete(update); };
  }, []);

  const install = (): void => {
    deferredPrompt?.prompt();
    deferredPrompt?.userChoice.then(() => {
      deferredPrompt = null;
      notify();
    });
  };

  return { canInstall, install };
}
