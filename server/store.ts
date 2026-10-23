import type { State } from "../shared/types.ts";
import type { Sheets } from "./sheets.ts";
export class Store {
  private tail: Promise<unknown> = Promise.resolve();
  syncError = "";
  constructor(
    public state: State,
    readonly sheets?: Sheets,
  ) {}
  async recover() {
    const operation = this.tail.then(async () => {
      if (!this.sheets) return;
      try {
        const remote = await this.sheets.initialize();
        for (const job of remote.jobs)
          if (job.status === "running") {
            job.status = "uncertain";
            job.detail =
              "Interrupted job. Verify its outcome before taking any further action.";
          }
        await this.sheets.save(remote);
        this.state = remote;
        this.syncError = "";
      } catch (e) {
        this.syncError =
          e instanceof Error ? e.message : "Sheets reconciliation failed";
        throw e;
      }
    });
    this.tail = operation.catch(() => {});
    return operation;
  }
  async change<T>(fn: (state: State) => T | Promise<T>): Promise<T> {
    const operation = this.tail.then(async () => {
      if (this.sheets && this.syncError)
        throw new Error(
          `Sheets dispatch paused: ${this.syncError}. Reconnect before making further changes.`,
        );
      const candidate = structuredClone(this.state);
      const result = await fn(candidate);
      if (this.sheets) {
        try {
          await this.sheets.save(candidate);
          this.syncError = "";
        } catch (e) {
          this.syncError =
            e instanceof Error ? e.message : "Sheets sync failed";
          throw e;
        }
      }
      this.state = candidate;
      return result;
    });
    this.tail = operation.catch(() => {});
    return operation;
  }
}
