#!/usr/bin/env bun
// One-command release: update, preview, confirm, commit, publish.
//
//   bun run release
//
// Steps:
//   1. refuse to run on a dirty tree
//   2. ensure a changeset exists
//   3. run `changeset version` to bump versions and write changelogs
//   4. fail if a publishable package has runtime `workspace:` dependencies
//   5. preview the diff and new versions, then ask to proceed
//   6. commit the version bump
//   7. make sure npm is authenticated
//   8. run `changeset publish`
//
// Tags are created locally by `changeset publish`; push them afterwards.

import { readdirSync } from "node:fs";
import { join } from "node:path";

const root = join(import.meta.dir, "..");

const PACKAGES = [
  { dir: "packages/echoform", name: "@playfast/echoform" },
  { dir: "packages/react-render-null", name: "@playfast/echoform-render" },
  { dir: "packages/wmux", name: "@playfast/wmux" },
  { dir: "packages/wmux-client-terminal", name: "@playfast/wmux-client-terminal" },
  { dir: "plugins/bun-ws-client", name: "@playfast/echoform-bun-ws-client" },
  { dir: "plugins/bun-ws-server", name: "@playfast/echoform-bun-ws-server" },
  { dir: "plugins/socket-client", name: "@playfast/echoform-socket-client" },
  { dir: "plugins/socket-server", name: "@playfast/echoform-socket-server" },
] as const;

type PublishablePackage = (typeof PACKAGES)[number];

function fail(message: string): never {
  console.error(`\nerror: ${message}`);
  return process.exit(1);
}

async function run(...cmd: ReadonlyArray<string>): Promise<void> {
  const proc = Bun.spawn(cmd, {
    cwd: root,
    stdin: "inherit",
    stdout: "inherit",
    stderr: "inherit",
  });
  const code = await proc.exited;
  if (code !== 0) fail(`\`${cmd.join(" ")}\` exited with code ${code}`);
}

async function capture(...cmd: ReadonlyArray<string>): Promise<string> {
  const proc = Bun.spawn(cmd, { cwd: root, stdout: "pipe", stderr: "ignore" });
  const out = await new Response(proc.stdout).text();
  await proc.exited;
  return out;
}

function pendingChangesets(): ReadonlyArray<string> {
  return readdirSync(join(root, ".changeset")).filter(
    (file) => file.endsWith(".md") && file !== "README.md" && file !== "readme.md",
  );
}

async function packageJson(pkg: PublishablePackage): Promise<Record<string, unknown>> {
  return Bun.file(join(root, pkg.dir, "package.json")).json();
}

async function packageVersion(pkg: PublishablePackage): Promise<string> {
  const json = await packageJson(pkg);
  return String(json["version"]);
}

async function assertNoWorkspaceProtocol(): Promise<void> {
  const fields = ["dependencies", "peerDependencies", "optionalDependencies"] as const;
  const perPackage = await Promise.all(
    PACKAGES.map(async (pkg) => {
      const json = await packageJson(pkg);
      return fields.flatMap((field) => {
        const block = json[field] as Record<string, string> | undefined;
        const entries = block === undefined ? [] : Object.entries(block);
        return entries.flatMap(([name, spec]) =>
          spec.startsWith("workspace:")
            ? [`${pkg.name} -> ${field}["${name}"] = "${spec}"`]
            : [],
        );
      });
    }),
  );

  const offenders = perPackage.flat();
  if (offenders.length > 0) {
    fail(
      "Published packages must not use the `workspace:` protocol in runtime dependency fields. " +
        "Use a plain range such as \"*\":\n  " +
        offenders.join("\n  "),
    );
  }
}

function firstLine(text: string): string {
  const newline = text.indexOf("\n");
  return newline === -1 ? text : text.slice(0, newline);
}

const status = await capture("git", "status", "--porcelain");
if (status.length > 0) fail(`Working tree is dirty. Commit or stash first:\n${status}`);

if (pendingChangesets().length === 0) {
  console.log("No pending changeset. Describe this release.\n");
  await run("bunx", "changeset");
  if (pendingChangesets().length === 0) fail("No changeset was created; aborting.");
}

console.log("\nApplying changesets...\n");
await run("bunx", "changeset", "version");

await assertNoWorkspaceProtocol();

console.log("\nRelease diff:\n");
await run("git", "--no-pager", "diff", "--stat");

const versionLines = await Promise.all(
  PACKAGES.map(async (pkg) => `  ${pkg.name} -> ${await packageVersion(pkg)}`),
);
console.log(`\nNew versions:\n${versionLines.join("\n")}`);

const proceed = prompt("\nCommit these changes and publish to npm? (y/N)");
if (proceed !== "y" && proceed !== "Y") {
  console.log("\nAborted. The version bump is left uncommitted in your tree.");
  process.exit(0);
}

console.log("\nCommitting...\n");
await run("git", "add", "-A");
await run("git", "commit", "-m", "release: packages");

const whoami = firstLine(await capture("npm", "whoami"));
if (whoami.length === 0) {
  console.log("\nNot logged in to npm. Opening your browser to authenticate...\n");
  await run("npm", "login");
} else {
  console.log(`\nPublishing as npm user: ${whoami}`);
}

console.log("\nPublishing. Approve in your browser if prompted.\n");
await run("bunx", "changeset", "publish");

console.log("\nReleased packages. Push the release commit and tags: git push --follow-tags");
