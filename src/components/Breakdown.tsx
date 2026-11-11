import type { Part } from '../nani/conjugate.ts';

import './breakdown.css';

/**
 *   ha  · tu · ku   · soma
 *   not   we   past   read
 * Each part is coloured by its role (subject, negative, tense…); the colours live in
 * breakdown.css as --part-* tokens.
 */
export const Breakdown = ({ parts }: { parts: readonly Part[] }) => (
  <div className="breakdown" role="group" aria-label="Parts of the word">
    {parts.map((part, i) => (
      <span key={i} className={`part part-${part.role}`}>
        <span className="part-text" lang="sw">
          {part.text}
        </span>
        <span className="part-label">{part.label}</span>
      </span>
    ))}
  </div>
);
