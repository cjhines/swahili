import { TENSES, toggle } from './options.ts';
import type { NaniTense } from '../../nani/patterns.ts';

type Props = {
  /** Tenses that can be chosen: all of them, or just "have" when there are no verb cards. */
  available: readonly NaniTense[];
  chosen: readonly NaniTense[];
  onChange: (tenses: NaniTense[]) => void;
};

export const TensePicker = ({ available, chosen, onChange }: Props) => (
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
                checked={open && chosen.includes(tense.value)}
                onChange={() => onChange(toggle(chosen, tense.value))}
              />
              <span className="deck-title">
                {tense.label}
                <small className="muted">
                  {open ? tense.example : 'Needs verbs in a Vocabulary deck'}
                </small>
              </span>
            </label>
          </li>
        );
      })}
    </ul>
  </fieldset>
);
