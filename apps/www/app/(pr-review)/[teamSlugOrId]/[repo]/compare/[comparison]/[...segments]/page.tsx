import { redirect } from "next/navigation";

type PageParams = {
  teamSlugOrId: string;
  repo: string;
  comparison: string;
  segments: string[];
};

type PageProps = {
  params: Promise<PageParams>;
};

export const dynamic = "force-dynamic";

export default async function ComparisonCatchallPage({
  params,
}: PageProps): Promise<never> {
  const { teamSlugOrId, repo, comparison } = await params;

  redirect(
    `/${encodeURIComponent(teamSlugOrId)}/${encodeURIComponent(
      repo
    )}/compare/${encodeURIComponent(comparison)}`
  );
}
