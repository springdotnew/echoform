import { useState, useEffect, useCallback, useMemo, useRef, useImperativeHandle, forwardRef } from "react";
import { useViews } from "@playfast/echoform/server";
import { views } from "../views";
import { readdir } from "node:fs/promises";
import { join, resolve, basename } from "node:path";

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
  closeFile(fileIdentifier: string): void;
}

const IGNORED = new Set(["node_modules", ".git", ".DS_Store", "dist", ".next", ".turbo", ".cache", "coverage", "__pycache__"]);
const MAX_FILE_SIZE = 512 * 1024;

function isVisibleEntry(name: string): boolean {
  return !IGNORED.has(name) && !name.startsWith(".");
}

async function readDirSorted(dirPath: string): Promise<readonly TreeNode[]> {
  const dirents = await readdir(dirPath, { withFileTypes: true });
  const entries = dirents
    .filter((d) => isVisibleEntry(d.name))
    .map((d) => ({ path: join(dirPath, d.name), name: d.name, isDir: d.isDirectory() }));
  entries.sort((a, b) => (a.isDir !== b.isDir ? (a.isDir ? -1 : 1) : a.name.localeCompare(b.name)));
  return entries;
}

function removeFromSet<T>(source: Set<T>, item: T): Set<T> {
  return new Set([...source].filter((entry) => entry !== item));
}

function removeFromMap<K, V>(source: Map<K, V>, key: K): Map<K, V> {
  return new Map([...source].filter(([entryKey]) => entryKey !== key));
}

function extractPathFromFileIdentifier(fileIdentifier: string): string {
  return fileIdentifier.startsWith("file::") ? fileIdentifier.slice(6) : fileIdentifier;
}

async function readFileContent(path: string): Promise<string> {
  const file = Bun.file(path);
  if (file.size > MAX_FILE_SIZE) return `File too large (${(file.size / 1024).toFixed(0)}KB).`;
  return file.text();
}

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

    useEffect(() => {
      readDirSorted(absRoot).then((entries) => {
        setDirCache(new Map([[absRoot, entries]]));
        setExpanded(new Set([absRoot]));
      });
    }, [absRoot]);

    const flatten = useCallback((): FlatEntry[] => {
      const result: FlatEntry[] = [];
      const walk = (dir: string, depth: number): void => {
        for (const child of dirCache.get(dir) ?? []) {
          const isExpanded = expanded.has(child.path);
          result.push({ path: child.path, name: child.name, isDir: child.isDir, depth, isExpanded });
          if (child.isDir && isExpanded) walk(child.path, depth + 1);
        }
      };
      walk(absRoot, 0);
      return result;
    }, [dirCache, expanded, absRoot]);

    const onStateChangeRef = useRef(onStateChange);
    onStateChangeRef.current = onStateChange;
    useEffect(() => {
      onStateChangeRef.current({
        entries: flatten(),
        openFiles: [...openFiles.values()].map(({ path, name }) => ({ path, name })),
      });
    }, [flatten, openFiles]);

    const openFilesRef = useRef(openFiles);
    openFilesRef.current = openFiles;

    useImperativeHandle(ref, () => ({
      toggleDir(path: string) {
        setExpanded((prev) => {
          if (prev.has(path)) return removeFromSet(prev, path);
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
          const content = await readFileContent(path);
          setOpenFiles((prev) => new Map([...prev, [path, { path, name: basename(path), content }]]));
        } catch {
          setOpenFiles((prev) => new Map([...prev, [path, { path, name: basename(path), content: "Unable to read file." }]]));
        }
        onActiveTabChange(fileId);
      },

      closeFile(fileIdentifier: string) {
        const path = extractPathFromFileIdentifier(fileIdentifier);
        setOpenFiles((prev) => removeFromMap(prev, path));
      },
    }), [onActiveTabChange]);

    const openFilesList = useMemo(() => [...openFiles.values()], [openFiles]);

    if (!View) return null;

    return (
      <>
        {openFilesList.map((file) => (
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
