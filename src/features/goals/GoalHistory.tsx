"use client";

import { useState } from "react";
import type { Task, Goal } from "@/db/schema";
import { DoneRow } from "@/features/tasks/DoneRow";
import { dayKeyIn } from "@/features/planner/clock";
import { daysBetween } from "./objectives";
import { CAT_COLOR_VAR } from "./colors";
import { TREND_WEEKS, weeklyHistory, weekLabel, keyDate, type HistoryWeek } from "./history";

/** Weeks shown before "show older". */
const RECENT_WEEKS = 4;

export function GoalHistory({
  goal,
  done,
  timezone,
  onOpen,
}: {
  goal: Goal;
  done: Task[];
  timezone: string;
  onOpen: (t: Task) => void;
}) {
  const [showOlder, setShowOlder] = useState(false);
  const now = new Date();
  const weeks = weeklyHistory(done, now, timezone);
  const met = (n: number) => goal.weeklyTarget !== null && n >= goal.weeklyTarget;

  // Trailing empty weeks are padding for the trend strip, not history.
  const lastFull = weeks.findLastIndex((w) => w.tasks.length > 0);
  const timeline = weeks.slice(0, lastFull + 1);
  const visible = showOlder ? timeline : timeline.slice(0, RECENT_WEEKS);
  const hiddenCount = timeline.slice(RECENT_WEEKS).reduce((n, w) => n + w.tasks.length, 0);

  return (
    <div className="goal-history" style={{ "--goal": CAT_COLOR_VAR(goal.color) } as React.CSSProperties}>
      <p className="section-label" style={{ marginTop: 28 }}>
        history · {done.length} closed
      </p>
      <TrendCard goal={goal} weeks={weeks.slice(0, TREND_WEEKS)} met={met} today={dayKeyIn(now, timezone)} />
      <div className="timeline">
        {visible.map((w, i) => (
          <TimelineWeek key={w.startKey} week={w} index={i} met={met} hasTarget={goal.weeklyTarget !== null}>
            {w.tasks.map((t) => (<DoneRow key={t.id} task={t} timezone={timezone} onOpen={onOpen} />))}
          </TimelineWeek>
        ))}
      </div>
      {hiddenCount > 0 && (
        <button type="button" className="show-older" onClick={() => setShowOlder((s) => !s)}>
          {showOlder ? "show fewer" : `show older · ${hiddenCount} more`}
        </button>
      )}
    </div>
  );
}

function TrendCard({
  goal,
  weeks,
  met,
  today,
}: {
  goal: Goal;
  weeks: HistoryWeek[];
  met: (n: number) => boolean;
  today: string;
}) {
  const counts = weeks.map((w) => w.tasks.length);
  const total = counts.reduce((a, b) => a + b, 0);
  const max = Math.max(1, ...counts);
  const sub =
    goal.weeklyTarget !== null
      ? `done in ${weeks.length} weeks · target met ${counts.filter(met).length} of ${weeks.length}`
      : `done in ${weeks.length} weeks · avg ${(total / weeks.length).toFixed(1)}/wk`;

  return (
    <div className="trend">
      <div className="trend-top">
        <span className="trend-total">{total}</span>
        <span className="trend-sub">{sub}</span>
        {goal.kind === "gate" && goal.targetDate && <GateBadge targetDate={goal.targetDate} today={today} />}
      </div>
      <div className="trend-bars">
        {[...weeks].reverse().map((w, i) => {
          const n = w.tasks.length;
          const index = weeks.length - 1 - i;
          const faded = goal.weeklyTarget !== null && !met(n);
          return (
            <div
              key={w.startKey}
              className={`trend-bar ${faded ? "faded" : ""} ${index === 0 ? "now" : ""}`}
              style={{ height: `${(n / max) * 100}%` }}
              title={`${weekLabel(index, w.startKey)}: ${n}`}
            />
          );
        })}
      </div>
    </div>
  );
}

function GateBadge({ targetDate, today }: { targetDate: string; today: string }) {
  const left = daysBetween(today, targetDate);
  const text = left >= 0 ? `${left} days left · due ${keyDate(targetDate)}` : `due ${keyDate(targetDate)} · passed`;
  return <span className="trend-gate">{text}</span>;
}

function TimelineWeek({
  week,
  index,
  met,
  hasTarget,
  children,
}: {
  week: HistoryWeek;
  index: number;
  met: (n: number) => boolean;
  hasTarget: boolean;
  children: React.ReactNode;
}) {
  const n = week.tasks.length;
  const dot = n === 0 ? "empty" : !hasTarget || met(n) ? "filled" : "";
  return (
    <div className={`tl-week ${dot}`}>
      <div className="tl-head">
        {weekLabel(index, week.startKey)} <span className="tl-count">· {n}</span>
        {met(n) && <span className="tl-met">✓ target met</span>}
      </div>
      {n === 0 ? <div className="tl-empty">nothing closed this week</div> : children}
    </div>
  );
}
