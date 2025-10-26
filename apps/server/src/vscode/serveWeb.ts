import { execFile, spawn } from "node:child_process";
import type { ChildProcess } from "node:child_process";
import { constants as fsConstants } from "node:fs";
import { access, unlink } from "node:fs/promises";
import { request as httpRequest } from "node:http";
import { tmpdir } from "node:os";
import path from "node:path";
import { promisify } from "node:util";

type Logger = {
  info: (message: string, ...args: unknown[]) => void;
  warn: (message: string, ...args: unknown[]) => void;
  error: (message: string, ...args: unknown[]) => void;
  debug?: (message: string, ...args: unknown[]) => void;
};

const execFileAsync = promisify(execFile);
export const LOCAL_VSCODE_HOST =
  process.env.CMUX_VSCODE_PUBLIC_HOST?.trim() || "cmux-vscode.local";
const SOCKET_READY_TIMEOUT_MS = 15_000;
export const VSCODE_FRAME_ANCESTORS_HEADER =
  "frame-ancestors 'self' https://cmux.local http://cmux.local https://www.cmux.sh https://cmux.sh https://www.cmux.dev https://cmux.dev http://localhost:5173 http://cmux-vscode.local https://cmux-vscode.local http://cmux-vscode.localhost https://cmux-vscode.localhost;";

let resolvedVSCodeExecutable: string | null = null;
let currentServeWebBaseUrl: string | null = null;
let currentServeWebSocketPath: string | null = null;

export type VSCodeServeWebHandle = {
  process: ChildProcess;
  executable: string;
  socketPath: string;
};

export function getVSCodeServeWebBaseUrl(): string | null {
  return currentServeWebBaseUrl;
}

export function getVSCodeServeWebSocketPath(): string | null {
  return currentServeWebSocketPath;
}

export async function waitForVSCodeServeWebBaseUrl(
  timeoutMs = 15_000
): Promise<string | null> {
  if (currentServeWebBaseUrl) {
    return currentServeWebBaseUrl;
  }

  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (currentServeWebBaseUrl) {
      return currentServeWebBaseUrl;
    }
    await new Promise((resolve) => setTimeout(resolve, 200));
  }

  return currentServeWebBaseUrl;
}

export async function ensureVSCodeServeWeb(
  logger: Logger
): Promise<VSCodeServeWebHandle | null> {
  logger.info("Ensuring VS Code serve-web availability...");

  const executable = await getVSCodeExecutable(logger);
  if (!executable) {
    logger.warn(
      "VS Code CLI executable unavailable; serve-web will not be launched."
    );
    return null;
  }

  if (process.platform === "win32") {
    logger.warn(
      "Unix socket mode for VS Code serve-web is unavailable on Windows; skipping launch."
    );
    return null;
  }

  const socketPath = createSocketPath();

  let child: ChildProcess | null = null;

  try {
    await removeStaleSocket(socketPath, logger);

    logger.info(
      `Starting VS Code serve-web using executable ${executable} with socket ${socketPath}...`
    );

    child = spawn(
      executable,
      [
        "serve-web",
        "--accept-server-license-terms",
        "--without-connection-token",
        "--socket-path",
        socketPath,
      ],
      {
        detached: true,
        stdio: ["ignore", "pipe", "pipe"],
      }
    );

    attachServeWebProcessLogging(child, logger);

    child!.on("error", (error) => {
      logger.error("VS Code serve-web process error:", error);
    });

    child!.on("exit", (code, signal) => {
      const exitMessage = `VS Code serve-web process exited${
        typeof code === "number" ? ` with code ${code}` : ""
      }${signal ? ` due to signal ${signal}` : ""}.`;
      if (code === 0 && !signal) {
        logger.info(exitMessage);
      } else {
        logger.warn(exitMessage);
      }
      if (currentServeWebBaseUrl) {
        logger.info("Clearing cached VS Code serve-web base URL");
        currentServeWebBaseUrl = null;
      }
      currentServeWebSocketPath = null;
    });

    child!.unref();

    await waitForSocket(socketPath);

    currentServeWebSocketPath = socketPath;
    const baseUrl = `http://${LOCAL_VSCODE_HOST}`;
    currentServeWebBaseUrl = baseUrl;

    logger.info(
      `VS Code serve-web ready at ${baseUrl} (pid ${child.pid ?? "unknown"}).`
    );

    await warmUpVSCodeServeWeb(socketPath, logger);

    return {
      process: child!,
      executable,
      socketPath,
    };
  } catch (error) {
    logger.error("Failed to launch VS Code serve-web via unix socket:", error);
    if (child && !child.killed && child.exitCode === null) {
      try {
        child.kill();
      } catch (killError) {
        logger.warn(
          "Failed to terminate VS Code serve-web after launch failure:",
          killError
        );
      }
    }
    try {
      await unlink(socketPath);
    } catch {
      // ignore cleanup errors here
    }
    currentServeWebBaseUrl = null;
    currentServeWebSocketPath = null;
    return null;
  }
}

export function stopVSCodeServeWeb(
  handle: VSCodeServeWebHandle | null,
  logger: Logger
): void {
  if (!handle) {
    return;
  }

  const { process: child, socketPath } = handle;

  currentServeWebBaseUrl = null;
  currentServeWebSocketPath = null;

  void unlink(socketPath).catch((error) => {
    if (
      error &&
      typeof error === "object" &&
      "code" in error &&
      (error as NodeJS.ErrnoException).code === "ENOENT"
    ) {
      return;
    }
    logger.warn(
      `Failed to remove VS Code serve-web socket at ${socketPath}:`,
      error
    );
  });

  if (child.killed || child.exitCode !== null || child.signalCode !== null) {
    return;
  }

  logger.info("Stopping VS Code serve-web process...");
  try {
    child.kill();
  } catch (error) {
    logger.error("Failed to stop VS Code serve-web process:", error);
  }
}

