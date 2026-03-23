import { mountDemoClient } from "../../shared/DemoClient";
import {
  App,
  FileTree,
  TabBar,
  CodeEditor,
  ExcalidrawEditor,
  EmptyEditor,
  ErrorDisplay,
} from "./components";

mountDemoClient({
  wsUrl: "ws://localhost:4210/ws",
  views: { App, FileTree, TabBar, CodeEditor, ExcalidrawEditor, EmptyEditor, ErrorDisplay },
});
