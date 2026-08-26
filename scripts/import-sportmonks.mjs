import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const token = process.env.SPORTMONKS_API_TOKEN?.trim();
if (!token) {
  console.error('SPORTMONKS_API_TOKEN is missing from .env.local');
  process.exit(1);
}

const API_ROOT = 'https://api.sportmonks.com/v3/football';
const AUDIT_PATH = resolve('work/sportmonks-league-audit.json');
const SNAPSHOT_DIR = resolve('src/data/generated');
const SNAPSHOT_PATH = resolve(SNAPSHOT_DIR, 'football-data.json');
const SQL_PATH = resolve('work/sportmonks-d1-import.sql');

function isoDate(date) {
  return date.toISOString().slice(0, 10);
}

function addDays(date, days) {
  const result = new Date(date);
  result.setUTCDate(result.getUTCDate() + days);
  return result;
}

function parseArgs() {
  const values = Object.fromEntries(
    process.argv.slice(2).map((argument) => {
      const [key, value] = argument.replace(/^--/, '').split('=');
      return [key, value];
    }),
  );
  const today = new Date();
  return {
    from: values.from ?? isoDate(addDays(today, -7)),
    to: values.to ?? isoDate(addDays(today, 90)),
  };
}

async function request(path, params = {}) {
  const url = new URL(`${API_ROOT}${path}`);
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, String(value));
  }

  const response = await fetch(url, {
    headers: { Accept: 'application/json', Authorization: token },
  });
  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    const message = payload?.message ?? payload?.error ?? response.statusText;
    throw new Error(`Sportmonks request failed (${response.status}): ${message}`);
  }

  return payload;
}

async function fetchFixtures(from, to, leagueIds) {
  const fixtures = [];
  let page = 1;

  do {
    const payload = await request(`/fixtures/between/${from}/${to}`, {
      include: 'participants;scores;state;round;venue;league',
      filters: `fixtureLeagues:${leagueIds.join(',')}`,
      per_page: 50,
      page,
      order: 'asc',
    });

    fixtures.push(...(payload.data ?? []));
    process.stdout.write(`\rDownloaded ${fixtures.length} fixtures`);

    if (!payload.pagination?.has_more) break;
    page += 1;
  } while (page <= 200);

  process.stdout.write('\n');
  return fixtures;
}

function normalizeStatus(state) {
  const code = String(state?.developer_name ?? state?.short_name ?? '').toUpperCase();
  if (['FT', 'AET', 'FT_PEN', 'CANCL', 'POSTP', 'ABAN', 'WO', 'AWARDED'].includes(code)) {
    return 'finished';
  }
  if (['INPLAY', 'LIVE', 'HT', 'BREAK', 'ET', 'PEN_LIVE', 'INTERRUPTED'].includes(code)) {
    return 'live';
  }
  return 'scheduled';
}

function currentScore(scores, side) {
  const current = scores?.find(
    (score) => score.description === 'CURRENT' && score.score?.participant === side,
  );
  return Number.isInteger(current?.score?.goals) ? current.score.goals : undefined;
}

function kickoffUtc(value) {
  return `${value.replace(' ', 'T')}Z`;
}

function normalizeFixture(fixture, leaguesById) {
  const home = fixture.participants?.find((participant) => participant.meta?.location === 'home');
  const away = fixture.participants?.find((participant) => participant.meta?.location === 'away');
  if (!home || !away || home.placeholder || away.placeholder) return null;

  const subscribedLeague = leaguesById.get(fixture.league_id);
  const league = fixture.league ?? subscribedLeague;
  const status = normalizeStatus(fixture.state);
  const homeScore = currentScore(fixture.scores, 'home');
  const awayScore = currentScore(fixture.scores, 'away');

  return {
    id: String(fixture.id),
    providerId: fixture.id,
    competitionId: fixture.league_id,
    competition: league?.name ?? `Competition ${fixture.league_id}`,
    competitionShort:
      league?.country?.name ?? subscribedLeague?.country ?? league?.country ?? 'FOOTBALL',
    round: fixture.round?.name ? `Round ${fixture.round.name}` : 'Fixture',
    kickoff: kickoffUtc(fixture.starting_at),
    home: home.name,
    homeTeamId: home.id,
    homeShortCode: home.short_code ?? null,
    away: away.name,
    awayTeamId: away.id,
    awayShortCode: away.short_code ?? null,
    status,
    ...(homeScore !== undefined ? { homeScore } : {}),
    ...(awayScore !== undefined ? { awayScore } : {}),
    venue: fixture.venue?.name ?? undefined,
  };
}

