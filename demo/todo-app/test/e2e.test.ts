import { describe, test, expect, beforeAll, afterAll } from "bun:test";
import type { Transport, AppEvents, ExistingSharedViewData, Prop } from "@react-fullstack/fullstack/shared";
import { decompileTransport } from "@react-fullstack/fullstack/shared";

const PORT = 3002;
const WS_URL = `ws://localhost:${PORT}/ws`;

interface TestClient {
  readonly connect: () => Promise<void>;
  readonly disconnect: () => void;
  readonly getViews: () => ReadonlyArray<ExistingSharedViewData>;
  readonly waitForUpdate: () => Promise<void>;
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
      console.log("[Client] Received update_views_tree, views count:", data.views.length);
      views = [...data.views];
      for (const resolver of updateResolvers) {
        resolver();
      }
      updateResolvers = [];
    });

    transport.on("update_view", (data) => {
      console.log("[Client] Received update_view:", data.view.name);
      applyViewUpdate(data.view);
    });

    transport.on("delete_view", (data) => {
      console.log("[Client] Received delete_view:", data.viewUid);
      views = views.filter((v) => v.uid !== data.viewUid);
      for (const resolver of updateResolvers) {
        resolver();
      }
      updateResolvers = [];
    });

    transport.on("respond_to_event", (data) => {
      console.log("[Client] Received respond_to_event:", data.uid);
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
          console.log(`[Client] Raw message: event=${eventName}`);
          notifyHandlers(eventName, data);
        } catch (e) {
          console.error("[Client] Error parsing message:", e);
        }
      };

      ws.onerror = () => {
        reject(new Error("WebSocket connection error"));
      };

      ws.onclose = () => {
        console.log("[Client] WebSocket closed");
      };
    });
  }

  function disconnect(): void {
    ws?.close();
    ws = null;
  }

  function getViews(): ReadonlyArray<ExistingSharedViewData> {
    return views;
  }

  function waitForUpdate(): Promise<void> {
    return new Promise((resolve) => {
      updateResolvers.push(resolve);
    });
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

  return { connect, disconnect, getViews, waitForUpdate, requestViewsTree, callEvent };
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
    console.log("[Test] Starting server...");

    serverProcess = Bun.spawn(["bun", "run", "server/index.tsx"], {
      cwd: import.meta.dir + "/..",
      env: { ...process.env, PORT: String(PORT) },
      stdout: "inherit",
      stderr: "inherit",
    });

    await new Promise((resolve) => setTimeout(resolve, 1000));

    client = createTestClient();
    await client.connect();
    console.log("[Test] Client connected");
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
    console.log("[Test] Initial views:", JSON.stringify(views, null, 2));

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

    console.log("[Test] Calling onAdd event with uid:", onAddUid);

    const updatePromise = client.waitForUpdate();

    await client.callEvent(onAddUid, "New test todo");

    await updatePromise;

    const updatedViews = client.getViews();
    console.log("[Test] Updated views after add:", JSON.stringify(updatedViews, null, 2));

    const todoApp = updatedViews.find((v) => v.name === "TodoApp");
    expect(todoApp).toBeDefined();

    if (todoApp) {
      const itemCount = getDataPropValue(todoApp, "itemCount");
      console.log("[Test] Item count after add:", itemCount);
      expect(itemCount).toBe(3);
    }
  });

  test("should update view when toggling a todo", async () => {
    const views = client.getViews();
    const todoItems = views.filter((v) => v.name === "TodoItem");

    console.log("[Test] Found TodoItems:", todoItems.length);
    expect(todoItems.length).toBeGreaterThan(0);

    const firstTodoItem = todoItems[0];
    if (!firstTodoItem) return;

    const initialCompleted = getDataPropValue(firstTodoItem, "completed");
    console.log("[Test] Initial completed state:", initialCompleted);

    const onToggleUid = getEventPropUid(firstTodoItem, "onToggle");
    expect(onToggleUid).toBeDefined();

    if (!onToggleUid) return;

    const updatePromise = client.waitForUpdate();

    await client.callEvent(onToggleUid);

    await updatePromise;

    const updatedViews = client.getViews();
    const updatedTodoApp = updatedViews.find((v) => v.name === "TodoApp");

    console.log("[Test] Updated TodoApp:", JSON.stringify(updatedTodoApp, null, 2));

    if (updatedTodoApp) {
      const completedCount = getDataPropValue(updatedTodoApp, "completedCount");
      console.log("[Test] Completed count after toggle:", completedCount);
      expect(completedCount).toBe(1);
    }
  });

  test("should update view when deleting a todo", async () => {
    let views = client.getViews();
    let todoApp = views.find((v) => v.name === "TodoApp");
    const initialCount = getDataPropValue(todoApp!, "itemCount") as number;

    console.log("[Test] Initial item count before delete:", initialCount);

    const todoItems = views.filter((v) => v.name === "TodoItem");
    const lastTodoItem = todoItems[todoItems.length - 1];

    if (!lastTodoItem) return;

    const onDeleteUid = getEventPropUid(lastTodoItem, "onDelete");
    expect(onDeleteUid).toBeDefined();

    if (!onDeleteUid) return;

    const updatePromise = client.waitForUpdate();

    await client.callEvent(onDeleteUid);

    await updatePromise;

    views = client.getViews();
    todoApp = views.find((v) => v.name === "TodoApp");

    console.log("[Test] Updated TodoApp after delete:", JSON.stringify(todoApp, null, 2));

    if (todoApp) {
      const itemCount = getDataPropValue(todoApp, "itemCount");
      console.log("[Test] Item count after delete:", itemCount);
      expect(itemCount).toBe(initialCount - 1);
    }
  });
});
