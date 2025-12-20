import Reconciler from "react-reconciler";
import { DefaultEventPriority } from "react-reconciler/constants.js";
import type { ReactNode } from "react";

type Container = Record<string, never>;
type Instance = Record<string, never>;
type TextInstance = Record<string, never>;
type HostContext = null;

const hostConfig = {
  // Instance creation - return empty objects
  createInstance: () => ({}),
  createTextInstance: () => ({}),

  // Tree operations - no-op
  appendInitialChild: () => {},
  appendChild: () => {},
  appendChildToContainer: () => {},
  insertBefore: () => {},
  insertInContainerBefore: () => {},
  removeChild: () => {},
  removeChildFromContainer: () => {},

  // Configuration
  supportsMutation: true,
  isPrimaryRenderer: false,
  supportsPersistence: false,
  supportsHydration: false,

  // Required callbacks - minimal implementations
  finalizeInitialChildren: () => false,
  shouldSetTextContent: () => false,
  getRootHostContext: () => null,
  getChildHostContext: (ctx: HostContext) => ctx,
  getPublicInstance: (i: Instance) => i,
  prepareForCommit: () => null,
  resetAfterCommit: () => {},
  commitTextUpdate: () => {},
  commitUpdate: () => {},
  clearContainer: () => {},
  prepareUpdate: () => null,

  // Scheduling
  scheduleTimeout: setTimeout,
  cancelTimeout: clearTimeout,
  noTimeout: -1,
  supportsMicrotasks: true,
  scheduleMicrotask:
    typeof queueMicrotask === "function"
      ? queueMicrotask
      : (fn: () => void) => Promise.resolve().then(fn),
  getCurrentEventPriority: () => DefaultEventPriority,

  // Additional required methods
  preparePortalMount: () => {},
  getInstanceFromNode: () => null,
  beforeActiveInstanceBlur: () => {},
  afterActiveInstanceBlur: () => {},
  prepareScopeUpdate: () => {},
  getInstanceFromScope: () => null,
  detachDeletedInstance: () => {},
};

const reconciler = Reconciler(hostConfig);

export const Render = (element: ReactNode) => {
  const container = reconciler.createContainer(
    {} as Container,
    0, // ConcurrentRoot
    null, // hydrationCallbacks
    false, // isStrictMode
    null, // concurrentUpdatesByDefaultOverride
    "", // identifierPrefix
    (error: unknown) => console.error(error), // onUncaughtError
    null // transitionCallbacks
  );

  reconciler.updateContainer(element, container, null, () => {});

  return {
    stop: () => reconciler.updateContainer(null, container, null, () => {}),
    continue: () => reconciler.updateContainer(element, container, null, () => {}),
  };
};
