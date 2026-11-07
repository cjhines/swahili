import { answerFor, promptFor, type CardIndex } from '../content/display.ts';
import type { SessionState } from '../session/session.ts';
import { plural } from '../ui/format.ts';

import './end.css';

type Props = {
  index: CardIndex;
  state: SessionState;
  onDone: () => void;
};

export const EndScreen = ({ index, state, onDone }: Props) => {
  const missed = state.missed.flatMap((key) => {
    const item = state.queue.find((queued) => queued.key === key);
    const entry = item && index.get(item.cardId);
    return item && entry
      ? [
          {
            key,
            prompt: promptFor(entry.card, item.direction),
            answer: answerFor(entry.card, item.direction),
          },
        ]
      : [];
  });
  const firstTime = state.total - state.missed.length;

  return (
    <main className="page end">
      <header>
        <h1>
          Hongera!
          <span>Session complete</span>
        </h1>
      </header>

      <dl className="end-stats">
        <div>
          <dt>Cards</dt>
          <dd>{state.total}</dd>
        </div>
        <div>
          <dt>Got first time</dt>
          <dd className="stat-got">{firstTime}</dd>
        </div>
        <div>
          <dt>Missed</dt>
          <dd className="stat-missed">{state.missed.length}</dd>
        </div>
      </dl>

      {missed.length > 0 && (
        <section className="end-missed">
          <h2 className="section-label">
            Missed {plural(missed.length, 'card')}
          </h2>
          <ul>
            {missed.map(({ key, prompt, answer }) => (
              <li key={key}>
                <span lang={prompt.lang}>{prompt.text}</span>
                <span lang={answer.lang}>{answer.text}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <footer className="end-footer">
        <button
          type="button"
          className="btn btn-primary btn-block"
          onClick={onDone}
        >
          Done
        </button>
      </footer>
    </main>
  );
};
