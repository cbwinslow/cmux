import { Octokit } from "octokit";

const USER_AGENT = "cmux-www-pr-viewer";

export function createGitHubClient(authToken?: string): Octokit {
  const token = authToken || process.env.GITHUB_TOKEN;

  return new Octokit({
    auth: token,
    userAgent: USER_AGENT,
    request: {
      timeout: 20_000,
    },
  });
}
