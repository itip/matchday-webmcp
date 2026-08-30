const ukDateFormatter = new Intl.DateTimeFormat('en-GB', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  timeZone: 'Europe/London',
});

export function currentUkIsoDate(reference = new Date()) {
  const parts = Object.fromEntries(
    ukDateFormatter.formatToParts(reference).map(({ type, value }) => [type, value]),
  );
  return `${parts.year}-${parts.month}-${parts.day}`;
}
