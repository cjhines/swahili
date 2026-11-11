/* global process */
// Runs a Node script from the project's real on-disk path: `node scripts/real-cwd.mjs <script> [args]`.
//
// Why: on Windows a shell can sit in c:\… (VS Code opens folders that way) while modules resolve
// to C:\…. Vitest then loads two copies of itself, and every test file fails with "Vitest failed
// to find the current suite". Starting it from the canonical path avoids the split. Elsewhere
// this is a no-op wrapper.
import { spawnSync } from 'node:child_process';
import { realpathSync } from 'node:fs';

const [script, ...args] = process.argv.slice(2);
const { status, signal } = spawnSync(process.execPath, [script, ...args], {
  cwd: realpathSync.native(process.cwd()),
  stdio: 'inherit',
});
process.exit(status ?? (signal ? 1 : 0));
