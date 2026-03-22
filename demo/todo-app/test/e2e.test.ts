import { describe, test, expect, beforeAll, afterAll } from "bun:test";
import type { Transport, AppEvents, ExistingSharedViewData, Prop } from "@react-fullstack/fullstack/shared";
import { decompileTransport } from "@react-fullstack/fullstack/shared";

const PORT = 4202;
const WS_URL = `ws://localhost:${PORT}/ws`;

interface TestClient {
  readonly connect: () => Promise<void>;
  readonly disconnect: () => void;
  readonly getViews: () => ReadonlyArray<ExistingSharedViewData>;
  readonly waitForUpdate: (timeout?: number) => Promise<void>;
  readonly waitForMultipleUpdates: (count: number, timeout?: number) => Promise<void>;
  readonly requestViewsTree: () => void;
  readonly callEvent: (eventUid: string, ...args: readonly unknown[]) => Promise<unknown>;
}

function createTestClient(): TestClient {
  const handlers = new Map<string, Set<(data: unknown) => void>>();
  let ws: WebSocket | null = null;
  let views: ExistingSharedViewData[] = [];
  let updateResolvers: Array<() => void> = [];
  const responseResolvers = new Map<string, (data: unknown) => void>();

  const rawTransport: Transport<Record<string, unknown>> = {
    on: (event, handler) => {
      const eventHandlers = handlers.get(event as string) ?? new Set();
      eventHandlers.add(handler as (data: unknown) => void);
      handlers.set(event as string, eventHandlers);
    },
    emit: (event, data) => {
      if (ws?.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ event, data }));
      }
    },
    off: (event, handler) => {
      const eventHandlers = handlers.get(event as string);
      if (eventHandlers) {
        eventHandlers.delete(handler as (data: unknown) => void);
      }
    },
  };

  const transport = decompileTransport(rawTransport);

  function notifyHandlers(event: string, data: unknown): void {
    const eventHandlers = handlers.get(event);
    if (eventHandlers) {
      for (const handler of eventHandlers) {
        handler(data);
      }
    }
  }

  function applyViewUpdate(view: AppEvents["update_view"]["view"]): void {
    const existingIndex = views.findIndex((v) => v.uid === view.uid);

    if (existingIndex >= 0) {
      const existingView = views[existingIndex];
      if (!existingView) return;

      const deletedNames = new Set(view.props.delete);
      const createNames = new Set(view.props.create.map((prop) => prop.name));

      const filteredProps = existingView.props.filter(
        (prop) => !deletedNames.has(prop.name) && !createNames.has(prop.name)
      );

      const updatedProps: ReadonlyArray<Prop> = [...filteredProps, ...view.props.create];

      views[existingIndex] = {
        ...existingView,
        props: updatedProps,
      };
    } else {
      views.push({
        uid: view.uid,
        name: view.name,
        parentUid: view.parentUid,
        childIndex: view.childIndex,
        isRoot: view.isRoot,
        props: view.props.create,
      });
    }

    for (const resolver of updateResolvers) {
      resolver();
    }
    updateResolvers = [];
  }

  function setupHandlers(): void {
    transport.on("update_views_tree", (data) => {
      views = [...data.views];
      for (const resolver of updateResolvers) {
        resolver();
      }
      updateResolvers = [];
    });

    transport.on("update_view", (data) => {
      applyViewUpdate(data.view);
    });

    transport.on("delete_view", (data) => {
      views = views.filter((v) => v.uid !== data.viewUid);
      for (const resolver of updateResolvers) {
        resolver();
      }
      updateResolvers = [];
    });

    transport.on("respond_to_event", (data) => {
      const resolver = responseResolvers.get(data.uid as string);
      if (resolver) {
        resolver(data.data);
        responseResolvers.delete(data.uid as string);
      }
    });
  }

  function connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      ws = new WebSocket(WS_URL);

      ws.onopen = () => {
        setupHandlers();
        resolve();
      };

      ws.onmessage = (event) => {
        try {
          const { event: eventName, data } = JSON.parse(event.data as string) as {
            event: string;
            data: unknown;
          };
          notifyHandlers(eventName, data);
        } catch {
          // Ignore parse errors
        }
      };

      ws.onerror = () => {
        reject(new Error("WebSocket connection error"));
      };

      ws.onclose = () => {};
    });
  }

  function disconnect(): void {
    ws?.close();
    ws = null;
  }

  function getViews(): ReadonlyArray<ExistingSharedViewData> {
    return views;
  }

  function waitForUpdate(timeout = 1000): Promise<void> {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        const idx = updateResolvers.indexOf(resolver);
        if (idx >= 0) updateResolvers.splice(idx, 1);
        reject(new Error("Timeout waiting for update"));
      }, timeout);

      const resolver = (): void => {
        clearTimeout(timer);
        resolve();
      };
      updateResolvers.push(resolver);
    });
  }

  async function waitForMultipleUpdates(count: number, timeout = 2000): Promise<void> {
    const startTime = Date.now();
    let received = 0;

    while (received < count && Date.now() - startTime < timeout) {
      try {
        await waitForUpdate(timeout - (Date.now() - startTime));
        received++;
      } catch {
        break;
      }
    }
  }

  function requestViewsTree(): void {
    transport.emit("request_views_tree");
  }

  function callEvent(eventUid: string, ...args: readonly unknown[]): Promise<unknown> {
    return new Promise((resolve) => {
      const requestUid = crypto.randomUUID();
      responseResolvers.set(requestUid, resolve);

      transport.emit("request_event", {
        eventArguments: args,
        eventUid: eventUid,
        uid: requestUid,
      } as unknown as AppEvents["request_event"]);
    });
  }

  return { connect, disconnect, getViews, waitForUpdate, waitForMultipleUpdates, requestViewsTree, callEvent };
}

