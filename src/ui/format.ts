const rtf = new Intl.RelativeTimeFormat('en', { numeric: 'auto' });

const UNITS: [Intl.RelativeTimeFormatUnit, number][] = [
  ['day', 86_400_000],
  ['hour', 3_600_000],
  ['minute', 60_000],
];

/** "in 3 hours", "tomorrow", "in 5 days". Rounds to the largest whole unit. */
export const fromNow = (date: Date, now: Date) => {
  const ms = date.getTime() - now.getTime();
  for (const [unit, size] of UNITS) {
    if (Math.abs(ms) >= size) return rtf.format(Math.round(ms / size), unit);
  }
  return 'in under a minute';
};

export const plural = (n: number, one: string, many = `${one}s`) =>
  `${n} ${n === 1 ? one : many}`;
