import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { Flashcard } from '../components/Flashcard.tsx';
import type { Grade } from '../domain.ts';
import { saveResume } from '../session/resume.ts';
import {
  currentItem,
  isDone,
  requeueOffset,
  sessionReducer,
  type SessionState,
} from '../session/session.ts';
import type { SessionSetup } from '../session/setup.ts';
import type { ViewOf } from '../session/views.ts';
import type { ProgressStore } from '../storage/progress.ts';
import { checkAnswer, type Check } from '../typing/check.ts';

import './session.css';

type Props = {
  view: ViewOf;
  store: ProgressStore;
  setup: SessionSetup;
  initial: SessionState;
  startedAt: Date;
  onFinish: (state: SessionState) => void;
  onExit: () => void;
};

export const SessionScreen = ({
  view,
  store,
  setup,
  initial,
  startedAt,
  onFinish,
  onExit,
}: Props) => {
  const [state, setState] = useState(initial);
  const [saveFailed, setSaveFailed] = useState(false);

  // The source of truth for handlers. Updated synchronously, so a second tap or keypress that
  // lands before React re-renders can't mark the same card twice.
  const stateRef = useRef(initial);
  const apply = (next: SessionState) => {
    stateRef.current = next;
    setState(next);
  };

  // Typing mode. Checking an answer saves its mark at once; `pending` is what comes after it,
  // shown when you move on. The answer box stays mounted from card to card, so a phone keeps
  // its keyboard open.
  const [typed, setTyped] = useState('');
  const [check, setCheck] = useState<Check>();
  const pending = useRef<SessionState>(undefined);
  const input = useRef<HTMLInputElement>(null);

  const flip = useCallback(() => {
    const current = stateRef.current;
    const next = sessionReducer(current, { type: 'flip' });
    if (next !== current) apply(next);
  }, []);

  /** Saves a mark for the card on screen. Returns the state after it, or nothing if it can't. */
  const record = useCallback(
    (current: SessionState, grade: Grade) => {
      const item = currentItem(current);
      const next = sessionReducer(current, {
        type: 'mark',
        grade,
        requeueOffset: requeueOffset(),
      });
      if (!item || next === current) return undefined;

      const now = new Date();
      store
        .mark({
          cardId: item.cardId,
          direction: item.direction,
          grade,
          mode: setup.mode,
          now,
        })
        .catch(() => setSaveFailed(true));
      saveResume({ setup, state: next, startedAt }, now);
      return next;
    },
    [store, setup, startedAt]
  );

  const advance = useCallback(
    (next: SessionState) => {
      apply(next);
      if (isDone(next)) onFinish(next);
    },
    [onFinish]
  );

  const mark = useCallback(
    (grade: Grade) => {
      const next = record(stateRef.current, grade);
      if (next) advance(next);
    },
    [record, advance]
  );

  /** Typing mode: shows the card after the checked one. False if nothing has been checked. */
  const moveOn = useCallback(() => {
    const after = pending.current;
    if (!after) return false;
    pending.current = undefined;
    setCheck(undefined);
    setTyped('');
    advance(after);
    return true;
  }, [advance]);

  /** Typing mode: Enter checks the answer (empty is giving up); Enter again moves on. */
  const submit = () => {
    if (moveOn()) return;
    const current = stateRef.current;
    const item = currentItem(current);
    const shown = item && view(item);
    if (!shown) return;
    const result = checkAnswer(typed, shown.expected);
    const flipped = sessionReducer(current, { type: 'flip' });
    apply(flipped);
    const next = record(flipped, result.correct ? 'got' : 'missed');
    if (!next) return;
    pending.current = next;
    setCheck(result);
  };

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.metaKey || event.ctrlKey || event.altKey || event.repeat)
        return;
      if (event.key === 'Escape') {
        onExit();
        return;
      }
      if (
        event.target instanceof HTMLElement &&
        event.target.closest('input, select, textarea')
      )
        return;
      if (setup.typing) {
        // Focus is off the answer box (a click elsewhere): Enter still moves on, or goes back to it.
        if (event.key === 'Enter') {
          event.preventDefault();
          if (!moveOn()) input.current?.focus();
        }
        return;
      }
      switch (event.key) {
        case ' ':
        case 'Enter':
          if (!stateRef.current.flipped) {
            event.preventDefault();
            flip();
          }
          break;
        case 'ArrowRight':
          event.preventDefault();
          mark('got');
          break;
        case 'ArrowLeft':
          event.preventDefault();
          mark('missed');
          break;
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [flip, mark, moveOn, onExit, setup.typing]);

  const item = currentItem(state);
  const card = useMemo(() => item && view(item), [item, view]);
  if (!item || !card) return null;

  const done = state.finished.length;
  return (
    <main className={`page session${setup.typing ? ' is-typing' : ''}`}>
      <header className="session-bar">
        <button
          type="button"
          className="icon-btn"
          aria-label="End session"
          onClick={onExit}
        >
          ✕
        </button>
        <div className="session-progress">
          <span className="muted">
            {setup.mode === 'practice' ? 'Practice' : 'Complete deck'} ·{' '}
            {card.title}
          </span>
          <span
            className="session-count"
            aria-label={`${done} of ${state.total} done`}
          >
            {done}/{state.total}
          </span>
        </div>
      </header>
      <div
        className="progress-track"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={state.total}
        aria-valuenow={done}
      >
        <div
          className="progress-fill"
          style={{ width: `${(done / Math.max(state.total, 1)) * 100}%` }}
        />
      </div>

      {saveFailed && (
        <p className="save-error" role="alert">
          Couldn&apos;t save your last answer. Your progress may not be kept in
          this browser.
        </p>
      )}

      <div className="session-card">
        {setup.typing ? (
          <Flashcard
            key={state.position}
            prompt={card.prompt}
            answer={card.answer}
            flipped={state.flipped}
            onFlip={() => input.current?.focus()}
            check={check}
          />
        ) : (
          <Flashcard
            key={state.position}
            prompt={card.prompt}
            answer={card.answer}
            flipped={state.flipped}
            onFlip={flip}
            onSwipe={mark}
          />
        )}
      </div>

      {setup.typing ? (
        <form
          className="session-typing"
          onSubmit={(event) => {
            event.preventDefault();
            submit();
          }}
        >
          <input
            ref={input}
            className="answer-input"
            aria-label="Your answer"
            value={check ? '' : typed}
            onChange={(event) => {
              if (!pending.current) setTyped(event.target.value);
            }}
            onKeyDown={(event) => {
              // Holding Enter mustn't check the answer and then skip past it.
              if (event.key === 'Enter' && event.repeat) event.preventDefault();
            }}
            placeholder={
              check
                ? 'Enter: next card'
                : card.answer.lang === 'sw'
                  ? 'Type the Swahili'
                  : 'Type the English'
            }
            lang={card.answer.lang}
            // Autocorrect would "fix" sisomi; capitals and spelling are checked leniently anyway.
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="none"
            spellCheck={false}
            autoFocus
          />
          <button
            type="submit"
            className="btn btn-primary"
            // Keeps focus (and a phone's keyboard) on the answer box.
            onMouseDown={(event) => event.preventDefault()}
          >
            {check ? 'Next' : typed.trim() ? 'Check' : 'Show answer'}
          </button>
        </form>
      ) : (
        <footer className="session-actions">
          {state.flipped ? (
            <>
              <button
                type="button"
                className="btn btn-missed"
                onClick={() => mark('missed')}
              >
                Missed it
              </button>
              <button
                type="button"
                className="btn btn-got"
                onClick={() => mark('got')}
              >
                Got it
              </button>
            </>
          ) : (
            <button
              type="button"
              className="btn btn-primary btn-wide"
              onClick={flip}
            >
              Show answer
            </button>
          )}
        </footer>
      )}
    </main>
  );
};
