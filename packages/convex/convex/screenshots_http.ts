import {
  ScreenshotUploadPayloadSchema,
  verifyTaskRunToken,
} from "../../shared/src/convex-safe";
import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { httpAction } from "./_generated/server";
import { env } from "../_shared/convex-env";

const JSON_HEADERS = {
  "Content-Type": "application/json",
};

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: JSON_HEADERS });
}

async function ensureJsonRequest(
  req: Request,
): Promise<{ json: unknown } | Response> {
  const contentType = req.headers.get("content-type") ?? "";
  if (!contentType.toLowerCase().includes("application/json")) {
    return jsonResponse(
      { code: 415, message: "Content-Type must be application/json" },
      415,
    );
  }

  try {
    const json = await req.json();
    return { json };
  } catch {
    return jsonResponse({ code: 400, message: "Invalid JSON body" }, 400);
  }
}

type WorkerAuthContext = {
  token: string;
  payload: {
    taskRunId: Id<"taskRuns">;
    teamId: string;
    userId: string;
  };
};

async function getWorkerAuth(req: Request): Promise<WorkerAuthContext | null> {
  const token = req.headers.get("x-cmux-token");
  if (!token) {
    return null;
  }

  try {
    const payload = await verifyTaskRunToken(
      token,
      env.CMUX_TASK_RUN_JWT_SECRET,
    );
    return {
      token,
      payload: {
        taskRunId: payload.taskRunId as Id<"taskRuns">,
        teamId: payload.teamId,
        userId: payload.userId,
      },
    } satisfies WorkerAuthContext;
  } catch (error) {
    console.error("[screenshots] Failed to verify worker token", error);
    return null;
  }
}

export const uploadScreenshot = httpAction(async (ctx, req) => {
  const auth = await getWorkerAuth(req);
  if (!auth) {
    throw jsonResponse({ code: 401, message: "Unauthorized" }, 401);
  }

  const parsed = await ensureJsonRequest(req);
  if (parsed instanceof Response) return parsed;

  const validation = ScreenshotUploadPayloadSchema.safeParse(parsed.json);
  if (!validation.success) {
    console.warn(
      "[screenshots] Invalid screenshot upload payload",
      validation.error,
    );
    return jsonResponse({ code: 400, message: "Invalid input" }, 400);
  }

  const payload = validation.data;

  const run = await ctx.runQuery(internal.taskRuns.getById, {
    id: payload.runId,
  });
  if (!run) {
    return jsonResponse({ code: 404, message: "Task run not found" }, 404);
  }

  if (
    run.teamId !== auth.payload.teamId ||
    run.userId !== auth.payload.userId ||
    run.taskId !== payload.taskId
  ) {
    return jsonResponse({ code: 401, message: "Unauthorized" }, 401);
  }

  const task = await ctx.runQuery(internal.tasks.getByIdInternal, {
    id: run.taskId,
  });
  if (!task) {
    return jsonResponse({ code: 404, message: "Task not found" }, 404);
  }

  let storageId: Id<"_storage"> | undefined;
  let mimeType: string | undefined;
  let fileName: string | undefined;

  if (payload.status === "completed") {
    if (!payload.image) {
      return jsonResponse(
        { code: 400, message: "Screenshot image payload required" },
        400,
      );
    }
    try {
      const buffer = Buffer.from(payload.image.data, "base64");
      const blob = new Blob([buffer], { type: payload.image.contentType });
      storageId = await ctx.storage.store(blob);
      mimeType = payload.image.contentType;
      fileName = payload.image.fileName;
    } catch (error) {
      console.error("[screenshots] Failed to store screenshot blob", error);
      return jsonResponse(
        { code: 500, message: "Failed to persist screenshot" },
        500,
      );
    }
  }

  await ctx.runMutation(internal.tasks.recordScreenshotResult, {
    taskId: run.taskId,
    runId: payload.runId,
    status: payload.status,
    storageId,
    mimeType,
    fileName,
    error: payload.error,
  });

  if (storageId) {
    await ctx.runMutation(internal.taskRuns.updateScreenshotMetadata, {
      id: payload.runId,
      storageId,
      mimeType,
      fileName,
    });
  } else if (payload.status !== "completed") {
    await ctx.runMutation(internal.taskRuns.clearScreenshotMetadata, {
      id: payload.runId,
    });
  }

  return jsonResponse({ ok: true, storageId: storageId ?? undefined });
});
