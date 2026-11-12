import { useState, type ReactNode } from 'react';

import { Choice } from '../components/Choice.tsx';
import type { VocabDeck } from '../content/schema.ts';
import type { Direction, Mode } from '../domain.ts';
import type { NaniTense } from '../nani/patterns.ts';
import type { NaniRules } from '../nani/schema.ts';
import { practiceSummary, type StateOf } from '../session/queue.ts';
import type { ResumableRun } from '../session/resume.ts';
import {
  loadLastKind,
  loadNaniSetup,
  loadVocabSetup,
  NEW_CAP_OPTIONS,
  saveSetup,
  type DeckKind,
  type NaniSetup,
  type SessionSetup,
  type VocabSetup,
} from '../session/setup.ts';
import { itemsFor, type VerbCard } from '../session/start.ts';
import { NANI_TITLE } from '../session/views.ts';
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
    description: 'Every card you’ve chosen, once.',
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
    label: NANI_TITLE,
    description: 'Verb forms: who did it, and when.',
  },
] as const satisfies readonly {
  value: DeckKind;
  label: string;
  description?: string;
}[];

const TENSES: { value: NaniTense; label: string; example: string }[] = [
  { value: 'present', label: 'Present', example: 'ninasoma · I am reading' },
  { value: 'past', label: 'Past', example: 'nilisoma · I read' },
  { value: 'future', label: 'Future', example: 'nitasoma · I will read' },
  { value: 'perfect', label: 'Perfect', example: 'nimesoma · I have read' },
  { value: 'have', label: 'Have / don’t have', example: 'nina · I have' },
];

const POLARITIES = [
  { value: 'pos', label: 'Positive' },
  { value: 'neg', label: 'Negative' },
  { value: 'both', label: 'Both' },
] as const satisfies readonly { value: NaniSetup['polarity']; label: string }[];

export const directionLabel = (direction: Direction) =>
  DIRECTIONS.find((d) => d.value === direction)!.label;

/** "Numbers, Time + dates" or "Nani na Lini?: Past, Present". */
const describe = (setup: SessionSetup, decks: readonly VocabDeck[]) =>
  setup.kind === 'vocab'
    ? setup.deckIds
        .map((id) => decks.find((deck) => deck.id === id)?.title)
        .filter(Boolean)
        .join(', ')
    : `${NANI_TITLE}: ${TENSES.filter((t) => setup.tenses.includes(t.value))
        .map((t) => t.label)
        .join(', ')}`;

type Props = {
  decks: readonly VocabDeck[];
  rules: NaniRules;
  verbs: readonly VerbCard[];
  stateOf: StateOf;
  resume: ResumableRun | undefined;
  onStart: (setup: SessionSetup) => void;
  onResume: (run: ResumableRun) => void;
  onDiscardResume: () => void;
  onSettings: () => void;
  /** Update ready, add to Home Screen: shown above everything else. */
  notices?: ReactNode;
};

const SettingsIcon = () => (
  <svg viewBox="0 0 24 24" width="1.3em" height="1.3em" aria-hidden="true">
    <path
      d="M4 7h10M18 7h2M4 17h4M12 17h8M16 5v4M10 15v4"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
    />
  </svg>
);

