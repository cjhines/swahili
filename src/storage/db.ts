import { openDB, type DBSchema, type IDBPDatabase } from 'idb';

import type { Direction, Grade, Mode, ProgressKey } from '../domain.ts';
import type { MemoryState, ReviewLog } from '../scheduler/scheduler.ts';

// The app shares the cjhin.es origin with the main site, so the database is named after the
// app, never something generic.
export const DB_NAME = 'swahili';
export const DB_VERSION = 1;

/** One per card per direction. No record means the card is new in that direction. */
export type ProgressRecord = {
  key: ProgressKey;
  cardId: string;
  direction: Direction;
  /** ts-fsrs memory state, stored as-is. IndexedDB's structured clone keeps its Dates as Dates. */
  state: MemoryState;
  updatedAt: Date;
};

/** Every mark ever made. Not shown in v1; kept so stats can come later. */
export type ReviewRecord = {
  /** `${key}@${reviewedAt ISO}`: deterministic, so merging two backups can't duplicate a review. */
  id: string;
  key: ProgressKey;
  grade: Grade;
  mode: Mode;
  reviewedAt: Date;
  log: ReviewLog;
};

export type MetaRecord = { name: string; value: unknown };

export interface SwahiliSchema extends DBSchema {
  progress: { key: ProgressKey; value: ProgressRecord };
  reviews: {
    key: string;
    value: ReviewRecord;
    indexes: { byKey: ProgressKey };
  };
  meta: { key: string; value: MetaRecord };
}

export type SwahiliDb = IDBPDatabase<SwahiliSchema>;

export const openSwahiliDb = (name = DB_NAME) =>
  openDB<SwahiliSchema>(name, DB_VERSION, {
    upgrade(db, oldVersion) {
      if (oldVersion < 1) {
        db.createObjectStore('progress', { keyPath: 'key' });
        db.createObjectStore('reviews', { keyPath: 'id' }).createIndex(
          'byKey',
          'key'
        );
        db.createObjectStore('meta', { keyPath: 'name' });
      }
      // Future versions: add `if (oldVersion < 2) { … }` here. Never edit the block above.
    },
    // A newer version of the app opened in another tab needs this connection out of the way to
    // upgrade the schema. Close it rather than block that tab.
    blocking(_current, _blocked, event) {
      (event.target as IDBDatabase).close();
    },
  });
