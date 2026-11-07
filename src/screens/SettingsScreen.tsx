import { useEffect, useState, type ChangeEvent } from 'react';

import { persistStatus, type PersistStatus } from '../pwa/persistence.ts';
import { isIos, isStandalone } from '../pwa/platform.ts';
import {
  backupFileName,
  parseBackup,
  serializeBackup,
} from '../storage/backup.ts';
import type { ProgressStore } from '../storage/progress.ts';
import { fromNow, plural } from '../ui/format.ts';

import './settings.css';

const REPO_URL = 'https://github.com/cjhines/swahili';

type Message = { kind: 'ok' | 'error'; text: string };

/** iPhone: the share sheet (Save to Files) is the reliable way out of a home-screen app. Elsewhere: a download. */
const saveFile = async (file: File) => {
  if (isIos() && navigator.canShare?.({ files: [file] })) {
    await navigator.share({
      files: [file],
      title: 'Swahili flashcards backup',
    });
    return;
  }
  const url = URL.createObjectURL(file);
  const link = document.createElement('a');
  link.href = url;
  link.download = file.name;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
};

const PERSIST_TEXT: Record<PersistStatus, string> = {
  granted:
    'Granted. The browser has agreed not to clear your progress to free up space.',
  'not-granted':
    'Not granted. The browser may clear stored data when space runs low, ' +
    'or (Safari) after 7 days without a visit. Keep a backup.',
  unsupported: "This browser doesn't say. Keep a backup.",
};

export const SettingsScreen = ({
  store,
  onBack,
}: {
  store: ProgressStore;
  onBack: () => void;
}) => {
  const [lastExport, setLastExport] = useState<Date | undefined>();
  const [persist, setPersist] = useState<PersistStatus | undefined>();
  const [message, setMessage] = useState<Message | undefined>();
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    store
      .getMeta('lastExportAt')
      .then((value) =>
        setLastExport(value instanceof Date ? value : undefined)
      );
    persistStatus().then(setPersist);
  }, [store]);

  const exportBackup = async () => {
    setMessage(undefined);
    const now = new Date();
    const file = new File(
      [serializeBackup(await store.exportData(), now)],
      backupFileName(now),
      {
        type: 'application/json',
      }
    );
    try {
      await saveFile(file);
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') return; // share sheet dismissed
      setMessage({
        kind: 'error',
        text: `Couldn't save the backup: ${String(error)}`,
      });
      return;
    }
    await store.setMeta('lastExportAt', now);
    setLastExport(now);
    setMessage({ kind: 'ok', text: `Saved ${file.name}.` });
  };

  const importBackup =
    (mode: 'merge' | 'replace') =>
    async (event: ChangeEvent<HTMLInputElement>) => {
      const input = event.currentTarget;
      const file = input.files?.[0];
      input.value = ''; // so choosing the same file again still triggers a change
      if (!file) return;
      setMessage(undefined);

      const parsed = parseBackup(await file.text());
      if (!parsed.ok) {
        setMessage({ kind: 'error', text: parsed.error });
        return;
      }
      const { backup } = parsed;
      if (
        mode === 'replace' &&
        !window.confirm(
          `Replace ALL progress on this device with the backup from ${backup.exportedAt.toLocaleString()}? ` +
            "Anything not in the backup will be lost. This can't be undone."
        )
      ) {
        return;
      }

      setBusy(true);
      try {
        const result = await store.importData(backup, mode);
        setMessage({
          kind: 'ok',
          text:
            mode === 'replace'
              ? `Restored ${plural(result.written, 'card')} from the backup.`
              : `Merged: ${plural(result.written, 'card')} updated from the backup` +
                (result.kept
                  ? `, ${result.kept} kept because they're newer here.`
                  : '.'),
        });
      } catch (error) {
        setMessage({
          kind: 'error',
          text: `Import failed, nothing was changed: ${String(error)}`,
        });
      } finally {
        setBusy(false);
      }
    };

  return (
    <main className="page settings">
      <header className="settings-bar">
        <button
          type="button"
          className="icon-btn"
          aria-label="Back"
          onClick={onBack}
        >
          ←
        </button>
        <h1>Settings</h1>
      </header>

      <section aria-labelledby="backup-heading">
        <h2 id="backup-heading" className="section-label">
          Backup
        </h2>
        <p>
          Your progress is stored only on this device. Save a backup file now
          and then: it&apos;s the only way to get progress back if the browser
          clears it, or to move it to another device.
        </p>
        <p className="muted">
          Last backup: {lastExport ? fromNow(lastExport, new Date()) : 'never'}
        </p>

        <div className="settings-actions">
          <button
            type="button"
            className="btn btn-primary"
            onClick={exportBackup}
            disabled={busy}
          >
            Save a backup
          </button>
          <label className={`btn btn-quiet${busy ? ' is-disabled' : ''}`}>
            Load a backup (merge)
            <input
              type="file"
              accept="application/json,.json"
              className="visually-hidden"
              onChange={importBackup('merge')}
              disabled={busy}
            />
          </label>
          <p className="muted settings-hint">
            Merging keeps, for each card, whichever copy was reviewed most
            recently. Nothing is lost.
          </p>
          <label
            className={`btn btn-danger-quiet${busy ? ' is-disabled' : ''}`}
          >
            Replace everything with a backup…
            <input
              type="file"
              accept="application/json,.json"
              className="visually-hidden"
              onChange={importBackup('replace')}
              disabled={busy}
            />
          </label>
        </div>

        {message && (
          <p
            className={`settings-message is-${message.kind}`}
            role={message.kind === 'error' ? 'alert' : 'status'}
          >
            {message.text}
          </p>
        )}
      </section>

      <section aria-labelledby="storage-heading">
        <h2 id="storage-heading" className="section-label">
          This device
        </h2>
        <dl className="settings-facts">
          <dt>Persistent storage</dt>
          <dd>{persist ? PERSIST_TEXT[persist] : '…'}</dd>
          <dt>Installed as an app</dt>
          <dd>{isStandalone() ? 'Yes' : 'No. Running in a browser tab.'}</dd>
        </dl>
      </section>

      <section aria-labelledby="about-heading">
        <h2 id="about-heading" className="section-label">
          About
        </h2>
        <p className="muted">
          Version {__BUILD_SHA__.slice(0, 7)} ·{' '}
          <a href={REPO_URL} target="_blank" rel="noreferrer">
            Source code
          </a>{' '}
          · Code MIT, decks CC BY-SA 4.0
        </p>
      </section>
    </main>
  );
};
