import { useState, useEffect, useCallback, useRef, useImperativeHandle, forwardRef } from "react";
import { useViews } from "@playfast/echoform/server";
import { views } from "../views";
import { readdir } from "node:fs/promises";
import { join, resolve, basename } from "node:path";

// ── Types ──

interface TreeNode {
  readonly path: string;
  readonly name: string;
  readonly isDir: boolean;
}

export interface FlatEntry {
  path: string;
  name: string;
  isDir: boolean;
  depth: number;
  isExpanded: boolean;
}

interface OpenFile {
  readonly path: string;
  readonly name: string;
  readonly content: string;
}

export interface FileViewerState {
  readonly entries: FlatEntry[];
  readonly openFiles: ReadonlyArray<{ path: string; name: string }>;
}

export interface FileViewerActions {
  toggleDir(path: string): void;
  openFile(path: string): void;
  closeFile(idOrPath: string): void;
}

// ── Helpers ──

const IGNORED = new Set(["node_modules", ".git", ".DS_Store", "dist", ".next", ".turbo", ".cache", "coverage", "__pycache__"]);
const MAX_FILE_SIZE = 512 * 1024;

async function readDirSorted(dirPath: string): Promise<readonly TreeNode[]> {
  const dirents = await readdir(dirPath, { withFileTypes: true });
  const entries = dirents
    .filter((d) => !IGNORED.has(d.name) && !d.name.startsWith("."))
    .map((d) => ({ path: join(dirPath, d.name), name: d.name, isDir: d.isDirectory() }));
  entries.sort((a, b) => (a.isDir !== b.isDir ? (a.isDir ? -1 : 1) : a.name.localeCompare(b.name)));
  return entries;
}

// ── Component ──

interface Props {
  readonly root: string;
  readonly onStateChange: (state: FileViewerState) => void;
  readonly onActiveTabChange: (id: string) => void;
}

export const FileViewerSession = forwardRef<FileViewerActions, Props>(
  function FileViewerSession({ root, onStateChange, onActiveTabChange }, ref) {
    const View = useViews(views);
    const [dirCache, setDirCache] = useState<Map<string, readonly TreeNode[]>>(new Map());
    const [expanded, setExpanded] = useState<Set<string>>(new Set());
    const [openFiles, setOpenFiles] = useState<Map<string, OpenFile>>(new Map());

    const absRoot = resolve(root);
    const dirCacheRef = useRef(dirCache);
    dirCacheRef.current = dirCache;

    // Load root directory
    useEffect(() => {
      readDirSorted(absRoot).then((entries) => {
        setDirCache(new Map([[absRoot, entries]]));
        setExpanded(new Set([absRoot]));
      });
    }, [absRoot]);

    // Flatten tree
    const flatten = useCallback((): FlatEntry[] => {
      const result: FlatEntry[] = [];
      const walk = (dir: string, depth: number): void => {
        for (const child of dirCache.get(dir) ?? []) {
          const isExp = expanded.has(child.path);
          result.push({ path: child.path, name: child.name, isDir: child.isDir, depth, isExpanded: isExp });
          if (child.isDir && isExp) walk(child.path, depth + 1);
        }
      };
      walk(absRoot, 0);
      return result;
    }, [dirCache, expanded, absRoot]);

    // Push state to parent (ref-based callback to avoid dep cycle)
    const onStateChangeRef = useRef(onStateChange);
    onStateChangeRef.current = onStateChange;
    useEffect(() => {
      onStateChangeRef.current({
        entries: flatten(),
        openFiles: [...openFiles.values()].map(({ path, name }) => ({ path, name })),
      });
    }, [flatten, openFiles]);

    // Ref to check open files without stale closure
    const openFilesRef = useRef(openFiles);
    openFilesRef.current = openFiles;

    // Expose actions to parent via ref
    useImperativeHandle(ref, () => ({
      toggleDir(path: string) {
        setExpanded((prev) => {
          if (prev.has(path)) { const next = new Set(prev); next.delete(path); return next; }
          if (dirCacheRef.current.has(path)) return new Set([...prev, path]);
          readDirSorted(path).then((entries) => {
            setDirCache((p) => new Map([...p, [path, entries]]));
            setExpanded((p) => new Set([...p, path]));
          });
          return prev;
        });
      },

      async openFile(path: string) {
        const fileId = `file::${path}`;
        if (openFilesRef.current.has(path)) { onActiveTabChange(fileId); return; }
        try {
          const file = Bun.file(path);
          const content = file.size > MAX_FILE_SIZE
            ? `File too large (${(file.size / 1024).toFixed(0)}KB).`
            : await file.text();
          setOpenFiles((prev) => new Map([...prev, [path, { path, name: basename(path), content }]]));
        } catch {
          setOpenFiles((prev) => new Map([...prev, [path, { path, name: basename(path), content: "Unable to read file." }]]));
        }
        onActiveTabChange(fileId);
      },

      closeFile(idOrPath: string) {
        const path = idOrPath.startsWith("file::") ? idOrPath.slice(6) : idOrPath;
        setOpenFiles((prev) => { const next = new Map(prev); next.delete(path); return next; });
      },
    }), [onActiveTabChange]);

    if (!View) return null;

    return (
      <>
        {[...openFiles.values()].map((file) => (
          <View.WmuxFileContent
            key={file.path}
            id={`file::${file.path}`}
            path={file.path}
            name={file.name}
            content={file.content}
          />
        ))}
      </>
    );
  },
);
