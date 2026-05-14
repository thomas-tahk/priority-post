"use client";

import { useCallback, useRef, useState } from "react";

type ExplainRequest = { kind: "why" } | { kind: "task"; taskId: number };

export function ExplainStream({
  request,
  buttonLabel,
  buttonClass = "explain-trigger",
}: {
  request: ExplainRequest;
  buttonLabel: string;
  buttonClass?: string;
}) {
  const [text, setText] = useState("");
  const [state, setState] = useState<"idle" | "streaming" | "done" | "error">(
    "idle"
  );
  const abortRef = useRef<AbortController | null>(null);

  const start = useCallback(async () => {
    if (state === "streaming") return;
    setText("");
    setState("streaming");
    const abort = new AbortController();
    abortRef.current = abort;
    try {
      const resp = await fetch("/api/explain", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(request),
        signal: abort.signal,
      });
      if (!resp.ok || !resp.body) {
        setText(`Error: ${resp.status} ${resp.statusText || "stream failed"}`);
        setState("error");
        return;
      }
      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        if (value) {
          const chunk = decoder.decode(value, { stream: true });
          setText((t) => t + chunk);
        }
      }
      setState("done");
    } catch (e) {
      if (e instanceof DOMException && e.name === "AbortError") {
        setState("idle");
        return;
      }
      setText("Sorry, the explain stream failed.");
      setState("error");
    }
  }, [request, state]);

  const close = useCallback(() => {
    abortRef.current?.abort();
    setText("");
    setState("idle");
  }, []);

  if (state === "idle") {
    return (
      <button type="button" className={buttonClass} onClick={start}>
        {buttonLabel}
      </button>
    );
  }

  return (
    <div className="explain-card">
      <div className="explain-text">
        {text}
        {state === "streaming" && <span className="explain-cursor">▌</span>}
      </div>
      <div className="explain-actions">
        <button type="button" className="explain-close" onClick={close}>
          {state === "streaming" ? "Stop" : "Close"}
        </button>
      </div>
    </div>
  );
}
