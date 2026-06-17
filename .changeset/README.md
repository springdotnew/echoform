# Changesets

This folder is managed by [Changesets](https://github.com/changesets/changesets), the
versioning and publishing tool for this workspace.

## Releasing

1. `bun changeset` - describe your change and pick a bump.
2. `bun run release` - applies pending changesets, previews the release diff,
   commits the version bump, and publishes to npm.

The core echoform packages are a fixed group, so any bump to one of them moves
that group together. The wmux packages release independently.

Published packages ship TypeScript source through their `exports` entries. Keep
runtime internal package references as plain ranges such as `"*"`. Private
packages and dev-only references may use `workspace:*`.