function sqlString(value) {
  if (value === null || value === undefined) return 'NULL';
  return `'${String(value).replaceAll("'", "''")}'`;
}

function buildSql(snapshot) {
  const statements = [
    'PRAGMA foreign_keys = ON;',
    `CREATE TABLE IF NOT EXISTS competitions (id INTEGER PRIMARY KEY NOT NULL, provider_id TEXT NOT NULL, name TEXT NOT NULL, country TEXT NOT NULL, tier INTEGER);`,
    `CREATE UNIQUE INDEX IF NOT EXISTS idx_competitions_provider_id ON competitions (provider_id);`,
    `CREATE TABLE IF NOT EXISTS teams (id INTEGER PRIMARY KEY NOT NULL, provider_id TEXT NOT NULL, name TEXT NOT NULL, normalized_name TEXT NOT NULL, short_name TEXT);`,
    `CREATE UNIQUE INDEX IF NOT EXISTS idx_teams_provider_id ON teams (provider_id);`,
    `CREATE INDEX IF NOT EXISTS idx_teams_normalized_name ON teams (normalized_name);`,
    `CREATE TABLE IF NOT EXISTS team_aliases (alias TEXT PRIMARY KEY NOT NULL, team_id INTEGER NOT NULL REFERENCES teams(id));`,
    `CREATE INDEX IF NOT EXISTS idx_team_aliases_team_id ON team_aliases (team_id);`,
    `CREATE TABLE IF NOT EXISTS fixtures (id INTEGER PRIMARY KEY NOT NULL, provider_id TEXT NOT NULL, competition_id INTEGER NOT NULL REFERENCES competitions(id), kickoff_utc TEXT NOT NULL, home_team_id INTEGER NOT NULL REFERENCES teams(id), away_team_id INTEGER NOT NULL REFERENCES teams(id), status TEXT NOT NULL, home_score INTEGER, away_score INTEGER, venue TEXT, updated_at TEXT NOT NULL);`,
    `CREATE UNIQUE INDEX IF NOT EXISTS idx_fixtures_provider_id ON fixtures (provider_id);`,
    `CREATE INDEX IF NOT EXISTS idx_fixtures_kickoff ON fixtures (kickoff_utc);`,
    `CREATE INDEX IF NOT EXISTS idx_fixtures_home_kickoff ON fixtures (home_team_id, kickoff_utc);`,
    `CREATE INDEX IF NOT EXISTS idx_fixtures_away_kickoff ON fixtures (away_team_id, kickoff_utc);`,
    `CREATE INDEX IF NOT EXISTS idx_fixtures_competition_kickoff ON fixtures (competition_id, kickoff_utc);`,
  ];

  for (const competition of snapshot.competitions) {
    statements.push(
      `INSERT INTO competitions (id, provider_id, name, country, tier) VALUES (${competition.id}, ${sqlString(competition.id)}, ${sqlString(competition.name)}, ${sqlString(competition.country ?? 'International')}, NULL) ON CONFLICT(id) DO UPDATE SET name=excluded.name, country=excluded.country;`,
    );
  }

  for (const team of snapshot.teams) {
    statements.push(
      `INSERT INTO teams (id, provider_id, name, normalized_name, short_name) VALUES (${team.id}, ${sqlString(team.id)}, ${sqlString(team.name)}, ${sqlString(team.normalizedName)}, ${sqlString(team.shortCode)}) ON CONFLICT(id) DO UPDATE SET name=excluded.name, normalized_name=excluded.normalized_name, short_name=excluded.short_name;`,
    );
  }

  for (const [alias, teamId] of Object.entries(snapshot.aliases)) {
    statements.push(
      `INSERT INTO team_aliases (alias, team_id) VALUES (${sqlString(alias)}, ${teamId}) ON CONFLICT(alias) DO UPDATE SET team_id=excluded.team_id;`,
    );
  }

  for (const fixture of snapshot.fixtures) {
    statements.push(
      `INSERT INTO fixtures (id, provider_id, competition_id, kickoff_utc, home_team_id, away_team_id, status, home_score, away_score, venue, updated_at) VALUES (${fixture.providerId}, ${sqlString(fixture.providerId)}, ${fixture.competitionId}, ${sqlString(fixture.kickoff)}, ${fixture.homeTeamId}, ${fixture.awayTeamId}, ${sqlString(fixture.status)}, ${fixture.homeScore ?? 'NULL'}, ${fixture.awayScore ?? 'NULL'}, ${sqlString(fixture.venue)}, ${sqlString(snapshot.generatedAt)}) ON CONFLICT(id) DO UPDATE SET kickoff_utc=excluded.kickoff_utc, status=excluded.status, home_score=excluded.home_score, away_score=excluded.away_score, venue=excluded.venue, updated_at=excluded.updated_at;`,
    );
  }

  statements.push('PRAGMA optimize;');
  return `${statements.join('\n')}\n`;
}

