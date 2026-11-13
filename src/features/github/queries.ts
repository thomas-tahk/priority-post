import type { TrackedItem } from "./grouping";

type RepoHit = { name: string; full_name: string; archived: boolean; open_issues_count: number };

type IssueHit = {
  number: number;
  title: string;
  html_url: string;
  draft?: boolean;
  pull_request?: unknown;
  labels: { name: string; color: string }[];
  updated_at: string;
};

function toItem(repo: string, hit: IssueHit): TrackedItem {
  return {
    repo,
    number: hit.number,
    title: hit.title,
    url: hit.html_url,
    isPr: hit.pull_request !== undefined,
    isDraft: hit.draft === true,
    labels: hit.labels.map((l) => ({ name: l.name, color: l.color })),
    updatedAt: hit.updated_at,
  };
}

async function getJson<T>(token: string, path: string): Promise<T> {
  const res = await fetch(`https://api.github.com/${path}`, {
    headers: { Authorization: `Bearer ${token}`, Accept: "application/vnd.github+json" },
    cache: "no-store",
  });
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { message?: string };
    throw new Error(`GitHub ${res.status} on ${path.split("?")[0]}: ${body.message ?? "no message"}`);
  }
  return (await res.json()) as T;
}

async function listReposWithOpenItems(token: string): Promise<RepoHit[]> {
  const repos: RepoHit[] = [];
  for (let page = 1; ; page++) {
    const batch = await getJson<RepoHit[]>(token, `user/repos?affiliation=owner&per_page=100&page=${page}`);
    repos.push(...batch);
    if (batch.length < 100) break;
  }
  return repos.filter((r) => !r.archived && r.open_issues_count > 0);
}

/** All open issues + PRs across the token owner's repos. Issues API includes PRs. */
export async function listOpenItems(): Promise<TrackedItem[]> {
  const token = process.env.GITHUB_TOKEN;
  if (!token) throw new Error("GITHUB_TOKEN not configured");
  const repos = await listReposWithOpenItems(token);
  const perRepo = await Promise.all(
    repos.map(async (r) => {
      const hits = await getJson<IssueHit[]>(token, `repos/${r.full_name}/issues?state=open&per_page=100`);
      return hits.map((h) => toItem(r.name, h));
    }),
  );
  return perRepo.flat();
}
