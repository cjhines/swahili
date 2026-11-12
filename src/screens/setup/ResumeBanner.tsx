import { describeSetup, directionLabel } from './options.ts';
import type { VocabDeck } from '../../content/schema.ts';
import type { ResumableRun } from '../../session/resume.ts';

type Props = {
  run: ResumableRun;
  decks: readonly VocabDeck[];
  onResume: (run: ResumableRun) => void;
  onDiscard: () => void;
};

export const ResumeBanner = ({ run, decks, onResume, onDiscard }: Props) => {
  const { finished, total } = run.state;
  return (
    <section className="resume" aria-label="Unfinished run">
      <p>
        <strong>Unfinished Complete deck run</strong>
        <span className="muted">
          {describeSetup(run.setup, decks)} ·{' '}
          {directionLabel(run.setup.direction)} · {finished.length} of {total}{' '}
          done
        </span>
      </p>
      <div className="resume-actions">
        <button
          type="button"
          className="btn btn-primary"
          onClick={() => onResume(run)}
        >
          Resume ({finished.length}/{total})
        </button>
        <button type="button" className="btn btn-quiet" onClick={onDiscard}>
          Discard
        </button>
      </div>
    </section>
  );
};
