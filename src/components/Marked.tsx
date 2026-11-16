/**
 * Text with some letters highlighted: those that differ between what was typed (`wrong`) and the
 * nearest right answer. `marks` are code point indexes, as checkAnswer gives them.
 */
export const Marked = ({
  text,
  marks,
  wrong = false,
}: {
  text: string;
  marks: readonly number[];
  wrong?: boolean;
}) => {
  const marked = new Set(marks);
  const runs: { text: string; marked: boolean }[] = [];
  [...text].forEach((char, i) => {
    const last = runs.at(-1);
    if (last && last.marked === marked.has(i)) last.text += char;
    else runs.push({ text: char, marked: marked.has(i) });
  });
  return (
    <>
      {runs.map((run, i) =>
        run.marked ? (
          <mark key={i} className={wrong ? 'mark-wrong' : 'mark-right'}>
            {run.text}
          </mark>
        ) : (
          run.text
        )
      )}
    </>
  );
};
