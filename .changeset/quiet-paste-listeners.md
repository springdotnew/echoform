---
"@playfast/wmux-client-terminal": patch
---

Subscribe to `keyInput` paste events only from the active terminal. The renderer's
`keyInput` is shared across terminals, so mounting one listener per tab tripped
Node's default 10-listener warning in sessions with many tabs. Inactive terminals
already ignored paste events, so behaviour is unchanged.
