import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Heatmap diff viewer for code reviews",
  description:
    "Color-coded diff viewer that highlights lines and tokens by how much human attention they need.",
};

export default function HeatmapPage() {
  return (
    <div className="flex min-h-screen flex-col items-center bg-white p-8 text-black">
      <div className="mx-auto mb-0 mt-[70px] max-w-3xl">
        <h1 className="mb-8 text-3xl font-bold">
          A heatmap diff viewer for code reviews
        </h1>

        <div className="mb-8 text-base leading-[1.6]">
          <p className="mb-4">
            Heatmap color-codes every diff line/token by how much human
            attention it probably needs. Unlike PR-review bots, we try to flag
            not just by &ldquo;is it a bug?&rdquo; but by &ldquo;is it worth a
            second look?&rdquo; (examples: hard-coded secret, weird crypto mode,
            gnarly logic).
          </p>

          <p className="mb-4">
            Try it by changing any GitHub pull request url link to 0github.com.
            Under the hood, we spin up gpt-5-codex for every diff and ask it to
            output a JSON data structure that we parse into a colored heatmap.
          </p>
        </div>

        <div className="mt-8 text-base">
          <p className="mb-4">Examples:</p>
          <div className="flex flex-col gap-2">
            <a
              href="https://0github.com/tinygrad/tinygrad/pull/12999"
              target="_blank"
              rel="noopener noreferrer"
              className="text-black underline"
            >
              https://0github.com/tinygrad/tinygrad/pull/12999
            </a>
            <a
              href="https://0github.com/simonw/datasette/pull/2548"
              target="_blank"
              rel="noopener noreferrer"
              className="text-black underline"
            >
              https://0github.com/simonw/datasette/pull/2548
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
