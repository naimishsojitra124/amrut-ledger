export type JobStatus = "not-configured" | "scheduled" | "running" | "ok" | "failed";

export interface JobRun {
  status: JobStatus;
  lastRun: string | null;
  nextRun: string | null;
  durationMs: number | null;
  detail: string;
  failureReason: string | null;
}

// In memory on purpose: this is the health of the scheduler in *this* process, not a
// record of work done. A restart legitimately forgets it, and the first run refills it.
const runs = new Map<string, JobRun>();

export function setJobRun(id: string, run: Partial<JobRun>): void {
  const previous = runs.get(id) ?? {
    status: "not-configured" as JobStatus,
    lastRun: null,
    nextRun: null,
    durationMs: null,
    detail: "",
    failureReason: null,
  };

  runs.set(id, { ...previous, ...run });
}

export function getJobRun(id: string): JobRun | null {
  return runs.get(id) ?? null;
}
