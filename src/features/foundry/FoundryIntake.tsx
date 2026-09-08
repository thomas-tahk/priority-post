"use client";

import { useState, useTransition } from "react";
import { createFactoryIssue, draftFactoryRequest } from "./actions";
import type { IssueDraft } from "./intake";

/** Ask the factory for something in a sentence.
 *
 * Two steps on purpose: the model drafts, you read it, then it is filed. The
 * expensive half of a request like this is a public issue with your name on it,
 * so nobody should be surprised by the words in it. */
export function FoundryIntake({ projects }: { projects: string[] }) {
  const [open, setOpen] = useState(false);
  const [sentence, setSentence] = useState("");
  const [draft, setDraft] = useState<IssueDraft | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  if (projects.length === 0) return null;

  function propose() {
    setMessage(null);
    startTransition(async () => {
      const result = await draftFactoryRequest(sentence, projects);
      if (result.ok) setDraft(result.draft);
      else setMessage(result.reason);
    });
  }

  function file() {
    if (!draft) return;
    startTransition(async () => {
      const result = await createFactoryIssue(draft);
      if (result.ok) {
        setDraft(null);
        setSentence("");
        setOpen(false);
        setMessage("Filed. It'll show up here when the factory picks it up.");
      } else {
        setMessage(result.reason);
      }
    });
  }

  if (!open) {
    return (
      <div className="foundry-intake-row">
        <button type="button" className="foundry-ask" onClick={() => setOpen(true)}>
          Ask the factory for something
        </button>
        {message && <span className="foundry-intake-msg">{message}</span>}
      </div>
    );
  }

  return (
    <div className="foundry-intake">
      {!draft ? (
        <>
          <input
            className="foundry-intake-input"
            placeholder="make the golf app deploy"
            value={sentence}
            autoFocus
            onChange={(e) => setSentence(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") propose();
              if (e.key === "Escape") setOpen(false);
            }}
          />
          <div className="foundry-acts">
            <button type="button" className="foundry-btn primary" disabled={pending} onClick={propose}>
              {pending ? "Writing…" : "Write it up"}
            </button>
            <button type="button" className="foundry-btn" onClick={() => setOpen(false)}>
              Cancel
            </button>
          </div>
        </>
      ) : (
        <>
          <p className="foundry-draft-repo">{shortRepo(draft.repo)}</p>
          <p className="foundry-draft-title">{draft.title}</p>
          <p className="foundry-detail">{draft.body}</p>
          <div className="foundry-acts">
            <button type="button" className="foundry-btn primary" disabled={pending} onClick={file}>
              {pending ? "Filing…" : "File it"}
            </button>
            <button type="button" className="foundry-btn" onClick={() => setDraft(null)}>
              Reword
            </button>
          </div>
        </>
      )}
      {message && <p className="foundry-error">{message}</p>}
    </div>
  );
}

function shortRepo(full: string) {
  return full.includes("/") ? full.split("/")[1] : full;
}
