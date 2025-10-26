#!/usr/bin/env node
import { spawn } from "node:child_process";

const checks = [
  {
    label: "renderer",
    command: "tsc",
    args: ["--noEmit", "-p", "tsconfig.json"],
  },
  {
    label: "electron",
    command: "tsc",
    args: ["--noEmit", "-p", "electron/tsconfig.json"],
  },
];

function runCheck({ label, command, args }) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      stdio: "inherit",
      shell: process.platform === "win32",
    });

    child.on("exit", (code, signal) => {
      if (code === 0) {
        resolve();
      } else {
        const reason =
          code !== null
            ? `exit code ${code}`
            : signal
              ? `signal ${signal}`
              : "unknown reason";
        reject(new Error(`${label} typecheck failed (${reason})`));
      }
    });

    child.on("error", (error) => {
      reject(new Error(`${label} typecheck failed (${error.message})`));
    });
  });
}

try {
  await Promise.all(checks.map(runCheck));
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
}
