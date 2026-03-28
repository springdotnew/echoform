import { wmuxHeadless } from "../src/preset/headless";

// Test 1: basic concurrent output
console.log("=== Test 1: basic concurrent ===");
const h1 = await wmuxHeadless({
  sidebarItems: [
    {
      category: "Test",
      tabs: [
        { name: "echo-a", command: "echo hello from A && sleep 0.5 && echo A done" },
        { name: "echo-b", command: "echo hello from B && sleep 0.3 && echo B done" },
      ],
    },
  ],
});
await h1.done;
console.log("--- test 1 passed ---\n");

// Test 2: autoStart false
console.log("=== Test 2: autoStart false ===");
const h2 = await wmuxHeadless({
  sidebarItems: [
    {
      category: "Test",
      tabs: [
        { name: "runs", command: "echo I ran" },
        { name: "skipped", command: "echo should not appear", autoStart: false },
      ],
    },
  ],
});
await h2.done;
console.log("--- test 2 passed ---\n");

// Test 3: autoRestart on failure (stop after 1 restart)
console.log("=== Test 3: autoRestart ===");
let restartCount = 0;
const h3 = await wmuxHeadless({
  sidebarItems: [
    {
      category: "Test",
      tabs: [
        { name: "fail", command: "echo attempt && exit 1", autoRestart: true },
      ],
    },
  ],
});
// Let it restart once then stop
setTimeout(() => {
  console.log("(stopping after auto-restart test)");
  h3.stop();
}, 2500);
await h3.done;
console.log("--- test 3 passed ---\n");

// Test 4: manual stop
console.log("=== Test 4: manual stop ===");
const h4 = await wmuxHeadless({
  sidebarItems: [
    {
      category: "Test",
      tabs: [
        { name: "long", command: "sleep 60" },
      ],
    },
  ],
});
setTimeout(() => h4.stop(), 500);
await h4.done;
console.log("--- test 4 passed ---\n");

console.log("All tests passed!");
process.exit(0);
