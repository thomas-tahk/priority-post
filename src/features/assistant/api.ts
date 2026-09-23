// Typed HTTP client for the web app's /api/internal/* surface. The bot is the
// only caller; auth is the shared secret. Shapes mirror the JSON returned by the
// route handlers (kept local so the bot stays a standalone deployment).

export type CompactTask = {
  id: number;
  title: string;
  categories: string[];
  urgency: number | null;
  importance: number | null;
  estTimeMin: number | null;
  focus: string | null;
  startAt: string | null;
  goalId: number | null;
  score: number;
};

export type Digest = {
  top: CompactTask[];
  overdueTasks: CompactTask[];
  idleGoals: { id: number; name: string; idleDays: number }[];
};

export type DueEvent = { kind: "due_soon" | "overdue"; task: CompactTask };
export type ProgressResult = {
  summary: string;
  stats: {
    sinceDays: number;
    completed: number;
    created: number;
    open: number;
    overdueOpen: number;
    idleGoals: number;
  };
};

export interface PlannerApi {
  listTasks(): Promise<CompactTask[]>;
  createTask(input: { title: string; categories?: string[]; goalId?: number; startAt?: string }): Promise<{ id: number }>;
  patchTask(id: number, patch: { done?: boolean; title?: string; startAt?: string | null }): Promise<void>;
  deleteTask(id: number): Promise<void>;
  getDigest(): Promise<Digest>;
  getDueSoon(): Promise<DueEvent[]>;
  markReminder(taskId: number, kind: "due_soon" | "overdue"): Promise<void>;
  decomposeGoal(input: { goalId?: number; name?: string; description?: string }): Promise<string[]>;
  getProgress(days: number): Promise<ProgressResult>;
}

export class HttpPlannerApi implements PlannerApi {
  constructor(
    private readonly baseUrl: string,
    private readonly secret: string
  ) {}

  private async call<T>(path: string, method: string, body?: unknown): Promise<T> {
    const res = await fetch(`${this.baseUrl}${path}`, {
      method,
      headers: {
        "x-internal-secret": this.secret,
        ...(body ? { "content-type": "application/json" } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(`planner API ${method} ${path} → ${res.status} ${text}`.trim());
    }
    const ct = res.headers.get("content-type") ?? "";
    return (ct.includes("application/json") ? await res.json() : undefined) as T;
  }

  async listTasks() {
    return (await this.call<{ tasks: CompactTask[] }>("/api/internal/tasks", "GET")).tasks;
  }
  async createTask(input: { title: string; categories?: string[]; goalId?: number; startAt?: string }) {
    return this.call<{ id: number }>("/api/internal/tasks", "POST", input);
  }
  async patchTask(id: number, patch: { done?: boolean; title?: string; startAt?: string | null }) {
    await this.call(`/api/internal/tasks/${id}`, "PATCH", patch);
  }
  async deleteTask(id: number) {
    await this.call(`/api/internal/tasks/${id}`, "DELETE");
  }
  async getDigest() {
    return this.call<Digest>("/api/internal/digest", "GET");
  }
  async getDueSoon() {
    return (await this.call<{ events: DueEvent[] }>("/api/internal/due-soon", "GET")).events;
  }
  async markReminder(taskId: number, kind: "due_soon" | "overdue") {
    await this.call("/api/internal/reminders/mark", "POST", { taskId, kind });
  }
  async decomposeGoal(input: { goalId?: number; name?: string; description?: string }) {
    return (await this.call<{ proposals: string[] }>("/api/internal/goals/decompose", "POST", input)).proposals;
  }
  async getProgress(days: number) {
    return this.call<ProgressResult>(`/api/internal/progress?days=${days}`, "GET");
  }
}
