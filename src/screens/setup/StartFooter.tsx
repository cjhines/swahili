import type { PracticeSummary } from '../../session/queue.ts';
import type { SessionSetup } from '../../session/setup.ts';
import { fromNow, plural } from '../../ui/format.ts';

type Props = {
  setup: SessionSetup;
  /** How many cards (or forms) the chosen decks or tenses hold. */
  available: number;
  summary: PracticeSummary;
  /** "card" or "form". */
  unit: string;
  now: Date;
  onStart: () => void;
  onCompleteInstead: () => void;
};

/** What a session would hold, and the Start button. */
export const StartFooter = ({
  setup,
  available,
  summary,
  unit,
  now,
  onStart,
  onCompleteInstead,
}: Props) => {
  const newThisSession = Math.min(summary.new, setup.newCap);
  const practice = setup.mode === 'practice';
  const count = practice ? summary.due + newThisSession : available;

  return (
    <footer className="setup-footer">
      {available === 0 ? (
        <p className="setup-status muted">
          {setup.kind === 'vocab'
            ? 'Choose at least one deck.'
            : 'Choose at least one tense.'}
        </p>
      ) : practice && count === 0 ? (
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
            onClick={onCompleteInstead}
          >
            Go through them all instead
          </button>
        </div>
      ) : (
        practice && (
          <p className="setup-status muted">
            {plural(summary.due, unit)} due · {newThisSession} new
          </p>
        )
      )}
      <button
        type="button"
        className="btn btn-primary btn-block"
        disabled={count === 0}
        onClick={onStart}
      >
        Start · {plural(count, unit)}
      </button>
    </footer>
  );
};
