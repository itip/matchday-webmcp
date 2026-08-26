import footballData from './generated/football-data.json';

export type MatchStatus = 'scheduled' | 'live' | 'finished';
export type Fixture = { id: string; competition: string; competitionShort: string; round: string; kickoff: string; home: string; away: string; status: MatchStatus; homeScore?: number; awayScore?: number; minute?: string; venue?: string };

const demoFixtures: Fixture[] = [
  { id: 'ucl-qar-fer', competition: 'Champions League qualifying', competitionShort: 'UEFA', round: 'Play-offs · second leg', kickoff: '2026-08-26T17:45:00Z', home: 'Qarabag', away: 'Ferencvaros', status: 'finished', homeScore: 2, awayScore: 1, venue: 'Tofiq Bahramov Stadium' },
  { id: 'ucl-cel-bas', competition: 'Champions League qualifying', competitionShort: 'UEFA', round: 'Play-offs · second leg', kickoff: '2026-08-26T19:00:00Z', home: 'Celtic', away: 'Basel', status: 'live', homeScore: 1, awayScore: 1, minute: "74'", venue: 'Celtic Park' },
  { id: 'ucl-ben-fen', competition: 'Champions League qualifying', competitionShort: 'UEFA', round: 'Play-offs · second leg', kickoff: '2026-08-26T20:00:00Z', home: 'Benfica', away: 'Fenerbahce', status: 'scheduled', venue: 'Estadio da Luz' },
  { id: 'l2-cre-not', competition: 'League Two', competitionShort: 'ENGLAND', round: 'Matchday 4', kickoff: '2026-08-26T18:45:00Z', home: 'Crewe Alexandra', away: 'Notts County', status: 'finished', homeScore: 2, awayScore: 2, venue: 'Mornflake Stadium' },
  { id: 'l2-gri-swi', competition: 'League Two', competitionShort: 'ENGLAND', round: 'Matchday 4', kickoff: '2026-08-26T18:45:00Z', home: 'Grimsby Town', away: 'Swindon Town', status: 'finished', homeScore: 1, awayScore: 0, venue: 'Blundell Park' },
  { id: 'nlh-her-che', competition: 'National League North', competitionShort: 'NON-LEAGUE', round: 'Matchday 6', kickoff: '2026-08-26T18:45:00Z', home: 'Hereford', away: 'Chester', status: 'live', homeScore: 0, awayScore: 1, minute: "68'", venue: 'Edgar Street' },
  { id: 'nlh-mor-tel', competition: 'National League North', competitionShort: 'NON-LEAGUE', round: 'Matchday 7', kickoff: '2026-08-28T18:45:00Z', home: 'Morecambe', away: 'AFC Telford United', status: 'scheduled', venue: 'Mazuma Mobile Stadium' },
  { id: 'pl-che-sun', competition: 'Premier League', competitionShort: 'ENGLAND', round: 'Matchday 2', kickoff: '2026-08-29T11:30:00Z', home: 'Chelsea', away: 'Sunderland', status: 'scheduled', venue: 'Stamford Bridge' },
  { id: 'pl-liv-bri', competition: 'Premier League', competitionShort: 'ENGLAND', round: 'Matchday 2', kickoff: '2026-08-29T14:00:00Z', home: 'Liverpool', away: 'Brighton', status: 'scheduled', venue: 'Anfield' },
  { id: 'pl-mun-new', competition: 'Premier League', competitionShort: 'ENGLAND', round: 'Matchday 2', kickoff: '2026-08-29T16:30:00Z', home: 'Manchester United', away: 'Newcastle United', status: 'scheduled', venue: 'Old Trafford' },
  { id: 'pl-ful-eve', competition: 'Premier League', competitionShort: 'ENGLAND', round: 'Matchday 2', kickoff: '2026-08-29T14:00:00Z', home: 'Fulham', away: 'Everton', status: 'scheduled', venue: 'Craven Cottage' },
  { id: 'nlh-tel-bed', competition: 'National League North', competitionShort: 'NON-LEAGUE', round: 'Matchday 8', kickoff: '2026-08-31T14:00:00Z', home: 'AFC Telford United', away: 'Bedford Town', status: 'scheduled', venue: 'SEAH Stadium' },
  { id: 'nlh-sca-tel', competition: 'National League North', competitionShort: 'NON-LEAGUE', round: 'Matchday 9', kickoff: '2026-09-05T14:00:00Z', home: 'Scarborough Athletic', away: 'AFC Telford United', status: 'scheduled', venue: 'Flamingo Land Stadium' },
  { id: 'nlh-tel-oxf', competition: 'National League North', competitionShort: 'NON-LEAGUE', round: 'Matchday 10', kickoff: '2026-09-08T18:45:00Z', home: 'AFC Telford United', away: 'Oxford City', status: 'scheduled', venue: 'SEAH Stadium' },
  { id: 'nlh-har-tel', competition: 'National League North', competitionShort: 'NON-LEAGUE', round: 'Matchday 11', kickoff: '2026-09-12T14:00:00Z', home: 'Harborough Town', away: 'AFC Telford United', status: 'scheduled', venue: 'Bowden Park' },
  { id: 'pl-ars-liv', competition: 'Premier League', competitionShort: 'ENGLAND', round: 'Matchday 3', kickoff: '2026-09-05T16:30:00Z', home: 'Arsenal', away: 'Liverpool', status: 'scheduled', venue: 'Emirates Stadium' },
];

export const fixtures: Fixture[] = footballData.fixtures.length
  ? (footballData.fixtures as Fixture[])
  : demoFixtures;

export const dataUpdatedAt = footballData.generatedAt;
export const dataSource = footballData.source;
export const competitionCount = footballData.competitions.length;

export const teamAliases: Record<string, string> = Object.fromEntries(
  Object.entries(footballData.aliases).map(([alias, teamId]) => [
    alias,
    footballData.teams.find((team) => team.id === teamId)?.name ?? alias,
  ]),
);
export const standings: Array<[string, number, number]> = [['Arsenal', 6, 6], ['Liverpool', 4, 2], ['Chelsea', 4, 2], ['Newcastle', 3, 1], ['Brighton', 3, 0]];
export function resolveTeam(query: string) { const normalized = query.trim().toLowerCase(); if (teamAliases[normalized]) return teamAliases[normalized]; const teams = [...new Set(fixtures.flatMap((fixture) => [fixture.home, fixture.away]))]; return teams.find((team) => team.toLowerCase().includes(normalized)); }
