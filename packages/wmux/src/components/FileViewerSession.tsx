import React, { useState, useEffect, useCallback } from "react";
import { useViews } from "@playfast/echoform/server";
import { views } from "../views";
import { readdir } from "node:fs/promises";
import { join, resolve, basename } from "node:path";

interface TreeNode {
  readonly path: string;
  readonly name: string;
  readonly isDir: boolean;
}

interface FlatEntry {
  readonly path: string;
  readonly name: string;
  readonly isDir: boolean;
  readonly depth: number;
  readonly isExpanded: boolean;
}

const IGNORED = new Set([
  "node_modules", ".git", ".DS_Store", "dist", ".next",
  ".turbo", ".cache", "coverage", "__pycache__",
]);

const MAX_FILE_SIZE = 512 * 1024; // 512KB

async function readDirSorted(dirPath: string): Promise<readonly TreeNode[]> {
  const dirents = await readdir(dirPath, { withFileTypes: true });
  const entries = dirents
    .filter((d) => !IGNORED.has(d.name) && !d.name.startsWith("."))
    .map((d) => ({
      path: join(dirPath, d.name),
      name: d.name,
      isDir: d.isDirectory(),
    }));
  entries.sort((a, b) => {
    if (a.isDir !== b.isDir) return a.isDir ? -1 : 1;
    return a.name.localeCompare(b.name);
  });
  return entries;
}

export function FileViewerSession({ root }: { readonly root: string }): React.ReactElement | null {
  const View = useViews(views);
  const [dirCache, setDirCache] = useState<Map<string, readonly TreeNode[]>>(new Map());
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [selectedPath, setSelectedPath] = useState("");
  const [selectedContent, setSelectedContent] = useState("");

  const absRoot = resolve(root);

  useEffect(() => {
    readDirSorted(absRoot).then((entries) => {
      setDirCache(new Map([[absRoot, entries]]));
      setExpanded(new Set([absRoot]));
    });
  }, [absRoot]);

  const flatten = useCallback((): readonly FlatEntry[] => {
    const result: FlatEntry[] = [];
    const walk = (dirPath: string, depth: number): void => {
      const children = dirCache.get(dirPath);
      if (!children) return;
      for (const child of children) {
        const isExp = expanded.has(child.path);
        result.push({
          path: child.path,
          name: child.name,
          isDir: child.isDir,
          depth,
          isExpanded: isExp,
        });
        if (child.isDir && isExp) walk(child.path, depth + 1);
      }
    };
    walk(absRoot, 0);
    return result;
  }, [dirCache, expanded, absRoot]);

  const handleToggleDir = useCallback((path: string) => {
    if (expanded.has(path)) {
      setExpanded((prev) => {
        const next = new Set(prev);
        next.delete(path);
        return next;
      });
    } else {
      if (dirCache.has(path)) {
        setExpanded((prev) => new Set([...prev, path]));
      } else {
        readDirSorted(path).then((entries) => {
          setDirCache((prev) => new Map([...prev, [path, entries]]));
          setExpanded((prev) => new Set([...prev, path]));
        });
      }
    }
  }, [expanded, dirCache]);

  const handleSelectFile = useCallback((path: string) => {
    setSelectedPath(path);
    const file = Bun.file(path);
    void (async () => {
      try {
        const size = file.size;
        if (size > MAX_FILE_SIZE) {
          setSelectedContent(`File too large (${(size / 1024).toFixed(0)}KB). Max ${MAX_FILE_SIZE / 1024}KB.`);
          return;
        }
        const content = await file.text();
        setSelectedContent(content);
      } catch {
        setSelectedContent("Unable to read file.");
      }
    })();
  }, []);

  if (!View) return null;

  return (
    <View.WmuxFileViewer
      id="__files__"
      entries={flatten()}
      selectedPath={selectedPath}
      selectedContent={selectedContent}
      onToggleDir={handleToggleDir}
      onSelectFile={handleSelectFile}
    />
  );
}
