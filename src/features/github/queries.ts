import type { TrackedItem } from "./grouping";

const OWNER = "thomas-tahk";
const MAX_PAGES = 3;

type SearchHit = {
  number: number;
  title: string;
  html_url: string;
  repository_url: string;
  draft?: boolean;
  pull_request?: unknown;
  labels: { name: string; color: string }[];
  updated_at: string;
};

function toItem(hit: SearchHit): TrackedItem {
  return {
    repo: hit.repository_url.split("/").pop() ?? "",
    number: hit.number,
    title: hit.title,
    url: hit.html_url,
    isPr: hit.pull_request !== undefined,
    isDraft: hit.draft === true,
    labels: hit.labels.map((l) => ({ name: l.name, color: l.color })),
    updatedAt: hit.updated_at,
  };
}

async function fetchPage(token: string, page: number): Promise<SearchHit[]> {
  const q = encodeURIComponent(`is:open user:${OWNER} archived:false`);
  const res = await fetch(
    `https://api.github.com/search/issues?q=${q}&sort=updated&per_page=100&page=${page}`,
    {
      headers: { Authorization: `Bearer ${token}`, Accept: "application/vnd.github+json" },
      cache: "no-store",
    },
  );
  if (!res.ok) throw new Error(`GitHub search failed: ${res.status}`);
  const body = (await res.json()) as { items: SearchHit[] };
  return body.items;
}

/** All open issues + PRs across the owner's repos, newest activity first. */
export async function listOpenItems(): Promise<TrackedItem[]> {
  const token = process.env.GITHUB_TOKEN;
  if (!token) throw new Error("GITHUB_TOKEN not configured");
  const hits: SearchHit[] = [];
  for (let page = 1; page <= MAX_PAGES; page++) {
    const batch = await fetchPage(token, page);
    hits.push(...batch);
    if (batch.length < 100) break;
  }
  return hits.map(toItem);
}
