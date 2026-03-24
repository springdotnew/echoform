import Reconciler from "react-reconciler";
import { DefaultEventPriority } from "react-reconciler/constants.js";
import type { ReactNode } from "react";

type Instance = Record<string, unknown>;
type HostContext = Record<string, unknown>;

let currentUpdatePriority: number = DefaultEventPriority;

const hostConfig = {
  createInstance: () => ({}),
  createTextInstance: () => ({}),

  appendInitialChild: () => {},
  appendChild: () => {},
  appendChildToContainer: () => {},
  insertBefore: () => {},
  insertInContainerBefore: () => {},
  removeChild: () => {},
  removeChildFromContainer: () => {},

  supportsMutation: true,
  isPrimaryRenderer: false,
  supportsPersistence: false,
  supportsHydration: false,

  finalizeInitialChildren: () => false,
  shouldSetTextContent: () => false,
  getRootHostContext: (): HostContext => ({}),
  getChildHostContext: (): HostContext => ({}),
  getPublicInstance: (instance: Instance): Instance => instance,
  prepareForCommit: (): null => null,
  resetAfterCommit: () => {},
  commitTextUpdate: () => {},
  commitUpdate: () => {},
  commitMount: () => {},
  clearContainer: () => {},

  prepareUpdate: () => true,

  scheduleTimeout: setTimeout,
  cancelTimeout: clearTimeout,
  noTimeout: -1 as const,
  supportsMicrotasks: true,
  scheduleMicrotask:
    typeof queueMicrotask === "function"
      ? queueMicrotask
      : (task: () => void) => { Promise.resolve().then(task); },
  getCurrentEventPriority: () => DefaultEventPriority,

  setCurrentUpdatePriority: (priority: number) => {
    currentUpdatePriority = priority;
  },
  getCurrentUpdatePriority: () => currentUpdatePriority,
  resolveUpdatePriority: () => currentUpdatePriority || DefaultEventPriority,

  preparePortalMount: () => {},
  getInstanceFromNode: () => null,
  beforeActiveInstanceBlur: () => {},
  afterActiveInstanceBlur: () => {},
  prepareScopeUpdate: () => {},
  getInstanceFromScope: () => null,
  detachDeletedInstance: () => {},

  hideInstance: () => {},
  unhideInstance: () => {},
  hideTextInstance: () => {},
  unhideTextInstance: () => {},
};

const reconciler = Reconciler(hostConfig);

export const Render = (element: ReactNode): { stop: () => void; continue: () => void } => {
  const container = reconciler.createContainer(
    {},
    0, // LegacyRoot
    null, // hydrationCallbacks
    false, // isStrictMode
    null, // concurrentUpdatesByDefaultOverride
    "", // identifierPrefix
    (error: unknown) => console.error(error), // onRecoverableError
    null // transitionCallbacks
  );

  const update = (element: ReactNode | null): void => {
    reconciler.updateContainer(element, container, null, () => {});
  };

  update(element);

  return {
    stop: () => update(null),
    continue: () => update(element),
  };
};
