import { useRef, useState, type PointerEvent } from 'react';

import type { Answer, Prompt } from '../content/display.ts';
import type { Grade } from '../domain.ts';
import { Breakdown } from './Breakdown.tsx';

import './flashcard.css';

/** How far (px) a swipe must travel to count as a mark. */
export const SWIPE_THRESHOLD = 90;

type Props = {
  prompt: Prompt;
  answer: Answer;
  flipped: boolean;
  onFlip: () => void;
  onSwipe: (grade: Grade) => void;
};

/**
 * Tap anywhere on the card to see the answer. Once flipped, swipe right for "Got it" and left for
 * "Missed it". The buttons below the card do the same, so swiping is optional.
 */
export const Flashcard = ({
  prompt,
  answer,
  flipped,
  onFlip,
  onSwipe,
}: Props) => {
  const [dx, setDxState] = useState(0);
  // Mirrored in a ref so the release handler always sees the latest position, not a stale render's.
  const dxRef = useRef(0);
  const setDx = (value: number) => {
    dxRef.current = value;
    setDxState(value);
  };
  const drag = useRef<{
    id: number;
    x: number;
    y: number;
    horizontal?: boolean;
  } | null>(null);
  const moved = useRef(false);
  // Set only by a press that starts on this card. A mouse drag that swipes the previous card away
  // ends in a click that can land on this one; without this, it would flip it straight away.
  const pressed = useRef(false);

  const onPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    pressed.current = true;
    moved.current = false;
    if (!flipped || event.button !== 0) return;
    drag.current = { id: event.pointerId, x: event.clientX, y: event.clientY };
  };

  const onPointerMove = (event: PointerEvent<HTMLDivElement>) => {
    const start = drag.current;
    if (!start || start.id !== event.pointerId) return;
    const x = event.clientX - start.x;
    const y = event.clientY - start.y;
    if (start.horizontal === undefined) {
      if (Math.abs(x) < 8 && Math.abs(y) < 8) return;
      start.horizontal = Math.abs(x) > Math.abs(y);
      if (!start.horizontal) {
        drag.current = null; // a vertical scroll: leave it to the browser
        return;
      }
      event.currentTarget.setPointerCapture(event.pointerId);
    }
    moved.current = true;
    setDx(x);
  };

  const onPointerEnd = () => {
    const start = drag.current;
    drag.current = null;
    if (!start?.horizontal) return;
    const distance = dxRef.current;
    setDx(0);
    if (Math.abs(distance) >= SWIPE_THRESHOLD)
      onSwipe(distance > 0 ? 'got' : 'missed');
  };

  const strength = Math.min(Math.abs(dx) / SWIPE_THRESHOLD, 1);
  const leaning = dx > 0 ? 'got' : dx < 0 ? 'missed' : undefined;

  return (
    <div
      className={`flashcard${flipped ? ' is-flipped' : ''}${dx ? ' is-dragging' : ''}`}
      data-leaning={leaning}
      style={{
        transform: dx
          ? `translateX(${dx}px) rotate(${dx * 0.04}deg)`
          : undefined,
        ['--lean' as string]: strength,
      }}
      onClick={() => {
        if (!flipped && pressed.current && !moved.current) onFlip();
        pressed.current = false;
      }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerEnd}
      onPointerCancel={onPointerEnd}
      data-testid="flashcard"
    >
      {leaning && (
        <div className={`flashcard-stamp stamp-${leaning}`} aria-hidden="true">
          {leaning === 'got' ? 'Got it' : 'Missed it'}
        </div>
      )}

      <div className="flashcard-prompt" lang={prompt.lang}>
        {prompt.text}
      </div>
      {prompt.hint && <div className="flashcard-hint muted">{prompt.hint}</div>}

      {flipped ? (
        <div className="flashcard-answer" aria-live="polite">
          <div className="flashcard-answer-text" lang={answer.lang}>
            {answer.text}
          </div>
          {answer.alt && (
            <p className="flashcard-meta">
              also <span lang="sw">{answer.alt.join(', ')}</span>
            </p>
          )}
          {answer.plural && (
            <p className="flashcard-meta">
              plural <span lang="sw">{answer.plural}</span>
            </p>
          )}
          {answer.stem && (
            <p className="flashcard-meta">
              stem <span lang="sw">{answer.stem}</span>
            </p>
          )}
          {answer.kept && <p className="flashcard-note muted">{answer.kept}</p>}
          {answer.example && (
            <blockquote className="flashcard-example">
              <p lang="sw">{answer.example.sw}</p>
              <p className="muted">{answer.example.en}</p>
            </blockquote>
          )}
          {answer.note && <p className="flashcard-note muted">{answer.note}</p>}
          {answer.breakdown && <Breakdown parts={answer.breakdown} />}
          {answer.gloss && (
            <p className="flashcard-note muted">{answer.gloss}</p>
          )}
        </div>
      ) : (
        <p className="flashcard-cue muted" aria-hidden="true">
          Say it out loud, then tap
        </p>
      )}
    </div>
  );
};
