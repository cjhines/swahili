import { useCallback, useEffect, useRef, useState } from 'react';

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

  const flip = useCallback(() => {
    const current = stateRef.current;
    const next = sessionReducer(current, { type: 'flip' });
    if (next !== current) apply(next);
  }, []);

  const mark = useCallback(
    (grade: Grade) => {
      const current = stateRef.current;
      const item = currentItem(current);
      const next = sessionReducer(current, {
        type: 'mark',
        grade,
        requeueOffset: requeueOffset(),
      });
      if (!item || next === current) return;
      apply(next);

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
      if (isDone(next)) onFinish(next);
    },
    [store, setup, startedAt, onFinish]
  );

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.metaKey || event.ctrlKey || event.altKey || event.repeat)
        return;
      if (
        event.target instanceof HTMLElement &&
        event.target.closest('input, select, textarea')
      )
        return;
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
        case 'Escape':
          onExit();
          break;
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [flip, mark, onExit]);

  const item = currentItem(state);
  const card = item && view(item);
  if (!item || !card) return null;

  const done = state.finished.length;
  return (
    <main className="page session">
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
        <Flashcard
          key={state.position}
          prompt={card.prompt}
          answer={card.answer}
          flipped={state.flipped}
          onFlip={flip}
          onSwipe={mark}
        />
      </div>

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
    </main>
  );
};
