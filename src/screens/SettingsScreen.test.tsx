import 'fake-indexeddb/auto';

import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {
  afterEach,
  beforeAll,
  beforeEach,
  expect,
  onTestFinished,
  test,
  vi,
} from 'vitest';

import { SettingsScreen } from './SettingsScreen.tsx';
import { Notices } from '../components/Notices.tsx';
import { reportUpdateWaiting } from '../pwa/updates.ts';
import { createScheduler, type Scheduler } from '../scheduler/scheduler.ts';
import { serializeBackup } from '../storage/backup.ts';
import { ProgressStore } from '../storage/progress.ts';

const NOW = new Date('2026-03-01T09:00:00Z');

let scheduler: Scheduler;
let store: ProgressStore;
let n = 0;
const others: ProgressStore[] = [];
beforeAll(async () => {
  scheduler = await createScheduler({ fuzz: false });
});
beforeEach(async () => {
  store = await ProgressStore.open({
    scheduler,
    dbName: `settings-test-${++n}`,
  });
});
afterEach(() => {
  store.close();
  others.splice(0).forEach((s) => s.close());
  vi.restoreAllMocks();
});

/** A backup file from another device that knows kesho and moja. */
const backupFile = async () => {
  const other = await ProgressStore.open({
    scheduler,
    dbName: `settings-other-${n}`,
  });
  others.push(other);
  await other.mark({
    cardId: 'vocab-kesho',
    direction: 'sw-en',
    grade: 'got',
    mode: 'practice',
    now: NOW,
  });
  await other.mark({
    cardId: 'vocab-moja',
    direction: 'en-sw',
    grade: 'missed',
    mode: 'practice',
    now: NOW,
  });
  return new File(
    [serializeBackup(await other.exportData(), NOW)],
    'backup.json',
    { type: 'application/json' }
  );
};

const renderSettings = () => {
  const user = userEvent.setup();
  const onBack = vi.fn();
  render(<SettingsScreen store={store} onBack={onBack} />);
  return { user, onBack };
};

test('saving a backup downloads a dated JSON file and records when', async () => {
  // jsdom has no object URLs; provide them for this test only.
  const createObjectURL = vi.fn((_: Blob) => 'blob:backup');
  Object.assign(URL, { createObjectURL, revokeObjectURL: vi.fn() });
  onTestFinished(() => {
    delete (URL as Partial<typeof URL>).createObjectURL;
    delete (URL as Partial<typeof URL>).revokeObjectURL;
  });
  const click = vi
    .spyOn(HTMLAnchorElement.prototype, 'click')
    .mockImplementation(() => undefined);
  await store.mark({
    cardId: 'vocab-kesho',
    direction: 'sw-en',
    grade: 'got',
    mode: 'practice',
    now: NOW,
  });

  const { user } = renderSettings();
  expect(await screen.findByText('Last backup: never')).toBeInTheDocument();
  await user.click(screen.getByRole('button', { name: 'Save a backup' }));

  expect(click).toHaveBeenCalledOnce();
  const saved = createObjectURL.mock.calls[0]![0] as File;
  expect(saved.name).toMatch(/^swahili-progress-\d{4}-\d{2}-\d{2}\.json$/);
  expect(JSON.parse(await saved.text()).progress).toHaveLength(1);
  expect(await screen.findByRole('status')).toHaveTextContent(
    `Saved ${saved.name}.`
  );
  expect(screen.getByText(/^Last backup: /)).not.toHaveTextContent('never');
  expect(await store.getMeta('lastExportAt')).toBeInstanceOf(Date);
});

test('loading a backup merges it in', async () => {
  const file = await backupFile();
  const { user } = renderSettings();
  await user.upload(screen.getByLabelText('Load a backup (merge)'), file);

  expect(await screen.findByRole('status')).toHaveTextContent(
    'Merged: 2 cards updated from the backup.'
  );
  expect(store.stateOf('vocab-kesho:sw-en')).toBeDefined();
  expect(store.stateOf('vocab-moja:en-sw')).toBeDefined();
});

test('replacing asks first, and declining changes nothing', async () => {
  await store.mark({
    cardId: 'vocab-tatu',
    direction: 'sw-en',
    grade: 'got',
    mode: 'practice',
    now: NOW,
  });
  const file = await backupFile();
  const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false);
  const { user } = renderSettings();

  await user.upload(
    screen.getByLabelText('Replace everything with a backup…'),
    file
  );
  expect(confirm).toHaveBeenCalledOnce();
  expect(store.stateOf('vocab-tatu:sw-en')).toBeDefined();
  expect(store.stateOf('vocab-kesho:sw-en')).toBeUndefined();

  confirm.mockReturnValue(true);
  await user.upload(
    screen.getByLabelText('Replace everything with a backup…'),
    file
  );
  expect(await screen.findByRole('status')).toHaveTextContent(
    'Restored 2 cards from the backup.'
  );
  expect(store.stateOf('vocab-tatu:sw-en')).toBeUndefined();
  expect(store.stateOf('vocab-kesho:sw-en')).toBeDefined();
});

test('a file that is not a backup is refused, with nothing changed', async () => {
  const { user } = renderSettings();
  await user.upload(
    screen.getByLabelText('Load a backup (merge)'),
    new File(['{"notes":"shopping list"}'], 'notes.json', {
      type: 'application/json',
    })
  );
  expect(await screen.findByRole('alert')).toHaveTextContent(
    "This file isn't a Swahili flashcards backup."
  );
  expect(store.all.size).toBe(0);
});

test('Back goes back', async () => {
  const { user, onBack } = renderSettings();
  await user.click(screen.getByRole('button', { name: 'Back' }));
  expect(onBack).toHaveBeenCalledOnce();
});

test('an update waiting shows "Update now", which applies it', async () => {
  const apply = vi.fn();
  render(<Notices />);
  expect(
    screen.queryByRole('button', { name: 'Update now' })
  ).not.toBeInTheDocument();
  act(() => reportUpdateWaiting(apply));
  await userEvent
    .setup()
    .click(screen.getByRole('button', { name: 'Update now' }));
  expect(apply).toHaveBeenCalledOnce();
});
