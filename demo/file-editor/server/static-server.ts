import type { Transport } from "@react-fullstack/fullstack/shared";

interface ClientData {
  readonly id: string;
}

interface ServerWebSocket<T = unknown> {
  readonly data: T;
  readonly readyState: number;
  readonly remoteAddress: string;
  send(message: string | ArrayBuffer | Uint8Array, compress?: boolean): number;
  close(code?: number, reason?: string): void;
}

interface BunServer {
  readonly pendingWebSockets: number;
  publish(topic: string, data: string | ArrayBufferView | ArrayBuffer, compress?: boolean): number;
  upgrade(req: Request, options?: { headers?: HeadersInit; data?: ClientData }): boolean;
  stop(): void;
}

interface ClientState {
  readonly ws: ServerWebSocket<ClientData>;
  readonly handlers: Map<string, Set<(data: unknown) => void>>;
}

interface SocketClientEvents {
  readonly disconnect: void;
}

interface SocketServerEvents {
  readonly connection: Transport<SocketClientEvents> & { readonly id: string };
}

export interface FileEditorServerOptions {
  readonly port: number;
  readonly hostname?: string;
  readonly path?: string;
}

export interface FileEditorServer {
  readonly transport: Transport<SocketServerEvents>;
  readonly start: () => BunServer;
  readonly stop: () => void;
}

declare const Bun: {
  serve<T>(options: {
    port: number;
    hostname?: string;
    fetch(req: Request, server: BunServer): Response | undefined | Promise<Response | undefined>;
    websocket: {
      data: T;
      open?(ws: ServerWebSocket<T>): void;
      message?(ws: ServerWebSocket<T>, message: string | ArrayBuffer | Uint8Array): void;
      close?(ws: ServerWebSocket<T>, code: number, reason: string): void;
    };
  }): BunServer;
};

function generateId(): string {
  return globalThis.crypto.randomUUID();
}

function generateClientHtml(wsPort: number): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>File Editor</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    html, body, #root { height: 100%; width: 100%; overflow: hidden; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #1e1e1e; color: #fff; }
  </style>
