"use client";

import { useState } from "react";
import { AlertCircle, Github } from "lucide-react";
import { env } from "@/lib/utils/www-env";

interface PrivateRepoPromptProps {
  teamSlugOrId: string;
  repo: string;
  githubOwner: string;
}

export function PrivateRepoPrompt({
  teamSlugOrId,
  repo,
  githubOwner,
}: PrivateRepoPromptProps) {
  const [isRedirecting, setIsRedirecting] = useState(false);

  const handleInstallApp = async () => {
    setIsRedirecting(true);

    try {
      // Generate install state token from API
      const response = await fetch("/api/integrations/github/install-state", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ teamSlugOrId }),
      });

      if (!response.ok) {
        throw new Error("Failed to generate install state");
      }

      const { state } = await response.json();
      const currentUrl = window.location.href;

      // Build GitHub App installation URL
      const githubAppSlug = env.NEXT_PUBLIC_GITHUB_APP_SLUG;
      if (!githubAppSlug) {
        console.error("GitHub App slug not configured");
        setIsRedirecting(false);
        return;
      }

      const installUrl = new URL(
        `https://github.com/apps/${githubAppSlug}/installations/new`
      );
      installUrl.searchParams.set("state", state);

      // Store the current URL so we can redirect back after installation
      // The github_setup callback will check this and redirect appropriately
      if (typeof window !== "undefined" && window.sessionStorage) {
        window.sessionStorage.setItem("pr_review_return_url", currentUrl);
      }

      // Redirect to GitHub App installation
      window.location.href = installUrl.toString();
    } catch (error) {
      console.error("Failed to initiate GitHub App installation:", error);
      setIsRedirecting(false);
    }
  };

  return (
    <div className="min-h-dvh bg-neutral-50 text-neutral-900 flex items-center justify-center px-6">
      <div className="max-w-2xl w-full">
        <div className="rounded-xl border border-neutral-200 bg-white p-8 shadow-sm">
          <div className="flex items-start gap-4">
            <div className="flex-shrink-0">
              <div className="h-12 w-12 rounded-full bg-amber-50 flex items-center justify-center">
                <AlertCircle className="h-6 w-6 text-amber-600" />
              </div>
            </div>
            <div className="flex-1 min-w-0">
              <h1 className="text-2xl font-semibold text-neutral-900">
                Private Repository Access Required
              </h1>
              <p className="mt-3 text-base text-neutral-600 leading-relaxed">
                The repository{" "}
                <span className="font-mono font-medium text-neutral-900">
                  {githubOwner}/{repo}
                </span>{" "}
                appears to be private or you don't have access to view it.
              </p>

              <div className="mt-6 space-y-4">
                <div className="rounded-lg bg-neutral-50 p-4 border border-neutral-200">
                  <h2 className="text-sm font-semibold text-neutral-900 mb-2">
                    To continue, you need to:
                  </h2>
                  <ol className="space-y-2 text-sm text-neutral-600">
                    <li className="flex items-start gap-2">
                      <span className="flex-shrink-0 font-semibold text-neutral-900">
                        1.
                      </span>
                      <span>
                        Authenticate with GitHub and install the cmux-agent app
                      </span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="flex-shrink-0 font-semibold text-neutral-900">
                        2.
                      </span>
                      <span>
                        Grant access to the repository you want to review
                      </span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="flex-shrink-0 font-semibold text-neutral-900">
                        3.
                      </span>
                      <span>
                        You'll be redirected back to this page automatically
                      </span>
                    </li>
                  </ol>
                </div>

                <button
                  onClick={handleInstallApp}
                  disabled={isRedirecting}
                  className="w-full inline-flex items-center justify-center gap-3 rounded-lg bg-neutral-900 px-6 py-3 text-base font-medium text-white transition-colors hover:bg-neutral-800 focus:outline-none focus:ring-2 focus:ring-neutral-400 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isRedirecting ? (
                    <>
                      <div className="h-5 w-5 animate-spin rounded-full border-2 border-white border-t-transparent" />
                      <span>Redirecting to GitHub...</span>
                    </>
                  ) : (
                    <>
                      <Github className="h-5 w-5" />
                      <span>Continue with GitHub</span>
                    </>
                  )}
                </button>

                <p className="text-xs text-center text-neutral-500">
                  By continuing, you'll be redirected to GitHub to authorize the
                  cmux-agent application.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
