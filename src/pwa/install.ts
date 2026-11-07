import { isIos, isStandalone } from './platform.ts';
import { readLocal, writeLocal } from '../storage/local.ts';

// Safari deletes a site's storage (IndexedDB included) after seven days of use without a visit.
// Home-screen web apps are exempt in practice, so on iOS the setup screen asks for exactly that.

const KEY = 'installNudgeDismissedAt';
export const NUDGE_SNOOZE_MS = 30 * 24 * 60 * 60 * 1000;

export const shouldNudgeInstall = (now: Date) => {
  if (!isIos() || isStandalone()) return false;
  const dismissed = readLocal(KEY);
  if (typeof dismissed !== 'string') return true;
  return (
    now.getTime() - new Date(dismissed).getTime() > NUDGE_SNOOZE_MS ||
    Number.isNaN(Date.parse(dismissed))
  );
};

export const dismissInstallNudge = (now: Date) =>
  writeLocal(KEY, now.toISOString());
