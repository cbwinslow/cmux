interface PromptConfig {
  baseBranch: string;
  mergeBase: string;
  formattedFileList: string;
  prDescription: string | null;
}

export function formatFileList(files: readonly string[]): string {
  return files
    .map((file, index) => `${index + 1}. ${file}`)
    .join("\n");
}

export function buildScreenshotPrompt({
  baseBranch,
  mergeBase,
  formattedFileList,
  prDescription,
}: PromptConfig): string {
  const sections = [
    "You are a release engineer evaluating repository changes to determine if screenshots need refreshing before sharing updates.",
    `Repository base branch: ${baseBranch}`,
    `Merge base commit: ${mergeBase}`,
    prDescription
      ? `Pull request description:\n${prDescription}`
      : "Pull request description: <none provided>",
    `Changed files since base:\n${formattedFileList}`,
    [
      "Return a JSON object matching { hasUiChanges: boolean; uiChangesToScreenshotInstructions: string }.",
      "Set hasUiChanges to true when the listed files imply UI changes that should be captured.",
      "If hasUiChanges is true, describe exactly which UI flows or screens to capture in uiChangesToScreenshotInstructions.",
      'If false, respond with "None".',
    ].join("\n"),
  ];

  return sections.join("\n\n");
}
