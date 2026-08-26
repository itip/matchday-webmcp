import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const token = process.env.SPORTMONKS_API_TOKEN?.trim();

if (!token) {
  console.error('SPORTMONKS_API_TOKEN is missing from .env.local');
  process.exit(1);
}

const API_ROOT = 'https://api.sportmonks.com/v3/football';
const OUTPUT_DIR = resolve('work');
const JSON_PATH = resolve(OUTPUT_DIR, 'sportmonks-league-audit.json');
const MARKDOWN_PATH = resolve(OUTPUT_DIR, 'sportmonks-league-audit.md');

async function request(path, params = {}) {
  const url = new URL(`${API_ROOT}${path}`);
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, String(value));
  }

  const response = await fetch(url, {
    headers: {
      Accept: 'application/json',
      Authorization: token,
    },
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = payload?.message ?? payload?.error ?? response.statusText;
    throw new Error(`Sportmonks request failed (${response.status}): ${message}`);
  }

  return payload;
}

async function fetchAllLeagues() {
  const leagues = [];
  let page = 1;
  let rateLimit = null;

  do {
    const payload = await request('/leagues', {
      include: 'country;currentSeason',
      per_page: 50,
      page,
      order: 'asc',
    });

    leagues.push(...(payload.data ?? []));
    rateLimit ??= payload.rate_limit ?? null;

    if (!payload.pagination?.has_more) break;
    page += 1;
  } while (page <= 100);

  return { leagues, rateLimit };
}

function normalizeLeague(league) {
  return {
    id: league.id,
    name: league.name,
    shortCode: league.short_code ?? null,
    active: Boolean(league.active),
    type: league.type ?? null,
    subType: league.sub_type ?? null,
    country: league.country?.name ?? null,
    countryId: league.country_id ?? null,
    currentSeason: league.currentseason
      ? {
          id: league.currentseason.id,
          name: league.currentseason.name,
          start: league.currentseason.starting_at ?? null,
          end: league.currentseason.ending_at ?? null,
        }
      : null,
  };
}

function escapeCell(value) {
  return String(value ?? '').replaceAll('|', '\\|');
}

function buildMarkdown(audit) {
  const rows = audit.leagues.map((league) =>
    `| ${league.id} | ${escapeCell(league.name)} | ${escapeCell(league.country)} | ${escapeCell(league.currentSeason?.name)} | ${league.active ? 'Yes' : 'No'} |`,
  );

  return [
    '# Sportmonks league coverage audit',
    '',
    `Generated: ${audit.generatedAt}`,
    '',
    `Accessible competitions: **${audit.summary.total}**`,
    '',
    `Active competitions: **${audit.summary.active}**`,
    '',
    `Countries represented: **${audit.summary.countries}**`,
    '',
    '| ID | Competition | Country | Current season | Active |',
    '|---:|---|---|---|:---:|',
    ...rows,
    '',
  ].join('\n');
}

const { leagues: rawLeagues, rateLimit } = await fetchAllLeagues();
const leagues = rawLeagues
  .map(normalizeLeague)
  .sort((a, b) =>
    (a.country ?? '').localeCompare(b.country ?? '') || a.name.localeCompare(b.name),
  );

const audit = {
  generatedAt: new Date().toISOString(),
  summary: {
    total: leagues.length,
    active: leagues.filter((league) => league.active).length,
    countries: new Set(leagues.map((league) => league.country).filter(Boolean)).size,
  },
  rateLimit,
  leagues,
};

await mkdir(OUTPUT_DIR, { recursive: true });
await Promise.all([
  writeFile(JSON_PATH, `${JSON.stringify(audit, null, 2)}\n`),
  writeFile(MARKDOWN_PATH, buildMarkdown(audit)),
]);

const highlights = leagues.filter((league) =>
  /premier league|champions league|europa league|conference league|national league|league one|league two|fa cup/i.test(
    league.name,
  ),
);

console.log(`Found ${audit.summary.total} accessible competitions across ${audit.summary.countries} countries.`);
console.log(`Active competitions: ${audit.summary.active}.`);
if (highlights.length) {
  console.log('Relevant highlights:');
  for (const league of highlights) {
    console.log(`- ${league.name}${league.country ? ` (${league.country})` : ''} [${league.id}]`);
  }
}
console.log(`Reports written to ${JSON_PATH} and ${MARKDOWN_PATH}.`);
