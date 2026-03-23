export interface FileNode {
  readonly path: string;
  readonly name: string;
  readonly isDirectory: boolean;
  readonly children?: readonly FileNode[];
}

export interface OpenFile {
  readonly path: string;
  readonly name: string;
  readonly content: string;
  readonly language: string;
  readonly isExcalidraw: boolean;
  readonly isDirty: boolean;
}