async function getVSCodeExecutable(logger: Logger) {
  logger.info("Attempting to resolve VS Code CLI executable for serve-web.");
  const executable = await resolveVSCodeExecutable(logger);
  if (!executable) {
    return null;
  }

  try {
    if (process.platform !== "win32") {
      await access(executable, fsConstants.X_OK);
    }
    return executable;
  } catch (error) {
    logger.error(`VS Code CLI at ${executable} is not executable:`, error);
    return null;
  }
}

async function resolveVSCodeExecutable(logger: Logger) {
  if (resolvedVSCodeExecutable) {
    return resolvedVSCodeExecutable;
  }

  const lookups =
    process.platform === "win32"
      ? [
          { command: "where", args: ["code.cmd"] },
          { command: "where", args: ["code.exe"] },
          { command: "where", args: ["code"] },
        ]
      : [{ command: "/usr/bin/env", args: ["which", "code"] }];

  for (const { command, args } of lookups) {
    try {
      const { stdout } = await execFileAsync(command, args);
      const candidate = stdout
        .split(/\r?\n/)
        .map((line) => line.trim())
        .find((line) => line.length > 0);

      if (candidate) {
        resolvedVSCodeExecutable = candidate;
        logger.info(`Resolved VS Code CLI executable: ${candidate}`);
        break;
      }
    } catch (error) {
      logger.debug?.(`VS Code CLI lookup with ${command} failed:`, error);
    }
  }

  if (!resolvedVSCodeExecutable && process.env.SHELL) {
    try {
      const { stdout } = await execFileAsync(process.env.SHELL, [
        "-lc",
        "command -v code",
      ]);
      const candidate = stdout
        .split(/\r?\n/)
        .map((line) => line.trim())
        .find((line) => line.length > 0);
      if (candidate) {
        resolvedVSCodeExecutable = candidate;
        logger.info(
          `Resolved VS Code CLI executable via shell lookup: ${candidate}`
        );
      }
    } catch (error) {
      logger.debug?.(
        `VS Code CLI SHELL lookup failed (${process.env.SHELL}):`,
        error
      );
    }
  }

  return resolvedVSCodeExecutable;
}

async function warmUpVSCodeServeWeb(
  socketPath: string,
  logger: Logger
) {
  const warmupDeadline = Date.now() + 10_000;

  while (Date.now() < warmupDeadline) {
    try {
      await new Promise<void>((resolve, reject) => {
        const req = httpRequest(
          {
            socketPath,
            method: "GET",
            path: "/",
            headers: {
              host: LOCAL_VSCODE_HOST,
            },
          },
          (res) => {
            res.resume();
            res.on("end", resolve);
          }
        );
        req.on("error", reject);
        req.end();
      });
      logger.info("VS Code serve-web warm-up succeeded.");
      return;
    } catch (error) {
      logger.debug?.("VS Code serve-web warm-up attempt failed:", error);
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
  }

  logger.warn(
    "VS Code serve-web did not respond with HTTP 200 during warm-up window."
  );
}

function attachServeWebProcessLogging(child: ChildProcess, logger: Logger) {
  const debugLog = logger.debug ?? logger.info;

  pipeStreamLines(child.stdout, (line) => {
    debugLog(`[VS Code serve-web stdout] ${line}`);
  });

  pipeStreamLines(child.stderr, (line) => {
    logger.warn(`[VS Code serve-web stderr] ${line}`);
  });
}

function pipeStreamLines(
  stream: NodeJS.ReadableStream | null | undefined,
  onLine: (line: string) => void
) {
  if (!stream) {
    return;
  }

  let buffered = "";

  stream.on("data", (chunk: Buffer | string) => {
    buffered += chunk.toString();

    let newlineIndex = buffered.indexOf("\n");
    while (newlineIndex !== -1) {
      const line = buffered.slice(0, newlineIndex).replace(/\r$/, "");
      onLine(line);
      buffered = buffered.slice(newlineIndex + 1);
      newlineIndex = buffered.indexOf("\n");
    }
  });

  stream.on("end", () => {
    if (buffered.length > 0) {
      onLine(buffered.replace(/\r$/, ""));
    }
  });
}

function createSocketPath(): string {
  const filename = `cmux-vscode-${process.pid}-${Date.now()}.sock`;
  return path.join(tmpdir(), filename);
}

async function removeStaleSocket(socketPath: string, logger: Logger) {
  try {
    await unlink(socketPath);
    logger.info(`Removed stale VS Code serve-web socket at ${socketPath}`);
  } catch (error) {
    if (
      error &&
      typeof error === "object" &&
      "code" in error &&
      (error as NodeJS.ErrnoException).code === "ENOENT"
    ) {
      return;
    }
    logger.debug?.("Failed to remove stale VS Code serve-web socket:", error);
  }
}

async function waitForSocket(socketPath: string) {
  const deadline = Date.now() + SOCKET_READY_TIMEOUT_MS;

  while (Date.now() < deadline) {
    try {
      await access(socketPath, fsConstants.F_OK);
      return;
    } catch (error) {
      if (
        error &&
        typeof error === "object" &&
        "code" in error &&
        (error as NodeJS.ErrnoException).code === "ENOENT"
      ) {
        await new Promise((resolve) => setTimeout(resolve, 100));
        continue;
      }
      throw error;
    }
  }

  throw new Error(
    `VS Code serve-web socket ${socketPath} was not ready within ${SOCKET_READY_TIMEOUT_MS} ms`
  );
}
