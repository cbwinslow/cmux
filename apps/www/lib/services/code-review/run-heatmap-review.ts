import { createOpenAI } from "@ai-sdk/openai";
import { streamObject } from "ai";
import { api } from "@cmux/convex/api";
import type { Id } from "@cmux/convex/dataModel";
import { z } from "zod";

import { getConvex } from "@/lib/utils/get-convex";
import {
  collectPrDiffs,
  mapWithConcurrency,
  type HeatmapLine,
} from "@/scripts/pr-review-heatmap";
import { formatUnifiedDiffWithLineNumbers } from "@/scripts/pr-review/diff-utils";

interface HeatmapReviewConfig {
  jobId: string;
  teamId?: string;
  prUrl: string;
  prNumber?: number;
  accessToken: string;
  callbackToken: string;
  githubAccessToken?: string | null;
}

// Placeholder sandbox ID for heatmap strategy (no Morph VM used)
const HEATMAP_SANDBOX_ID = "heatmap-no-vm";

const heatmapSchema = z.object({
  lines: z.array(
    z.object({
      line: z.string(),
      changeType: z.enum(["addition", "deletion", "context"]),
      hasChanged: z.boolean(),
      shouldBeReviewedScore: z.number().min(0).max(1).optional(),
      shouldReviewWhy: z.string().optional(),
      mostImportantCharacterIndex: z.number(),
    })
  ),
});

function buildPrompt(filePath: string, formattedDiff: string[]): string {
  const diffBody =
    formattedDiff.length > 0 ? formattedDiff.join("\n") : "(no diff)";
  return `You are preparing a review heatmap for the file "${filePath}".
Return structured data matching the provided schema. Rules:
- Strip the leading "+", "-", or " " marker from each diff line and put the rest in the "line" field.
- Set changeType to "addition" for "+" lines, "deletion" for "-" lines, and "context" for " " lines.
- Include one entry per diff row that matters. Always cover every line that begins with "+" or "-".
- Use hasChanged=true for "+" or "-" rows and false for context rows that you still want to mention.
- When shouldBeReviewedScore is set, provide a short shouldReviewWhy hint (6-12 words). Leave both absent when the line is fine.
- shouldBeReviewedScore is a number from 0.00 to 1.00 that indicates how careful the reviewer should be when reviewing this line of code.
- mostImportantCharacterIndex must always be set. Count characters from the start of the line content (after stripping the marker).
- Keep explanations concise; do not invent code that is not in the diff.
- Anything that feels like it might be off or might warrant a comment should have a high score, even if it's technically correct.
- In most cases, the shouldReviewWhy should follow a template like "<X> <verb> <Y>" (eg. "line is too long" or "code accesses sensitive data").
- It should be understandable by a human and make sense (break the "X is Y" rule if it helps you make it more understandable).
- Non-clean code and ugly code (hard to read for a human) should be given a higher score.

Diff:
\`\`\`diff
${diffBody}
\`\`\``;
}

/**
 * Run PR review using the heatmap strategy without Morph.
 * This calls OpenAI API directly and processes the PR via GitHub API.
 * Results are streamed file-by-file to Convex.
 */
