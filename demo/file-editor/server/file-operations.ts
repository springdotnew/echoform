import * as fs from "fs/promises";
import * as path from "path";
import type { FileNode } from "../shared/types";

const EXTENSION_TO_LANGUAGE: Readonly<Record<string, string>> = {
  ".ts": "typescript",
  ".tsx": "typescript",
  ".js": "javascript",
  ".jsx": "javascript",
  ".mjs": "javascript",
  ".cjs": "javascript",
  ".json": "json",
  ".md": "markdown",
  ".mdx": "markdown",
  ".css": "css",
  ".scss": "scss",
  ".sass": "scss",
  ".less": "less",
  ".html": "html",
  ".htm": "html",
  ".xml": "xml",
  ".svg": "xml",
  ".yaml": "yaml",
  ".yml": "yaml",
  ".toml": "ini",
  ".py": "python",
  ".pyw": "python",
  ".rs": "rust",
  ".go": "go",
  ".java": "java",
  ".kt": "kotlin",
  ".kts": "kotlin",
  ".c": "c",
  ".cpp": "cpp",
  ".cc": "cpp",
  ".cxx": "cpp",
  ".h": "c",
  ".hpp": "cpp",
  ".hxx": "cpp",
  ".cs": "csharp",
  ".fs": "fsharp",
  ".sh": "shell",
  ".bash": "shell",
  ".zsh": "shell",
  ".fish": "shell",
  ".ps1": "powershell",
  ".sql": "sql",
  ".graphql": "graphql",
  ".gql": "graphql",
  ".vue": "vue",
  ".svelte": "svelte",
  ".php": "php",
  ".rb": "ruby",
  ".lua": "lua",
  ".swift": "swift",
  ".r": "r",
  ".R": "r",
  ".dockerfile": "dockerfile",
  ".makefile": "makefile",
  ".mk": "makefile",
  ".ini": "ini",
  ".cfg": "ini",
  ".conf": "ini",
  ".properties": "ini",
  ".env": "ini",
  ".gitignore": "ini",
  ".dockerignore": "ini",
  ".txt": "plaintext",
  ".log": "plaintext",
};

const IGNORED_NAMES = new Set([
  "node_modules",
  ".git",
  ".svn",
  ".hg",
  ".DS_Store",
  "Thumbs.db",
  "__pycache__",
  ".pytest_cache",
  ".mypy_cache",
  "dist",
  "build",
  ".next",
  ".nuxt",
  ".cache",
  "coverage",
  ".vscode",
  ".idea",
]);

export function getLanguageFromPath(filePath: string): string {
  const ext = path.extname(filePath).toLowerCase();
  const language = EXTENSION_TO_LANGUAGE[ext];
  if (language) return language;

  const basename = path.basename(filePath).toLowerCase();
  if (basename === "dockerfile") return "dockerfile";
  if (basename === "makefile") return "makefile";

  return "plaintext";
}

export function validatePath(rootPath: string, targetPath: string): boolean {
  const resolvedRoot = path.resolve(rootPath);
  const resolvedTarget = path.resolve(targetPath);
  return resolvedTarget.startsWith(resolvedRoot + path.sep) || resolvedTarget === resolvedRoot;
}

export function isTextFile(filePath: string): boolean {
  const ext = path.extname(filePath).toLowerCase();
  const basename = path.basename(filePath).toLowerCase();

  if (ext === ".excalidraw") return true;
  if (EXTENSION_TO_LANGUAGE[ext]) return true;
  if (basename === "dockerfile" || basename === "makefile") return true;

  return false;
}

export async function listDirectory(dirPath: string): Promise<FileNode> {
  const stats = await fs.stat(dirPath);
  const name = path.basename(dirPath);

  if (!stats.isDirectory()) {
    return {
      path: dirPath,
      name,
      isDirectory: false,
    };
  }

  const entries = await fs.readdir(dirPath, { withFileTypes: true });
  const children: FileNode[] = [];

  for (const entry of entries) {
    if (entry.name.startsWith(".") || IGNORED_NAMES.has(entry.name)) {
      continue;
    }

    const childPath = path.join(dirPath, entry.name);

    if (entry.isDirectory()) {
      try {
        const childNode = await listDirectory(childPath);
        children.push(childNode);
      } catch {
      }
    } else if (isTextFile(entry.name)) {
      children.push({
        path: childPath,
        name: entry.name,
        isDirectory: false,
      });
    }
  }

  children.sort((a, b) => {
    if (a.isDirectory && !b.isDirectory) return -1;
    if (!a.isDirectory && b.isDirectory) return 1;
    return a.name.localeCompare(b.name);
  });

  return {
    path: dirPath,
    name,
    isDirectory: true,
    children,
  };
}

export async function readFile(filePath: string): Promise<string> {
  return await fs.readFile(filePath, "utf-8");
}

export async function writeFile(filePath: string, content: string): Promise<void> {
  await fs.writeFile(filePath, content, "utf-8");
}
