import { useState } from 'react';

import { Choice } from '../components/Choice.tsx';
import type { VocabDeck } from '../content/schema.ts';
import type { Direction, Mode } from '../domain.ts';
import { practiceSummary, type StateOf } from '../session/queue.ts';
import type { ResumableRun } from '../session/resume.ts';
import {
  loadVocabSetup,
  NEW_CAP_OPTIONS,
  saveVocabSetup,
  type VocabSetup,
} from '../session/setup.ts';
import { vocabItems } from '../session/start.ts';
import { fromNow, plural } from '../ui/format.ts';

import './setup.css';

const DIRECTIONS = [
  { value: 'sw-en', label: 'Swahili → English' },
  { value: 'en-sw', label: 'English → Swahili' },
] as const satisfies readonly { value: Direction; label: string }[];

const MODES = [
  {
    value: 'practice',
    label: 'Practice',
    description: 'Cards that are due, plus some new ones.',
  },
  {
    value: 'complete',
    label: 'Complete deck',
    description: 'Every card in the chosen decks, once.',
  },
] as const satisfies readonly {
  value: Mode;
  label: string;
  description: string;
}[];

const DECK_KINDS = [
  { value: 'vocab', label: 'Vocabulary' },
  {
    value: 'nani',
    label: 'Nani na Lini?',
    description: 'Coming soon.',
    disabled: true,
  },
] as const;

export const directionLabel = (direction: Direction) =>
  DIRECTIONS.find((d) => d.value === direction)!.label;

type Props = {
  decks: readonly VocabDeck[];
  stateOf: StateOf;
  resume: ResumableRun | undefined;
  onStart: (setup: VocabSetup) => void;
  onResume: (run: ResumableRun) => void;
  onDiscardResume: () => void;
};

export const SetupScreen = ({
  decks,
  stateOf,
  resume,
  onStart,
  onResume,
  onDiscardResume,
}: Props) => {
  const [setup, setSetupState] = useState(() => loadVocabSetup(decks));
  const setSetup = (next: VocabSetup) => {
    setSetupState(next);
    saveVocabSetup(next);
  };
  const update = <K extends keyof VocabSetup>(key: K, value: VocabSetup[K]) =>
    setSetup({ ...setup, [key]: value });

  const toggleDeck = (id: string) =>
    update(
      'deckIds',
      setup.deckIds.includes(id)
        ? setup.deckIds.filter((deckId) => deckId !== id)
        : [...setup.deckIds, id]
    );
  const allSelected = setup.deckIds.length === decks.length;

  const now = new Date();
  const items = vocabItems(decks, setup.deckIds, setup.direction);
  const summary = practiceSummary(items, stateOf, now);
  const newThisSession = Math.min(summary.new, setup.newCap);
  const count =
    setup.mode === 'practice' ? summary.due + newThisSession : items.length;

  return (
    <main className="page setup">
      <header className="setup-header">
        <h1>
          Kadi za Kiswahili
          <span>Swahili flashcards</span>
        </h1>
      </header>

      {resume && (
        <section className="resume" aria-label="Unfinished run">
          <p>
            <strong>Unfinished Complete deck run</strong>
            <span className="muted">
              {resume.setup.deckIds
                .map((id) => decks.find((deck) => deck.id === id)?.title)
                .filter(Boolean)
                .join(', ')}{' '}
              · {directionLabel(resume.setup.direction)} ·{' '}
              {resume.state.finished.length} of {resume.state.total} done
            </span>
          </p>
          <div className="resume-actions">
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => onResume(resume)}
            >
              Resume ({resume.state.finished.length}/{resume.state.total})
            </button>
            <button
              type="button"
              className="btn btn-quiet"
              onClick={onDiscardResume}
            >
              Discard
            </button>
          </div>
        </section>
      )}

      <div className="setup-sections">
        <Choice
          legend="Deck type"
          options={DECK_KINDS}
          value="vocab"
          onChange={() => undefined}
        />

        <fieldset className="decks">
          <legend className="section-label">
            Decks
            <button
              type="button"
              className="link-btn"
              onClick={() =>
                update(
                  'deckIds',
                  allSelected ? [] : decks.map((deck) => deck.id)
                )
              }
            >
              {allSelected ? 'None' : 'All'}
            </button>
          </legend>
          <ul>
            {decks.map((deck) => (
              <li key={deck.id}>
                <label className="deck-row">
                  <input
                    type="checkbox"
                    checked={setup.deckIds.includes(deck.id)}
                    onChange={() => toggleDeck(deck.id)}
                  />
                  <span className="deck-title">{deck.title}</span>
                  <span className="muted">
                    {plural(deck.cards.length, 'card')}
                  </span>
                </label>
              </li>
            ))}
          </ul>
        </fieldset>

        <Choice
          legend="Direction"
          options={DIRECTIONS}
          value={setup.direction}
          onChange={(direction) => update('direction', direction)}
        />

        <Choice
          legend="Mode"
          options={MODES}
          value={setup.mode}
          onChange={(mode) => update('mode', mode)}
        />

        {setup.mode === 'practice' && (
          <label className="field-row">
            <span>
              New cards per session
              <small className="muted">
                New cards come back over the next few days, so add them
                gradually.
              </small>
            </span>
            <select
              value={setup.newCap}
              onChange={(event) => update('newCap', Number(event.target.value))}
            >
              {NEW_CAP_OPTIONS.map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </label>
        )}

        <label className="field-row">
          <span>
            Repeat missed cards
            <small className="muted">
              A missed card comes back a few cards later, until you get it.
            </small>
          </span>
          <input
            type="checkbox"
            role="switch"
            className="switch"
            checked={setup.repeatMisses}
            onChange={(event) => update('repeatMisses', event.target.checked)}
          />
        </label>
      </div>

      <footer className="setup-footer">
        {setup.deckIds.length === 0 ? (
          <p className="setup-status muted">Choose at least one deck.</p>
        ) : setup.mode === 'practice' && count === 0 ? (
          <div className="setup-status nothing-due">
            <p>
              <strong>Nothing due right now.</strong>{' '}
              {summary.nextDueAt && (
                <>Next card due {fromNow(summary.nextDueAt, now)}. </>
              )}
              {summary.new > 0 && setup.newCap === 0 && (
                <>Set new cards above 0 to learn new ones. </>
              )}
            </p>
            <button
              type="button"
              className="btn btn-quiet btn-block"
              onClick={() => update('mode', 'complete')}
            >
              Go through the whole deck instead
            </button>
          </div>
        ) : (
          setup.mode === 'practice' && (
            <p className="setup-status muted">
              {plural(summary.due, 'card')} due · {newThisSession} new
            </p>
          )
        )}
        <button
          type="button"
          className="btn btn-primary btn-block"
          disabled={count === 0}
          onClick={() => onStart(setup)}
        >
          Start · {plural(count, 'card')}
        </button>
      </footer>
    </main>
  );
};