</head>
<body>
  <div id="root"></div>

  <!-- React from CDN -->
  <script src="https://cdn.jsdelivr.net/npm/react@19.0.0/umd/react.production.min.js"></script>
  <script src="https://cdn.jsdelivr.net/npm/react-dom@19.0.0/umd/react-dom.production.min.js"></script>

  <!-- Monaco Editor Loader -->
  <script src="https://cdn.jsdelivr.net/npm/monaco-editor@0.52.0/min/vs/loader.js"></script>

  <script>
    // Event name mapping (compiled format)
    const EVENT_NAMES = {
      update_views_tree: "0",
      update_view: "1",
      delete_view: "2",
      request_views_tree: "3",
      respond_to_event: "4",
      request_event: "5"
    };
    const EVENT_IDS = Object.fromEntries(Object.entries(EVENT_NAMES).map(([k, v]) => [v, k]));

    // WebSocket Transport
    function createTransport(url) {
      const handlers = new Map();
      let ws = null;

      function connect() {
        return new Promise((resolve, reject) => {
          ws = new WebSocket(url);
          ws.onopen = () => resolve();
          ws.onerror = () => reject(new Error('WebSocket error'));
          ws.onmessage = (event) => {
            try {
              const { event: eventId, data } = JSON.parse(event.data);
              const eventName = EVENT_IDS[eventId] || eventId;
              const eventHandlers = handlers.get(eventName);
              if (eventHandlers) {
                for (const handler of eventHandlers) handler(data);
              }
            } catch {}
          };
        });
      }

      const transport = {
        on: (event, handler) => {
          const h = handlers.get(event) || new Set();
          h.add(handler);
          handlers.set(event, h);
        },
        emit: (event, data) => {
          if (ws?.readyState === WebSocket.OPEN) {
            const eventId = EVENT_NAMES[event] || event;
            ws.send(JSON.stringify({ event: eventId, data }));
          }
        },
        off: (event, handler) => {
          const h = handlers.get(event);
          if (h) h.delete(handler);
        }
      };

      return { transport, connect };
    }

    // Client state
    let views = [];
    let createEventHandler = null;

    // View Components
    const ViewComponents = {
      App: function({ rootPath, title, children }) {
        return React.createElement('div', {
          style: { display: 'flex', flexDirection: 'column', height: '100%', background: '#1e1e1e' }
        },
          React.createElement('div', {
            style: { padding: '8px 16px', background: '#252526', borderBottom: '1px solid #3c3c3c', fontSize: '14px', color: '#cccccc' }
          }, title, ' - ', rootPath),
          React.createElement('div', {
            style: { display: 'flex', flex: 1, overflow: 'hidden' }
          }, children)
        );
      },

      FileTree: function({ files, selectedPath, onSelect, onRefresh, children }) {
        const [expanded, setExpanded] = React.useState(new Set([files?.path]));

        function toggleExpand(path) {
          setExpanded(prev => {
            const next = new Set(prev);
            if (next.has(path)) next.delete(path);
            else next.add(path);
            return next;
          });
        }

        function renderNode(node, depth) {
          if (!node) return null;
          const isExpanded = expanded.has(node.path);
          const isSelected = node.path === selectedPath;

          return React.createElement('div', { key: node.path },
            React.createElement('div', {
              onClick: () => node.isDirectory ? toggleExpand(node.path) : onSelect(node.path),
              style: {
                padding: '4px 8px',
                paddingLeft: (depth * 16 + 8) + 'px',
                cursor: 'pointer',
                background: isSelected ? '#094771' : 'transparent',
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                fontSize: '13px',
                whiteSpace: 'nowrap'
              }
            },
              node.isDirectory ?
                React.createElement('span', { style: { width: '16px', textAlign: 'center' } }, isExpanded ? '▼' : '▶') :
                React.createElement('span', { style: { width: '16px' } }),
              React.createElement('span', null, node.isDirectory ? '📁' : '📄'),
              React.createElement('span', { style: { marginLeft: '4px' } }, node.name)
            ),
            node.isDirectory && isExpanded && node.children?.map(child => renderNode(child, depth + 1))
          );
        }

        return React.createElement('div', {
          style: {
            width: '250px',
            background: '#252526',
            borderRight: '1px solid #3c3c3c',
            overflow: 'auto',
            flexShrink: 0
          }
        },
          React.createElement('div', {
            style: { padding: '8px', borderBottom: '1px solid #3c3c3c', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }
          },
            React.createElement('span', { style: { fontSize: '11px', textTransform: 'uppercase', color: '#888' } }, 'Explorer'),
            React.createElement('button', {
              onClick: onRefresh,
              style: { background: 'none', border: 'none', color: '#888', cursor: 'pointer', fontSize: '14px' }
            }, '↻')
          ),
          files && renderNode(files, 0),
          children
        );
      },

      TabBar: function({ openFiles, activeFilePath, onSelectTab, onCloseTab, children }) {
        if (openFiles.length === 0) return children || null;

        return React.createElement('div', {
          style: { display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }
        },
          React.createElement('div', {
            style: {
              display: 'flex',
              background: '#252526',
              borderBottom: '1px solid #3c3c3c',
              overflow: 'auto',
              flexShrink: 0
            }
          },
            openFiles.map(file =>
              React.createElement('div', {
                key: file.path,
                onClick: () => onSelectTab(file.path),
                style: {
                  padding: '8px 12px',
                  cursor: 'pointer',
                  background: file.path === activeFilePath ? '#1e1e1e' : 'transparent',
                  borderRight: '1px solid #3c3c3c',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  fontSize: '13px',
                  whiteSpace: 'nowrap'
                }
              },
                React.createElement('span', null, file.isDirty ? '● ' : '', file.name),
                React.createElement('span', {
                  onClick: (e) => { e.stopPropagation(); onCloseTab(file.path); },
                  style: { opacity: 0.6, cursor: 'pointer' }
                }, '×')
              )
            )
          ),
          children
        );
      },

      CodeEditor: function({ path, content, language, onChange, onSave, children }) {
        const containerRef = React.useRef(null);
        const editorRef = React.useRef(null);
        const [ready, setReady] = React.useState(false);

        React.useEffect(() => {
          if (!window.require) return;

          window.require.config({
            paths: { vs: 'https://cdn.jsdelivr.net/npm/monaco-editor@0.52.0/min/vs' }
          });

          window.require(['vs/editor/editor.main'], function() {
            setReady(true);
          });
        }, []);

        React.useEffect(() => {
          if (!ready || !containerRef.current) return;

          if (!editorRef.current) {
            editorRef.current = window.monaco.editor.create(containerRef.current, {
              value: content,
              language: language,
              theme: 'vs-dark',
              automaticLayout: true,
              minimap: { enabled: true },
              fontSize: 14,
              tabSize: 2
            });

            editorRef.current.onDidChangeModelContent(() => {
              onChange(editorRef.current.getValue());
            });

            editorRef.current.addCommand(
              window.monaco.KeyMod.CtrlCmd | window.monaco.KeyCode.KeyS,
              onSave
            );
          }

          return () => {
            if (editorRef.current) {
              editorRef.current.dispose();
              editorRef.current = null;
            }
          };
        }, [ready]);

        React.useEffect(() => {
          if (editorRef.current) {
            const model = editorRef.current.getModel();
            if (model) {
              window.monaco.editor.setModelLanguage(model, language);
              if (model.getValue() !== content) {
                model.setValue(content);
              }
            }
          }
        }, [path, content, language]);

        return React.createElement('div', {
          style: { flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }
        },
          React.createElement('div', {
            ref: containerRef,
            style: { flex: 1 }
          }),
          children
        );
      },

      ExcalidrawEditor: function({ path, content, onChange, onSave, children }) {
        const [loaded, setLoaded] = React.useState(false);
        const excalidrawRef = React.useRef(null);

        React.useEffect(() => {
          if (window.ExcalidrawLib) {
            setLoaded(true);
            return;
          }

          const script = document.createElement('script');
          script.src = 'https://unpkg.com/@excalidraw/excalidraw/dist/excalidraw.production.min.js';
          script.onload = () => setLoaded(true);
          document.head.appendChild(script);

          const link = document.createElement('link');
          link.rel = 'stylesheet';
          link.href = 'https://unpkg.com/@excalidraw/excalidraw/dist/styles.css';
          document.head.appendChild(link);
        }, []);

        React.useEffect(() => {
          const handler = (e) => {
            if ((e.metaKey || e.ctrlKey) && e.key === 's') {
              e.preventDefault();
              onSave();
            }
          };
          document.addEventListener('keydown', handler);
          return () => document.removeEventListener('keydown', handler);
        }, [onSave]);

        const initialData = React.useMemo(() => {
          try {
            return JSON.parse(content);
          } catch {
            return { elements: [], appState: {} };
          }
        }, [path]);

        const handleChange = React.useCallback((elements, appState) => {
          const data = JSON.stringify({ elements, appState }, null, 2);
          onChange(data);
        }, [onChange]);

        if (!loaded) {
          return React.createElement('div', {
            style: { flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#888' }
          }, 'Loading Excalidraw...');
        }

        const Excalidraw = window.ExcalidrawLib.Excalidraw;

        return React.createElement('div', {
          style: { flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }
        },
          React.createElement('div', { style: { flex: 1 } },
            React.createElement(Excalidraw, {
              initialData: initialData,
              onChange: handleChange,
              ref: excalidrawRef,
              theme: 'dark'
            })
          ),
          children
        );
      },

      EmptyEditor: function({ message, children }) {
        return React.createElement('div', {
          style: {
            flex: 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#888',
            fontSize: '14px'
          }
        }, message, children);
      },

      ErrorDisplay: function({ error, onDismiss, children }) {
        return React.createElement('div', {
          style: {
            position: 'fixed',
            top: '16px',
            right: '16px',
            background: '#5a1d1d',
            border: '1px solid #be1100',
            padding: '12px 16px',
            borderRadius: '4px',
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            zIndex: 1000
          }
        },
          React.createElement('span', null, error),
          React.createElement('button', {
            onClick: onDismiss,
            style: { background: 'none', border: 'none', color: '#fff', cursor: 'pointer', fontSize: '16px' }
          }, '×'),
          children
        );
      }
    };

    // Views Renderer
    function ViewsRenderer({ viewsData }) {
      function buildTree(parentUid) {
        return viewsData
          .filter(v => v.parentUid === parentUid)
          .sort((a, b) => (a.childIndex || 0) - (b.childIndex || 0))
          .map(view => renderView(view));
      }

      function renderView(view) {
        const Component = ViewComponents[view.name];
        if (!Component) return null;

        const props = { key: view.uid };

        for (const prop of view.props) {
          if (prop.type === 'data') {
            props[prop.name] = prop.data;
          } else if (prop.type === 'event' && createEventHandler) {
            props[prop.name] = (...args) => createEventHandler(prop.uid, ...args);
          }
        }

        const children = buildTree(view.uid);
        return React.createElement(Component, props, children.length > 0 ? children : undefined);
      }

      const roots = viewsData.filter(v => v.isRoot);
      return React.createElement(React.Fragment, null, roots.map(renderView));
    }

    // Main App
    function App() {
      const [viewsData, setViewsData] = React.useState([]);
      const transportRef = React.useRef(null);
      const responseResolvers = React.useRef(new Map());

      React.useEffect(() => {
        const { transport, connect } = createTransport('ws://localhost:${wsPort}/ws');
        transportRef.current = transport;

        transport.on('update_views_tree', (data) => {
          setViewsData([...data.views]);
        });

        transport.on('update_view', (data) => {
          setViewsData(prev => {
            const view = data.view;
            const existingIndex = prev.findIndex(v => v.uid === view.uid);

            if (existingIndex >= 0) {
              const existing = prev[existingIndex];
              const deletedNames = new Set(view.props.delete || []);
              const createNames = new Set((view.props.create || []).map(p => p.name));
              const filteredProps = existing.props.filter(
                p => !deletedNames.has(p.name) && !createNames.has(p.name)
              );
              const updatedProps = [...filteredProps, ...(view.props.create || [])];

              return [
                ...prev.slice(0, existingIndex),
                { ...existing, props: updatedProps },
                ...prev.slice(existingIndex + 1)
              ];
            } else {
              return [...prev, {
                uid: view.uid,
                name: view.name,
                parentUid: view.parentUid,
                childIndex: view.childIndex,
                isRoot: view.isRoot,
                props: view.props.create || []
              }];
            }
          });
        });

        transport.on('delete_view', (data) => {
          setViewsData(prev => prev.filter(v => v.uid !== data.viewUid));
        });

        transport.on('respond_to_event', (data) => {
          const resolver = responseResolvers.current.get(data.uid);
          if (resolver) {
            resolver(data.data);
            responseResolvers.current.delete(data.uid);
          }
        });

        createEventHandler = (eventUid, ...args) => {
          return new Promise((resolve) => {
            const requestUid = crypto.randomUUID();
            responseResolvers.current.set(requestUid, resolve);
            transport.emit('request_event', {
              eventArguments: args,
              eventUid: eventUid,
              uid: requestUid
            });
          });
        };

        connect().then(() => {
          transport.emit('request_views_tree');
        });
      }, []);

      return React.createElement(ViewsRenderer, { viewsData });
    }

    // Mount
    const root = ReactDOM.createRoot(document.getElementById('root'));
    root.render(React.createElement(App));
  </script>
</body>
</html>`;
}

export function createFileEditorServer(options: FileEditorServerOptions): FileEditorServer {
  const { port, hostname = "0.0.0.0", path = "/ws" } = options;

  const clients = new Map<string, ClientState>();
  let connectionHandler: ((client: Transport<SocketClientEvents> & { id: string }) => void) | null = null;
  let server: BunServer | null = null;

  function createClientTransport(
    ws: ServerWebSocket<ClientData>,
    id: string
  ): Transport<SocketClientEvents> & { id: string } {
    const handlers = new Map<string, Set<(data: unknown) => void>>();

    const transport: Transport<SocketClientEvents> & { id: string } = {
      id,
      on: (event, handler) => {
        const eventHandlers = handlers.get(event as string) ?? new Set();
        eventHandlers.add(handler as (data: unknown) => void);
        handlers.set(event as string, eventHandlers);
      },
      emit: (event, data) => {
        ws.send(JSON.stringify({ event, data }));
      },
      off: (event, handler) => {
        const eventHandlers = handlers.get(event as string);
        if (eventHandlers) {
          eventHandlers.delete(handler as (data: unknown) => void);
        }
      },
    };

    clients.set(id, { ws, handlers });
    return transport;
  }

  function handleMessage(id: string, message: string): void {
    const client = clients.get(id);
    if (!client) return;

    try {
      const { event, data } = JSON.parse(message) as { event: string; data: unknown };
      const eventHandlers = client.handlers.get(event);
      if (eventHandlers) {
        for (const handler of eventHandlers) {
          handler(data);
        }
      }
    } catch {
      // Invalid JSON, ignore
    }
  }

  function handleDisconnect(id: string): void {
    const client = clients.get(id);
    if (!client) return;

    const disconnectHandlers = client.handlers.get("disconnect");
    if (disconnectHandlers) {
      for (const handler of disconnectHandlers) {
        handler(undefined);
      }
    }
    clients.delete(id);
  }

  const transport: Transport<SocketServerEvents> = {
    on: (event, handler) => {
      if (event === "connection") {
        connectionHandler = handler as unknown as (client: Transport<SocketClientEvents> & { id: string }) => void;
      }
    },
    emit: () => {},
    off: () => {
      connectionHandler = null;
    },
  };

  const start = (): BunServer => {
    server = Bun.serve<ClientData>({
      port,
      hostname,
      fetch(req: Request, srv: BunServer) {
        const url = new URL(req.url);

        if (url.pathname === path) {
          const upgraded = srv.upgrade(req, {
            data: { id: generateId() },
          });
          if (upgraded) {
            return undefined;
          }
          return new Response("WebSocket upgrade failed", { status: 500 });
        }

        if (req.method === "OPTIONS") {
          return new Response(null, {
            headers: {
              "Access-Control-Allow-Origin": "*",
              "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
              "Access-Control-Allow-Headers": "Content-Type",
            },
          });
        }

        if (url.pathname === "/" || url.pathname === "/index.html") {
          return new Response(generateClientHtml(port), {
            headers: {
              "Content-Type": "text/html",
              "Access-Control-Allow-Origin": "*",
            },
          });
        }

        return new Response("Not Found", { status: 404 });
      },
      websocket: {
        data: {} as ClientData,
        open(ws: ServerWebSocket<ClientData>) {
          const clientTransport = createClientTransport(ws, ws.data.id);
          connectionHandler?.(clientTransport);
        },
        message(ws: ServerWebSocket<ClientData>, message: string | ArrayBuffer | Uint8Array) {
          handleMessage(ws.data.id, typeof message === "string" ? message : new TextDecoder().decode(message));
        },
        close(ws: ServerWebSocket<ClientData>) {
          handleDisconnect(ws.data.id);
        },
      },
    });

    return server;
  };

  const stop = (): void => {
    server?.stop();
    server = null;
    clients.clear();
  };

  return { transport, start, stop };
}

export type { SocketClientEvents, SocketServerEvents };
