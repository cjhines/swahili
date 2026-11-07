// decks/ids.lock records every card ID ever published, one per line. Progress is stored
// against card IDs, so an ID that disappears (a rename) silently resets that card's
// progress, and a retired ID that comes back would inherit someone else's history.
//
//   vocab-kumi             a live ID
//   vocab-old # retired    a deleted card. The line stays forever, so the ID is never reused.

export const LOCK_PATH = 'decks/ids.lock';

const RETIRED = /\s+#\s*retired\s*$/;

const LOCK_HEADER = `# Every card ID ever published. Checked by \`npm run decks:check\`.
#
# - Never delete a line. To delete a card, keep its line and append "# retired".
# - Renaming an ID resets that card's progress, so don't.
# - Add new IDs with \`npm run ids:update\`.
`;

export const parseLock = (text: string) => {
  const live = new Set<string>();
  const retired = new Set<string>();
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    if (RETIRED.test(line)) retired.add(line.replace(RETIRED, ''));
    else live.add(line);
  }
  return { live, retired };
};

export const checkIds = (currentIds: readonly string[], lockText: string) => {
  const { live, retired } = parseLock(lockText);
  const current = new Set(currentIds);
  const problems: string[] = [];

  const missingFromLock = [...current].filter(
    (id) => !live.has(id) && !retired.has(id)
  );
  if (missingFromLock.length) {
    problems.push(
      `${LOCK_PATH}: new IDs not recorded yet (run \`npm run ids:update\`): ${missingFromLock.join(', ')}`
    );
  }

  for (const id of live) {
    if (!current.has(id)) {
      problems.push(
        `${LOCK_PATH}: ${id} is published but no card has it any more. If it was renamed, change it ` +
          `back (renaming resets progress). If the card was deleted on purpose, mark the line "# retired".`
      );
    }
  }

  for (const id of retired) {
    if (current.has(id)) {
      problems.push(
        `${LOCK_PATH}: ${id} is retired and must not be reused. Give the card a new ID.`
      );
    }
  }

  return problems;
};

/** Returns the lock with any new IDs added. Existing lines, including retired ones, are kept. */
export const updateLock = (currentIds: readonly string[], lockText: string) => {
  const { live, retired } = parseLock(lockText);
  const entries = [
    ...new Set([...live, ...currentIds.filter((id) => !retired.has(id))]),
  ].map((id) => ({ id, line: id }));
  entries.push(...[...retired].map((id) => ({ id, line: `${id} # retired` })));
  entries.sort((a, b) => (a.id < b.id ? -1 : 1)); // not localeCompare: same order on every machine
  return `${LOCK_HEADER}\n${entries.map((e) => e.line).join('\n')}\n`;
};
