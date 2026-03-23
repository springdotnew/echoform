# Changesets

This repo uses [changesets](https://github.com/changesets/changesets) to manage versions and publish to npm.

## Adding a changeset

```bash
bunx changeset
```

Follow the prompts to select which packages changed and the bump type (patch/minor/major).

## Publishing

Push to `master` with pending changesets → CI creates a "Version Packages" PR → merge it → CI publishes to npm.
