"use server";

import { revalidatePath } from "next/cache";
import { draftIssue, type IssueDraft } from "./intake";

export type ActionResult = { ok: true } | { ok: false; reason: string };

/** Apply a label the inbox handed us, to the number the inbox named.
 *
 * This app does not know what any of these strings mean. That is the point: the
 * factory owns its own vocabulary and can rename all of it without this list
 * going quiet. */
export async function applyFactoryLabel(
  repo: string,
  issueNumber: number,
  label: string,
): Promise<ActionResult> {
  const token = process.env.GITHUB_TOKEN;
  if (!token) return { ok: false, reason: "No GitHub token is configured." };

  try {
    const response = await fetch(`https://api.github.com/repos/${repo}/issues/${issueNumber}/labels`, {
      method: "POST",
      headers: {
        Accept: "application/vnd.github+json",
        Authorization: `Bearer ${token}`,
        "X-GitHub-Api-Version": "2022-11-28",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ labels: [label] }),
    });

    if (!response.ok) {
      return { ok: false, reason: `GitHub refused the change (${response.status}).` };
    }
  } catch {
    return { ok: false, reason: "Couldn't reach GitHub." };
  }

  revalidatePath("/");
  return { ok: true };
}


export type DraftResult = { ok: true; draft: IssueDraft } | { ok: false; reason: string };

/** Turn a sentence into a proposed issue. Creates nothing. */
export async function draftFactoryRequest(
  sentence: string,
  projects: string[],
): Promise<DraftResult> {
  const text = sentence.trim();
  if (!text) return { ok: false, reason: "Say what you want first." };
  if (projects.length === 0) {
    return { ok: false, reason: "The factory isn't set to build in any project yet." };
  }

  try {
    const draft = await draftIssue(text, projects);
    if (!draft) return { ok: false, reason: "Couldn't turn that into a task. Try naming the project." };
    return { ok: true, draft };
  } catch {
    return { ok: false, reason: "Couldn't reach Claude." };
  }
}

export type CreateResult = { ok: true; url: string } | { ok: false; reason: string };

/** File the draft the user just read and confirmed.
 *
 * Nothing is labelled here. It becomes an ordinary issue, and the factory's
 * builder already accepts a hand-written one — which is exactly why this costs
 * nothing on the factory side. */
export async function createFactoryIssue(draft: IssueDraft): Promise<CreateResult> {
  const token = process.env.GITHUB_TOKEN;
  if (!token) return { ok: false, reason: "No GitHub token is configured." };

  try {
    const response = await fetch(`https://api.github.com/repos/${draft.repo}/issues`, {
      method: "POST",
      headers: {
        Accept: "application/vnd.github+json",
        Authorization: `Bearer ${token}`,
        "X-GitHub-Api-Version": "2022-11-28",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ title: draft.title, body: draft.body }),
    });

    if (!response.ok) {
      return { ok: false, reason: `GitHub refused it (${response.status}).` };
    }
    const created = (await response.json()) as { html_url?: string };
    revalidatePath("/");
    return { ok: true, url: created.html_url ?? "" };
  } catch {
    return { ok: false, reason: "Couldn't reach GitHub." };
  }
}
