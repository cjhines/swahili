import { afterEach, beforeEach, expect, test, vi } from 'vitest';

import {
  dismissInstallNudge,
  NUDGE_SNOOZE_MS,
  shouldNudgeInstall,
} from './install.ts';

const IPHONE =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 19_0 like Mac OS X) AppleWebKit/605.1.15 Safari/604.1';
const ANDROID =
  'Mozilla/5.0 (Linux; Android 16; Pixel 9) AppleWebKit/537.36 Chrome/150.0 Mobile Safari/537.36';
const NOW = new Date('2026-03-01T09:00:00Z');

const as = (userAgent: string, { standalone = false } = {}) => {
  vi.spyOn(navigator, 'userAgent', 'get').mockReturnValue(userAgent);
  vi.stubGlobal('matchMedia', (query: string) => ({
    matches: standalone && query.includes('standalone'),
  }));
};

beforeEach(() => localStorage.clear());
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

test('nudges on an iPhone browsing in Safari', () => {
  as(IPHONE);
  expect(shouldNudgeInstall(NOW)).toBe(true);
});

test('not once it is on the Home Screen', () => {
  as(IPHONE, { standalone: true });
  expect(shouldNudgeInstall(NOW)).toBe(false);
});

test('not on Android, where browser storage is not cleared after 7 days', () => {
  as(ANDROID);
  expect(shouldNudgeInstall(NOW)).toBe(false);
});

test('"Not now" hides it for 30 days', () => {
  as(IPHONE);
  dismissInstallNudge(NOW);
  expect(
    shouldNudgeInstall(new Date(NOW.getTime() + NUDGE_SNOOZE_MS - 1000))
  ).toBe(false);
  expect(
    shouldNudgeInstall(new Date(NOW.getTime() + NUDGE_SNOOZE_MS + 1000))
  ).toBe(true);
  expect(Object.keys(localStorage)).toEqual([
    'swahili:installNudgeDismissedAt',
  ]);
});
