import {
  progressKey,
  type Direction,
  type Grade,
  type Mode,
  type ProgressKey,
} from '../domain.ts';
import { mergeProgress, type BackupData } from './backup.ts';
import {
  openSwahiliDb,
  type ProgressRecord,
  type ReviewRecord,
  type SwahiliDb,
} from './db.ts';
import type { MemoryState, Scheduler } from '../scheduler/scheduler.ts';

export type ImportResult = {
  mode: 'merge' | 'replace';
  /** Progress records written from the file. */
  written: number;
  /** Merge only: local records kept because they were reviewed more recently. */
  kept: number;
  reviews: number;
};

export type MarkInput = {
  cardId: string;
  direction: Direction;
  grade: Grade;
  mode: Mode;
  now: Date;
};

/**
 * All progress, loaded into memory once at startup (even thousands of records is trivial), with
 * every mark written through to IndexedDB immediately.
 *
 * Records for cards that no longer exist in any deck (orphans) are loaded, kept and ignored:
 * nothing deletes a record except a backup import the user chose to "replace" with. Queues are
 * built from the decks, so orphans never show up.
 */
export class ProgressStore {
  // Marks are applied strictly in order, each from the state the previous one produced, even if
  // the UI fires a second mark before the first has been written.
  private pending: Promise<unknown> = Promise.resolve();

  private constructor(
    private readonly db: SwahiliDb,
    private readonly scheduler: Scheduler,
    private readonly records: Map<ProgressKey, ProgressRecord>
  ) {}

  static async open({
    scheduler,
    dbName,
  }: {
    scheduler: Scheduler;
    dbName?: string;
  }) {
    const db = await openSwahiliDb(dbName);
    const records = new Map(
      (await db.getAll('progress')).map((record) => [record.key, record])
    );
    if (!(await db.get('meta', 'firstLaunchAt'))) {
      await db.put('meta', { name: 'firstLaunchAt', value: new Date() });
    }
    return new ProgressStore(db, scheduler, records);
  }

  /** Undefined means the card is new in that direction. */
  stateOf = (key: ProgressKey): MemoryState | undefined =>
    this.records.get(key)?.state;

  /** Every record, orphans included. */
  get all(): ReadonlyMap<ProgressKey, ProgressRecord> {
    return this.records;
  }

  /** Grades a card, then saves its new state and a review-log row in one transaction. */
  mark(input: MarkInput): Promise<ProgressRecord> {
    const run = this.pending.then(() => this.apply(input));
    this.pending = run.catch(() => undefined);
    return run;
  }

  private async apply({ cardId, direction, grade, mode, now }: MarkInput) {
    const key = progressKey(cardId, direction);
    const { state, log } = this.scheduler.review(
      key,
      this.stateOf(key),
      grade,
      now
    );
    const record: ProgressRecord = {
      key,
      cardId,
      direction,
      state,
      updatedAt: now,
    };
    const review: ReviewRecord = {
      id: `${key}@${now.toISOString()}`,
      key,
      grade,
      mode,
      reviewedAt: now,
      log,
    };

    const tx = this.db.transaction(['progress', 'reviews'], 'readwrite');
    await Promise.all([
      tx.objectStore('progress').put(record),
      tx.objectStore('reviews').put(review),
      tx.done,
    ]);

    // Only after the write has committed, so memory never runs ahead of what's saved.
    this.records.set(key, record);
    return record;
  }

  reviewsOf(key: ProgressKey): Promise<ReviewRecord[]> {
    return this.db.getAllFromIndex('reviews', 'byKey', key);
  }

  getMeta(name: string): Promise<unknown> {
    return this.db.get('meta', name).then((record) => record?.value);
  }

  async setMeta(name: string, value: unknown) {
    await this.db.put('meta', { name, value });
  }

  /** Everything a backup holds: all progress (orphans included) and the whole review log. */
  async exportData(): Promise<BackupData> {
    const [progress, reviews] = await Promise.all([
      this.db.getAll('progress'),
      this.db.getAll('reviews'),
    ]);
    return { progress, reviews };
  }

  /**
   * Loads a backup. `merge` keeps, per card and direction, whichever copy was reviewed last, and
   * adds any reviews not already logged. `replace` deletes everything first: the only thing in
   * the app that ever removes progress, and only when asked. Either way it's one transaction,
   * queued behind any marks still being saved.
   */
  importData(
    data: BackupData,
    mode: 'merge' | 'replace'
  ): Promise<ImportResult> {
    const run = this.pending.then(async () => {
      const tx = this.db.transaction(['progress', 'reviews'], 'readwrite');
      const progressStore = tx.objectStore('progress');
      const reviewStore = tx.objectStore('reviews');

      let write = data.progress;
      let kept = 0;
      if (mode === 'replace') {
        await Promise.all([progressStore.clear(), reviewStore.clear()]);
      } else {
        ({ write, kept } = mergeProgress(this.records, data.progress));
      }
      await Promise.all([
        ...write.map((record) => progressStore.put(record)),
        ...data.reviews.map((review) => reviewStore.put(review)),
        tx.done,
      ]);

      this.records.clear();
      for (const record of await this.db.getAll('progress'))
        this.records.set(record.key, record);
      return {
        mode,
        written: write.length,
        kept,
        reviews: data.reviews.length,
      };
    });
    this.pending = run.catch(() => undefined);
    return run;
  }

  close() {
    this.db.close();
  }
}