export const SetupScreen = ({
  decks,
  rules,
  verbs,
  stateOf,
  resume,
  onStart,
  onResume,
  onDiscardResume,
  onSettings,
  notices,
}: Props) => {
  // A verb tense needs verbs to fill it; "have" doesn't.
  const available = TENSES.map((t) => t.value).filter(
    (tense) => tense === 'have' || verbs.length > 0
  );

  const [kind, setKind] = useState<DeckKind>(loadLastKind);
  const [vocab, setVocab] = useState(() => loadVocabSetup(decks));
  const [nani, setNani] = useState(() => loadNaniSetup(available));
  const setup: SessionSetup = kind === 'vocab' ? vocab : nani;

  const change = (next: SessionSetup) => {
    if (next.kind === 'vocab') setVocab(next);
    else setNani(next);
    saveSetup(next);
  };
  const update = <K extends keyof SessionSetup>(
    key: K,
    value: SessionSetup[K]
  ) => change({ ...setup, [key]: value } as SessionSetup);
  const updateVocab = (next: Partial<VocabSetup>) =>
    change({ ...vocab, ...next });
  const updateNani = (next: Partial<NaniSetup>) => change({ ...nani, ...next });
  const switchKind = (next: DeckKind) => {
    setKind(next);
    saveSetup(next === 'vocab' ? vocab : nani);
  };

  const now = new Date();
  const items = itemsFor(setup, { decks, rules });
  const summary = practiceSummary(items, stateOf, now);
  const newThisSession = Math.min(summary.new, setup.newCap);
  const count =
    setup.mode === 'practice' ? summary.due + newThisSession : items.length;
  const unit = kind === 'vocab' ? 'card' : 'form';

  const toggle = <T,>(list: readonly T[], value: T) =>
    list.includes(value) ? list.filter((v) => v !== value) : [...list, value];
  const allDecks = vocab.deckIds.length === decks.length;

  return (
    <main className="page setup">
      <header className="setup-header">
        <h1>
          Kadi za Kiswahili
          <span>Swahili flashcards</span>
        </h1>
        <button
          type="button"
          className="icon-btn"
          aria-label="Settings and backup"
          onClick={onSettings}
        >
          <SettingsIcon />
        </button>
      </header>

      {notices}

      {resume && (
        <section className="resume" aria-label="Unfinished run">
          <p>
            <strong>Unfinished Complete deck run</strong>
            <span className="muted">
              {describe(resume.setup, decks)} ·{' '}
              {directionLabel(resume.setup.direction)} ·{' '}
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
          value={kind}
          onChange={switchKind}
        />

        {kind === 'vocab' ? (
          <fieldset className="decks">
            <legend className="section-label">
              Decks
              <button
                type="button"
                className="link-btn"
                onClick={() =>
                  updateVocab({
                    deckIds: allDecks ? [] : decks.map((deck) => deck.id),
                  })
                }
              >
                {allDecks ? 'None' : 'All'}
              </button>
            </legend>
            <ul>
              {decks.map((deck) => (
                <li key={deck.id}>
                  <label className="deck-row">
                    <input
                      type="checkbox"
                      checked={vocab.deckIds.includes(deck.id)}
                      onChange={() =>
                        updateVocab({ deckIds: toggle(vocab.deckIds, deck.id) })
                      }
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
        ) : (
          <>
            <fieldset className="decks">
              <legend className="section-label">Tenses</legend>
              <ul>
                {TENSES.map((tense) => {
                  const open = available.includes(tense.value);
                  return (
                    <li key={tense.value}>
                      <label className={`deck-row${open ? '' : ' is-locked'}`}>
                        <input
                          type="checkbox"
                          disabled={!open}
                          checked={open && nani.tenses.includes(tense.value)}
                          onChange={() =>
                            updateNani({
                              tenses: toggle(nani.tenses, tense.value),
                            })
                          }
                        />
                        <span className="deck-title">
                          {tense.label}
                          <small className="muted">
                            {open
                              ? tense.example
                              : 'Needs verbs in a Vocabulary deck'}
                          </small>
                        </span>
                      </label>
                    </li>
                  );
                })}
              </ul>
            </fieldset>

            <Choice
              legend="Positive or negative"
              options={POLARITIES}
              value={nani.polarity}
              onChange={(polarity) => updateNani({ polarity })}
            />
          </>
        )}

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
              New {unit}s per session
              <small className="muted">
                New {unit}s come back over the next few days, so add them
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
            Repeat missed {unit}s
            <small className="muted">
              A missed {unit} comes back a few cards later, until you get it.
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
        {items.length === 0 ? (
          <p className="setup-status muted">
            {kind === 'vocab'
              ? 'Choose at least one deck.'
              : 'Choose at least one tense.'}
          </p>
        ) : setup.mode === 'practice' && count === 0 ? (
          <div className="setup-status nothing-due">
            <p>
              <strong>Nothing due right now.</strong>{' '}
              {summary.nextDueAt && (
                <>Next one due {fromNow(summary.nextDueAt, now)}. </>
              )}
              {summary.new > 0 && setup.newCap === 0 && (
                <>Set new {unit}s above 0 to learn new ones. </>
              )}
            </p>
            <button
              type="button"
              className="btn btn-quiet btn-block"
              onClick={() => update('mode', 'complete')}
            >
              Go through them all instead
            </button>
          </div>
        ) : (
          setup.mode === 'practice' && (
            <p className="setup-status muted">
              {plural(summary.due, unit)} due · {newThisSession} new
            </p>
          )
        )}
        <button
          type="button"
          className="btn btn-primary btn-block"
          disabled={count === 0}
          onClick={() => onStart(setup)}
        >
          Start · {plural(count, unit)}
        </button>
      </footer>
    </main>
  );
};
