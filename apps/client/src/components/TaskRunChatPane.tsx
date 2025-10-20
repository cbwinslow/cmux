import { TaskTimeline } from "@/components/task-timeline";
import type { Doc, Id } from "@cmux/convex/dataModel";
import type { TaskRunWithChildren } from "@/types/task";
import { MessageCircle } from "lucide-react";

interface TaskRunChatPaneProps {
  task: Doc<"tasks"> | null | undefined;
  taskRuns: TaskRunWithChildren[] | null | undefined;
  crownEvaluation?: {
    evaluatedAt?: number;
    winnerRunId?: Id<"taskRuns">;
    reason?: string;
  } | null;
}

export function TaskRunChatPane({
  task,
  taskRuns,
  crownEvaluation,
}: TaskRunChatPaneProps) {
  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-2 border-b border-neutral-200 px-3 py-2 dark:border-neutral-800">
        <div className="flex size-6 items-center justify-center rounded-full bg-neutral-200 text-neutral-700 dark:bg-neutral-800 dark:text-neutral-200">
          <MessageCircle className="size-3.5" aria-hidden />
        </div>
        <h2 className="text-sm font-medium text-neutral-800 dark:text-neutral-100">
          Chat &amp; Activity
        </h2>
      </div>
      <div className="flex-1 overflow-y-auto px-3 py-2">
        {taskRuns ? (
          <TaskTimeline
            task={task ?? null}
            taskRuns={taskRuns}
            crownEvaluation={crownEvaluation ?? null}
          />
        ) : (
          <div className="flex h-full items-center justify-center text-sm text-neutral-500 dark:text-neutral-400">
            Loading conversation…
          </div>
        )}
      </div>
    </div>
  );
}