export async function runHeatmapReview(
  config: HeatmapReviewConfig
): Promise<void> {
  console.info("[heatmap-review] Starting heatmap review (no Morph)", {
    jobId: config.jobId,
    prUrl: config.prUrl,
  });

  const openAiApiKey = process.env.OPENAI_API_KEY;
  if (!openAiApiKey) {
    throw new Error("OPENAI_API_KEY environment variable is required");
  }

  const convex = getConvex({ accessToken: config.accessToken });

  try {
    // Fetch PR diffs via GitHub API
    console.info("[heatmap-review] Fetching PR diffs from GitHub", {
      jobId: config.jobId,
      prUrl: config.prUrl,
    });

    const githubToken =
      config.githubAccessToken ??
      process.env.GITHUB_TOKEN ??
      process.env.GH_TOKEN ??
      process.env.GITHUB_PERSONAL_ACCESS_TOKEN ??
      null;
    if (!githubToken) {
      throw new Error(
        "GitHub access token is required to run the heatmap review strategy."
      );
    }

    const { metadata, fileDiffs } = await collectPrDiffs({
      prIdentifier: config.prUrl,
      includePaths: [],
      maxFiles: null,
      githubToken,
    });

    // Sort files alphabetically by path
    const sortedFiles = [...fileDiffs].sort((a, b) =>
      a.filePath.localeCompare(b.filePath)
    );

    console.info("[heatmap-review] Processing files with heatmap strategy", {
      jobId: config.jobId,
      fileCount: sortedFiles.length,
    });

    const openai = createOpenAI({ apiKey: openAiApiKey });
    const allResults: Array<{ filePath: string; lines: HeatmapLine[] }> = [];
    const failures: Array<{ filePath: string; message: string }> = [];

    // Process files concurrently
    const CONCURRENCY = 10; // Reasonable concurrency for API calls
    const settled = await mapWithConcurrency(
      sortedFiles,
      CONCURRENCY,
      async (file, index) => {
        console.info(
          `[heatmap-review] [${index + 1}/${sortedFiles.length}] Processing ${file.filePath}...`
        );

        const formattedDiff = formatUnifiedDiffWithLineNumbers(file.diffText, {
          showLineNumbers: false,
          includeContextLineNumbers: false,
        });
        const prompt = buildPrompt(file.filePath, formattedDiff);

        const stream = streamObject({
          model: openai("gpt-4o"),
          schema: heatmapSchema,
          prompt,
          temperature: 0,
          maxRetries: 2,
        });

        const result = await stream.object;
        const fileResult = {
          filePath: file.filePath,
          lines: result.lines,
        };

        console.info(
          `[heatmap-review] [${index + 1}/${sortedFiles.length}] ✓ ${file.filePath}: ${result.lines.length} lines analyzed`
        );

        // Store file output in Convex immediately
        await convex.mutation(api.codeReview.upsertFileOutputFromCallback, {
          jobId: config.jobId as Id<"automatedCodeReviewJobs">,
          callbackToken: config.callbackToken,
          filePath: file.filePath,
          codexReviewOutput: fileResult,
          sandboxInstanceId: HEATMAP_SANDBOX_ID,
        });

        console.info(
          `[heatmap-review] File output stored for ${file.filePath}`
        );

        return fileResult;
      }
    );

    // Separate successes from failures
    for (const result of settled) {
      if (result.status === "fulfilled") {
        allResults.push(result.value);
      } else {
        const error = result.reason;
        const message =
          error instanceof Error ? error.message : String(error ?? "Unknown error");
        const filePath = "<unknown>";
        console.error(`[heatmap-review] ✗ ${filePath}: ${message}`);
        failures.push({ filePath, message });
      }
    }

    console.info("[heatmap-review] All files processed", {
      jobId: config.jobId,
      successes: allResults.length,
      failures: failures.length,
    });

    // Build final code review output
    const codeReviewOutput = {
      strategy: "heatmap",
      pr: {
        url: metadata.prUrl,
        number: metadata.number,
        repo: `${metadata.owner}/${metadata.repo}`,
        title: metadata.title,
      },
      files: allResults,
      failures,
    };

    // Mark job as completed in Convex
    await convex.mutation(api.codeReview.completeJobFromCallback, {
      jobId: config.jobId as Id<"automatedCodeReviewJobs">,
      callbackToken: config.callbackToken,
      sandboxInstanceId: HEATMAP_SANDBOX_ID,
      codeReviewOutput,
    });

    console.info("[heatmap-review] Job marked as completed", {
      jobId: config.jobId,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : String(error ?? "Unknown error");
    console.error("[heatmap-review] Review failed", {
      jobId: config.jobId,
      error: message,
    });

    // Mark job as failed in Convex
    try {
      await convex.mutation(api.codeReview.failJobFromCallback, {
        jobId: config.jobId as Id<"automatedCodeReviewJobs">,
        callbackToken: config.callbackToken,
        sandboxInstanceId: HEATMAP_SANDBOX_ID,
        errorCode: "heatmap_review_failed",
        errorDetail: message,
      });
    } catch (cleanupError) {
      console.error(
        "[heatmap-review] Failed to mark job as failed",
        cleanupError
      );
    }

    throw error;
  }
}
