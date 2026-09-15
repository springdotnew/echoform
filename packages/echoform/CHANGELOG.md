# @playfast/echoform

## 2.0.0

### Minor Changes

- e36e3b2: Expose client view-tree lifecycle updates so hosts can distinguish empty and pending renders.

### Patch Changes

- e36e3b2: Keep client transports active across React Strict Mode lifecycle probes and deliver synchronously replayed initial frames.
- 67e385d: Withhold `update_view` / `delete_view` broadcasts from clients that have not yet requested the view tree. Previously, in `singleInstance` mode, a client connecting while views were updating could receive an incremental prop diff before its `update_views_tree` snapshot; the client materialized the unknown view from the diff alone, yielding a view with only the changed props (missing callback and data props) and crashing the client renderer on the first missing-prop access (e.g. `props.onSelectCategory.mutate` in the wmux TUI during dev-server startup).

## 1.0.9

### Patch Changes

- ac800a7: Add headless preset for wmux and markdown session support

## 1.0.8

### Patch Changes

- 5ae684e: Add mouse click, selection-based copy, and paste support to wmux TUI

## 1.0.7

### Patch Changes

- 654cc2d: Persist terminal history across tab switches

## 1.0.6

### Patch Changes

- 5049ea0: Add persistent control mode, search overlay, copy mode, and file viewing to wmux TUI client. Minor echoform view-inference fix.

## 1.0.5

### Patch Changes

- 0b235d5: Add wmux-client-terminal TUI client and stream replay for late-joining clients

## 1.0.4

### Patch Changes

- d8ae8bf: Patch release

## 1.0.2

### Patch Changes

- 76d027a: Fix exports for NodeNext moduleResolution compatibility. Remove unused Container type from echoform-render.

## 1.0.0

### Minor Changes

- d43eea3: Initial public release with echoform core, transport plugins, and wmux.

## 0.3.1-alpha.8

### Patch Changes

- .

## 0.3.1-alpha.7

### Patch Changes

- d0febb8: add support for handling ssr requests

## 0.3.1-alpha.6

### Patch Changes

- fix single instance duble event bug

## 0.3.1-alpha.5

### Patch Changes

- pre release alpha
