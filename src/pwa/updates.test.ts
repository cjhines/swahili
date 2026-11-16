import { describe, expect, test, vi } from 'vitest';

import { fetchNewest } from './updates.ts';

/** A stand-in for a service worker that finishes installing when told to. */
const worker = () => {
  const sw = new EventTarget() as EventTarget & { state: string };
  sw.state = 'installing';
  return {
    sw: sw as unknown as ServiceWorker,
    finish: (state = 'installed') => {
      sw.state = state;
      sw.dispatchEvent(new Event('statechange'));
    },
  };
};

const settledWithin = async (promise: Promise<unknown>, ms: number) =>
  Promise.race([
    promise.then(() => true),
    new Promise((resolve) => setTimeout(() => resolve(false), ms)),
  ]);

describe('fetchNewest, before "Update now" switches versions', () => {
  test('waits for an even newer version to finish downloading', async () => {
    const newer = worker();
    const registration = {
      installing: null as ServiceWorker | null,
      update: vi.fn(async () => {
        registration.installing = newer.sw;
      }),
    };
    const done = fetchNewest(registration as never);
    expect(await settledWithin(done, 50)).toBe(false); // still downloading
    newer.finish();
    expect(await settledWithin(done, 50)).toBe(true);
    expect(registration.update).toHaveBeenCalledOnce();
  });

  test('carries straight on when there is nothing newer', async () => {
    const registration = { installing: null, update: vi.fn(async () => {}) };
    expect(await settledWithin(fetchNewest(registration as never), 50)).toBe(
      true
    );
  });

  test('carries on offline', async () => {
    const registration = {
      installing: null,
      update: vi.fn(async () => {
        throw new TypeError('Failed to fetch');
      }),
    };
    expect(await settledWithin(fetchNewest(registration as never), 50)).toBe(
      true
    );
  });

  test('gives up waiting after the timeout', async () => {
    const stuck = worker();
    const registration = {
      installing: stuck.sw,
      update: vi.fn(async () => {}),
    };
    expect(
      await settledWithin(fetchNewest(registration as never, 30), 200)
    ).toBe(true);
  });
});
