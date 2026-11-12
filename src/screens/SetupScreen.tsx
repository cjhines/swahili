import { useState, type ReactNode } from 'react';

import { DeckPicker } from './setup/DeckPicker.tsx';
import { ResumeBanner } from './setup/ResumeBanner.tsx';
import { StartFooter } from './setup/StartFooter.tsx';
import { TensePicker } from './setup/TensePicker.tsx';
import {
  DECK_KINDS,
  DIRECTIONS,
  MODES,
  POLARITIES,
  TENSES,
} from './setup/options.ts';
import { Choice } from '../components/Choice.tsx';
import type { VocabDeck } from '../content/schema.ts';
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
  type SessionSetup,
} from '../session/setup.ts';
import { itemsFor, type VerbCard } from '../session/start.ts';

import './setup.css';

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
  const switchKind = (next: DeckKind) => {
    setKind(next);
    saveSetup(next === 'vocab' ? vocab : nani);
  };

  const now = new Date();
  const items = itemsFor(setup, { decks, rules });
  const unit = kind === 'vocab' ? 'card' : 'form';

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
        <ResumeBanner
          run={resume}
          decks={decks}
          onResume={onResume}
          onDiscard={onDiscardResume}
        />
      )}

      <div className="setup-sections">
        <Choice
          legend="Deck type"
          options={DECK_KINDS}
          value={kind}
          onChange={switchKind}
        />

        {kind === 'vocab' ? (
          <DeckPicker
            decks={decks}
            chosen={vocab.deckIds}
            onChange={(deckIds) => change({ ...vocab, deckIds })}
          />
        ) : (
          <>
            <TensePicker
              available={available}
              chosen={nani.tenses}
              onChange={(tenses) => change({ ...nani, tenses })}
            />
            <Choice
              legend="Positive or negative"
              options={POLARITIES}
              value={nani.polarity}
              onChange={(polarity) => change({ ...nani, polarity })}
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

      <StartFooter
        setup={setup}
        available={items.length}
        summary={practiceSummary(items, stateOf, now)}
        unit={unit}
        now={now}
        onStart={() => onStart(setup)}
        onCompleteInstead={() => update('mode', 'complete')}
      />
    </main>
  );
};
