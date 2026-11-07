import { z } from 'zod/mini';

import type { ProgressKey } from '../domain.ts';
import type { ProgressRecord, ReviewRecord } from './db.ts';

// The backup file: all progress and the review log, as JSON. Pure functions only; the store
// does the reading and writing.

export const BACKUP_FORMAT = 1;

export type BackupData = {
  progress: ProgressRecord[];
  reviews: ReviewRecord[];
};
export type Backup = BackupData & { exportedAt: Date };

// JSON turns Dates into strings, and ts-fsrs rejects date strings. These are every Date-valued
// field in a progress record, its FSRS state, a review and its FSRS log.
const DATE_FIELDS = new Set([
  'dueAt',
  'lastReviewAt',
  'reviewTime',
  'updatedAt',
  'reviewedAt',
  'exportedAt',
]);

export const serializeBackup = (data: BackupData, now: Date) =>
  JSON.stringify({
    app: 'swahili',
    format: BACKUP_FORMAT,
    exportedAt: now,
    ...data,
  });

export const backupFileName = (now: Date) =>
  `swahili-progress-${now.toISOString().slice(0, 10)}.json`;

const Key = z.custom<ProgressKey>(
  (value) => typeof value === 'string' && /:(sw-en|en-sw)$/.test(value)
);
const Direction = z.enum(['sw-en', 'en-sw']);

const State = z.looseObject({
  dueAt: z.date(),
  lastReviewAt: z.nullable(z.date()),
  stability: z.number(),
  difficulty: z.number(),
  state: z.number(),
  reps: z.number(),
  lapses: z.number(),
});

const Progress = z
  .object({
    key: Key,
    cardId: z.string(),
    direction: Direction,
    state: State,
    updatedAt: z.date(),
  })
  .check(
    z.refine(
      (record) => record.key === `${record.cardId}:${record.direction}`,
      'key must be cardId:direction'
    )
  );

const Review = z.object({
  id: z.string(),
  key: Key,
  grade: z.enum(['got', 'missed']),
  mode: z.enum(['practice', 'complete']),
  reviewedAt: z.date(),
  log: z.looseObject({}),
});

const BackupFile = z.object({
  app: z.literal('swahili'),
  format: z.literal(BACKUP_FORMAT),
  exportedAt: z.date(),
  progress: z.array(Progress),
  reviews: z.array(Review),
});

export type ParsedBackup =
  { ok: true; backup: Backup } | { ok: false; error: string };

export const parseBackup = (text: string): ParsedBackup => {
  let raw: unknown;
  try {
    raw = JSON.parse(text, (key, value) =>
      DATE_FIELDS.has(key) && typeof value === 'string'
        ? new Date(value)
        : value
    );
  } catch {
    return {
      ok: false,
      error: "This file isn't a backup: it isn't valid JSON.",
    };
  }
  if (
    typeof raw !== 'object' ||
    raw === null ||
    (raw as { app?: unknown }).app !== 'swahili'
  ) {
    return { ok: false, error: "This file isn't a Swahili flashcards backup." };
  }
  const parsed = BackupFile.safeParse(raw);
  if (!parsed.success) {
    const issue = parsed.error.issues[0]!;
    return {
      ok: false,
      error: `This backup is damaged (${issue.path.join('.') || 'file'}: ${issue.message}).`,
    };
  }
  const { exportedAt, progress, reviews } = parsed.data;
  return {
    ok: true,
    backup: {
      exportedAt,
      progress: progress as ProgressRecord[],
      reviews: reviews as ReviewRecord[],
    },
  };
};

const lastReviewed = (record: ProgressRecord) =>
  (record.state.lastReviewAt ?? record.updatedAt).getTime();

/**
 * Merging: for each card and direction, whichever copy was reviewed more recently wins. A tie
 * keeps what's already here. Returns what to write and how many local records were kept.
 */
export const mergeProgress = (
  existing: ReadonlyMap<ProgressKey, ProgressRecord>,
  incoming: readonly ProgressRecord[]
) => {
  const write: ProgressRecord[] = [];
  let kept = 0;
  for (const record of incoming) {
    const local = existing.get(record.key);
    if (!local || lastReviewed(record) > lastReviewed(local))
      write.push(record);
    else kept++;
  }
  return { write, kept };
};
