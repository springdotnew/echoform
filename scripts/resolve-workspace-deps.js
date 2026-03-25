/**
 * Resolves workspace:* dependencies to real version numbers in all publishable packages.
 * Run this before `changeset publish` since npm publish doesn't understand workspace protocol.
 */
const fs = require("fs");
const path = require("path");

const packages = [
  "packages/echoform",
  "packages/react-render-null",
  "packages/wmux",
  "packages/wmux-client-terminal",
  "plugins/bun-ws-client",
  "plugins/bun-ws-server",
  "plugins/socket-client",
  "plugins/socket-server",
];

const versions = new Map();
for (const pkgDir of packages) {
  const pkgJson = JSON.parse(fs.readFileSync(path.join(pkgDir, "package.json"), "utf8"));
  versions.set(pkgJson.name, pkgJson.version);
}

for (const pkgDir of packages) {
  const pkgPath = path.join(pkgDir, "package.json");
  const pkgJson = JSON.parse(fs.readFileSync(pkgPath, "utf8"));
  let changed = false;

  for (const depField of ["dependencies", "devDependencies", "peerDependencies"]) {
    const deps = pkgJson[depField];
    if (!deps) continue;
    for (const [name, version] of Object.entries(deps)) {
      if (version === "workspace:*" && versions.has(name)) {
        deps[name] = "^" + versions.get(name);
        changed = true;
      }
    }
  }

  if (changed) {
    fs.writeFileSync(pkgPath, JSON.stringify(pkgJson, null, 2) + "\n");
    console.log(`  resolved workspace deps in ${pkgJson.name}`);
  }
}
