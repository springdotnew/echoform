import type {
  ExistingSharedViewData,
  Prop,
  SerializableValue,
} from "@playfast/echoform";

const MAX_DEPTH = 12;
const MAX_NODES = 200;

type ViewUidValue = ExistingSharedViewData["uid"];
type PropNameValue = Prop["name"];
type EventUidValue = Extract<Prop, { readonly type: "event" }>["uid"];

interface PluginElement {
  readonly $$type: "widget.element";
  readonly type: string;
  readonly props?: Readonly<Record<string, unknown>>;
  readonly children?: readonly PluginNode[];
}

type PluginNode = PluginElement | string | number | boolean | null | undefined;

function isPluginElement(value: unknown): value is PluginElement {
  return (
    typeof value === "object" &&
    value !== null &&
    (value as { readonly $$type?: unknown }).$$type === "widget.element" &&
    typeof (value as { readonly type?: unknown }).type === "string"
  );
}

function isEventMarker(value: unknown): value is { readonly $$event: string } {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof (value as { readonly $$event?: unknown }).$$event === "string"
  );
}

function toViewUid(value: string): ViewUidValue {
  return value as ViewUidValue;
}

function toPropName(value: string): PropNameValue {
  return value as PropNameValue;
}

function toEventUid(value: string): EventUidValue {
  return value as EventUidValue;
}

function serializableProp(value: unknown): SerializableValue {
  if (value === undefined) return undefined;
  return JSON.parse(JSON.stringify(value)) as SerializableValue;
}

function normalizeTextNode(value: string | number | boolean): PluginElement {
  return {
    $$type: "widget.element",
    type: "TextBlock",
    props: {
      text: String(value),
      tone: "default",
    },
    children: [],
  };
}

function normalizeChildren(children: readonly PluginNode[] | undefined): readonly PluginElement[] {
  const normalized: PluginElement[] = [];
  for (const child of children ?? []) {
    if (Array.isArray(child)) {
      normalized.push(...normalizeChildren(child as readonly PluginNode[]));
    } else if (isPluginElement(child)) {
      normalized.push(child);
    } else if (typeof child === "string" || typeof child === "number" || typeof child === "boolean") {
      normalized.push(normalizeTextNode(child));
    }
  }
  return normalized;
}

function buildProps(widgetId: string, props: Readonly<Record<string, unknown>> | undefined): readonly Prop[] {
  return Object.entries(props ?? {}).map(([name, value]) => {
    if (isEventMarker(value)) {
      return {
        name: toPropName(name),
        type: "event",
        uid: toEventUid(`plugin:${widgetId}:${value.$$event}`),
      };
    }

    return {
      name: toPropName(name),
      type: "data",
      data: serializableProp(value),
    };
  });
}

export function pluginTreeToViews(widgetId: string, root: unknown): readonly ExistingSharedViewData[] {
  if (!isPluginElement(root)) {
    throw new Error("Plugin component must return a widget UI element.");
  }

  const views: ExistingSharedViewData[] = [];
  let nodeCount = 0;

  const visit = (node: PluginElement, path: string, parentPath: string | null, childIndex: number, depth: number): void => {
    nodeCount += 1;
    if (nodeCount > MAX_NODES) throw new Error(`Plugin rendered more than ${MAX_NODES} nodes.`);
    if (depth > MAX_DEPTH) throw new Error(`Plugin rendered deeper than ${MAX_DEPTH} levels.`);

    const uid = toViewUid(`plugin:${widgetId}:${path}`);
    views.push({
      uid,
      name: node.type,
      parentUid: parentPath === null ? "" : toViewUid(`plugin:${widgetId}:${parentPath}`),
      childIndex,
      isRoot: parentPath === null,
      props: buildProps(widgetId, node.props),
    });

    normalizeChildren(node.children).forEach((child, index) => {
      visit(child, path === "root" ? String(index) : `${path}.${index}`, path, index, depth + 1);
    });
  };

  visit(root, "root", null, 0, 0);
  return views;
}