const { from, to } = parseArgs();
const audit = JSON.parse(await readFile(AUDIT_PATH, 'utf8'));
const leagueIds = audit.leagues.map((league) => league.id);
const leaguesById = new Map(audit.leagues.map((league) => [league.id, league]));
const rawFixtures = await fetchFixtures(from, to, leagueIds);
const fixtures = rawFixtures
  .map((fixture) => normalizeFixture(fixture, leaguesById))
  .filter(Boolean);

const teamsById = new Map();
for (const fixture of fixtures) {
  teamsById.set(fixture.homeTeamId, {
    id: fixture.homeTeamId,
    name: fixture.home,
    normalizedName: fixture.home.toLowerCase(),
    shortCode: fixture.homeShortCode,
  });
  teamsById.set(fixture.awayTeamId, {
    id: fixture.awayTeamId,
    name: fixture.away,
    normalizedName: fixture.away.toLowerCase(),
    shortCode: fixture.awayShortCode,
  });
}

const aliases = Object.fromEntries(
  [...teamsById.values()].map((team) => [team.normalizedName, team.id]),
);
const telford = [...teamsById.values()].find((team) => team.name === 'AFC Telford United');
if (telford) {
  aliases.telford = telford.id;
  aliases['afc telford'] = telford.id;
  aliases.bucks = telford.id;
}
const liverpool = [...teamsById.values()].find((team) => team.name === 'Liverpool');
if (liverpool) aliases['liverpool fc'] = liverpool.id;

const usedCompetitionIds = new Set(fixtures.map((fixture) => fixture.competitionId));
const snapshot = {
  generatedAt: new Date().toISOString(),
  source: 'Sportmonks Football API v3',
  range: { from, to },
  competitions: audit.leagues.filter((league) => usedCompetitionIds.has(league.id)),
  teams: [...teamsById.values()].sort((a, b) => a.name.localeCompare(b.name)),
  aliases,
  fixtures: fixtures.sort((a, b) => a.kickoff.localeCompare(b.kickoff)),
};

await Promise.all([
  mkdir(SNAPSHOT_DIR, { recursive: true }),
  mkdir(resolve('work'), { recursive: true }),
]);
await Promise.all([
  writeFile(SNAPSHOT_PATH, `${JSON.stringify(snapshot, null, 2)}\n`),
  writeFile(SQL_PATH, buildSql(snapshot)),
]);

const telfordFixtures = fixtures.filter(
  (fixture) => fixture.homeTeamId === telford?.id || fixture.awayTeamId === telford?.id,
);
console.log(
  `Prepared ${snapshot.competitions.length} competitions, ${snapshot.teams.length} teams and ${snapshot.fixtures.length} fixtures.`,
);
console.log(`AFC Telford United fixtures in range: ${telfordFixtures.length}.`);
console.log(`Snapshot: ${SNAPSHOT_PATH}`);
console.log(`D1 import: ${SQL_PATH}`);