function getViewProp(view: ExistingSharedViewData, propName: string): Prop | undefined {
  return view.props.find((p) => p.name === propName);
}

function getDataPropValue(view: ExistingSharedViewData, propName: string): unknown {
  const prop = getViewProp(view, propName);
  if (prop?.type === "data") {
    return prop.data;
  }
  return undefined;
}

function getEventPropUid(view: ExistingSharedViewData, propName: string): string | undefined {
  const prop = getViewProp(view, propName);
  if (prop?.type === "event") {
    return prop.uid;
  }
  return undefined;
}

describe("Todo App E2E", () => {
  let serverProcess: Awaited<ReturnType<typeof Bun.spawn>> | null = null;
  let client: TestClient;

  beforeAll(async () => {
    serverProcess = Bun.spawn(["bun", "run", "server/index.tsx"], {
      cwd: import.meta.dir + "/..",
      env: { ...process.env, PORT: String(PORT) },
      stdout: "pipe",
      stderr: "pipe",
    });

    await new Promise((resolve) => setTimeout(resolve, 1000));

    client = createTestClient();
    await client.connect();
  });

  afterAll(() => {
    client?.disconnect();
    serverProcess?.kill();
  });

  test("should receive initial view tree on request", async () => {
    const updatePromise = client.waitForUpdate();
    client.requestViewsTree();
    await updatePromise;

    const views = client.getViews();
    expect(views.length).toBeGreaterThan(0);

    const todoApp = views.find((v) => v.name === "TodoApp");
    expect(todoApp).toBeDefined();

    if (todoApp) {
      expect(getDataPropValue(todoApp, "title")).toBe("Todo List");
      expect(getDataPropValue(todoApp, "itemCount")).toBe(2);
    }
  });

  test("should update view when adding a todo", async () => {
    const views = client.getViews();
    const todoInput = views.find((v) => v.name === "TodoInput");
    expect(todoInput).toBeDefined();
    if (!todoInput) return;

    const onAddUid = getEventPropUid(todoInput, "onAdd");
    expect(onAddUid).toBeDefined();
    if (!onAddUid) return;

    const updatePromise = client.waitForUpdate();
    await client.callEvent(onAddUid, "New test todo");
    await updatePromise;

    const updatedViews = client.getViews();
    const todoApp = updatedViews.find((v) => v.name === "TodoApp");
    expect(todoApp).toBeDefined();

    if (todoApp) {
      expect(getDataPropValue(todoApp, "itemCount")).toBe(3);
    }
  });

  test("should update view when toggling a todo", async () => {
    const views = client.getViews();
    const todoItems = views.filter((v) => v.name === "TodoItem");
    expect(todoItems.length).toBeGreaterThan(0);

    const firstTodoItem = todoItems[0];
    if (!firstTodoItem) return;

    const onToggleUid = getEventPropUid(firstTodoItem, "onToggle");
    expect(onToggleUid).toBeDefined();
    if (!onToggleUid) return;

    const updatePromise = client.waitForUpdate();
    await client.callEvent(onToggleUid);
    await updatePromise;

    const updatedViews = client.getViews();
    const updatedTodoApp = updatedViews.find((v) => v.name === "TodoApp");

    if (updatedTodoApp) {
      expect(getDataPropValue(updatedTodoApp, "completedCount")).toBe(1);
    }
  });

  test("should update view when deleting a todo", async () => {
    await new Promise((resolve) => setTimeout(resolve, 100));

    let views = client.getViews();
    let todoApp = views.find((v) => v.name === "TodoApp");
    const initialCount = getDataPropValue(todoApp!, "itemCount") as number;

    const todoItems = views.filter((v) => v.name === "TodoItem");
    const lastTodoItem = todoItems[todoItems.length - 1];
    if (!lastTodoItem) return;

    const onDeleteUid = getEventPropUid(lastTodoItem, "onDelete");
    expect(onDeleteUid).toBeDefined();
    if (!onDeleteUid) return;

    await client.callEvent(onDeleteUid);
    await client.waitForMultipleUpdates(3, 2000);

    views = client.getViews();
    todoApp = views.find((v) => v.name === "TodoApp");

    if (todoApp) {
      expect(getDataPropValue(todoApp, "itemCount")).toBe(initialCount - 1);
    }
  });
});
