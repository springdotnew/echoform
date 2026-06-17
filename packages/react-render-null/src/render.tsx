import Reconciler from "react-reconciler";
import { DefaultEventPriority } from "react-reconciler/constants.js";
import { createContext, type ReactNode } from "react";

type Instance = Record<string, unknown>;
type HostContext = Record<string, unknown>;
type InternalTransitionContext = Reconciler.ReactContext<null>;

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
  NotPendingTransition: null,
  HostTransitionContext: createContext(null) as unknown as InternalTransitionContext,

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
  resetFormInstance: () => {},
  requestPostPaintCallback: (callback: (time: number) => void) => {
    callback(performance.now());
  },
  shouldAttemptEagerTransition: () => false,
  trackSchedulerEvent: () => {},
  resolveEventType: () => null,
  resolveEventTimeStamp: () => performance.now(),
  maySuspendCommit: () => false,
  maySuspendCommitOnUpdate: () => false,
  maySuspendCommitInSyncRender: () => false,
  preloadInstance: () => true,
  startSuspendingCommit: () => {},
  suspendInstance: () => {},
  waitForCommitToBeReady: () => null,

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
    (error: Error) => console.error(error), // onUncaughtError
    (error: Error) => console.error(error), // onCaughtError
    (error: Error) => console.error(error), // onRecoverableError
    () => {}, // onDefaultTransitionIndicator
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
