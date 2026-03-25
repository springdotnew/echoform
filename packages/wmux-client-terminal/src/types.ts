export interface FileEntry {
  readonly path: string;
  readonly name: string;
  readonly isDir: boolean;
  readonly depth: number;
  readonly isExpanded: boolean;
}

export interface TabInfo {
  readonly id: string;
  readonly name: string;
  readonly description?: string;
  readonly icon?: string;
  readonly status: string;
}

export interface CategoryInfo {
  readonly name: string;
  readonly color: string;
  readonly icon?: string;
  readonly type: string;
  readonly tabs: readonly TabInfo[];
  readonly fileEntries?: readonly FileEntry[];
  readonly openFiles?: readonly { readonly path: string; readonly name: string }[];
}
