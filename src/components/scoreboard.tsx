import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { fixtures, resolveTeam, standings, type Fixture } from '../data/fixtures';

type ScoresSearch = { date: string; team?: string; status: 'all' | 'live' | 'upcoming' };
const dates = [['MON', '24', '2026-08-24'], ['TUE', '25', '2026-08-25'], ['TODAY', '26', '2026-08-26'], ['THU', '27', '2026-08-27'], ['FRI', '28', '2026-08-28'], ['SAT', '29', '2026-08-29'], ['SUN', '30', '2026-08-30']];
const timeFormatter = new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'Europe/London' });
const dateFormatter = new Intl.DateTimeFormat('en-GB', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'Europe/London' });
function initials(team: string) { const ignored = new Set(['AFC', 'FC', 'United', 'Town']); return team.split(' ').filter((word) => !ignored.has(word)).slice(0, 2).map((word) => word[0]).join('').toUpperCase(); }
function fixtureDate(fixture: Fixture) { return fixture.kickoff.slice(0, 10); }
function groupFixtures(list: Fixture[]) { return list.reduce<Record<string, Fixture[]>>((groups, fixture) => { (groups[fixture.competition] ??= []).push(fixture); return groups; }, {}); }

export function Scoreboard({ search }: { search: ScoresSearch }) {
  const navigate = useNavigate({ from: '/' });
  const [query, setQuery] = useState(search.team ?? '');
  const [announcement, setAnnouncement] = useState('');
  useEffect(() => setQuery(search.team ?? ''), [search.team]);
  const selectedTeam = search.team ? resolveTeam(search.team) : undefined;
  const filteredFixtures = useMemo(() => {
    let result = selectedTeam ? fixtures.filter((fixture) => fixture.home === selectedTeam || fixture.away === selectedTeam) : fixtures.filter((fixture) => fixtureDate(fixture) === search.date);
    if (search.status === 'live') result = result.filter((fixture) => fixture.status === 'live');
    if (search.status === 'upcoming') result = result.filter((fixture) => fixture.status === 'scheduled');
    return result;
  }, [search.date, search.status, selectedTeam]);
  const grouped = groupFixtures(filteredFixtures);
  const heading = selectedTeam ? `${selectedTeam} fixtures` : dateFormatter.format(new Date(`${search.date}T12:00:00Z`));

  useEffect(() => {
    if (typeof document.modelContext?.registerTool !== 'function') return;
    const controller = new AbortController();
    void document.modelContext.registerTool({
      name: 'search_football_teams', description: 'Find football teams available on this page, including lower-league clubs and common aliases.',
      inputSchema: { type: 'object', properties: { query: { type: 'string', description: 'Full or partial team name, such as Liverpool or Telford.' } }, required: ['query'], additionalProperties: false }, annotations: { readOnlyHint: true },
      execute: async ({ query: teamQuery }: { query: string }) => { const team = resolveTeam(teamQuery); return team ? { teams: [{ name: team }] } : { teams: [], message: `No team matched “${teamQuery}”.` }; },
    }, { signal: controller.signal });
    void document.modelContext.registerTool({
      name: 'get_team_fixtures', description: 'Get scheduled or completed football matches for a team in a date range. Dates must be ISO YYYY-MM-DD.',
      inputSchema: { type: 'object', properties: { team: { type: 'string', description: 'Team name or common alias.' }, dateFrom: { type: 'string', description: 'Inclusive start date in YYYY-MM-DD format.' }, dateTo: { type: 'string', description: 'Inclusive end date in YYYY-MM-DD format.' }, limit: { type: 'integer', minimum: 1, maximum: 20, default: 10 } }, required: ['team', 'dateFrom', 'dateTo'], additionalProperties: false }, annotations: { readOnlyHint: true },
      execute: async ({ team: teamQuery, dateFrom, dateTo, limit = 10 }: { team: string; dateFrom: string; dateTo: string; limit?: number }) => {
        const team = resolveTeam(teamQuery); if (!team) return { matches: [], message: `No team matched “${teamQuery}”.` };
        const matches = fixtures.filter((fixture) => (fixture.home === team || fixture.away === team) && fixtureDate(fixture) >= dateFrom && fixtureDate(fixture) <= dateTo).slice(0, limit).map((fixture) => ({ id: fixture.id, competition: fixture.competition, kickoff: fixture.kickoff, homeTeam: fixture.home, awayTeam: fixture.away, venue: fixture.venue, status: fixture.status, score: fixture.status === 'scheduled' ? null : { home: fixture.homeScore, away: fixture.awayScore } }));
        return { team, matches, dataUpdatedAt: '2026-08-26T18:30:00Z', source: 'Matchday demonstration dataset' };
      },
    }, { signal: controller.signal });
    void document.modelContext.registerTool({
      name: 'show_team_fixtures', description: 'Filter the visible page to show fixtures for one football team. This changes the page but does not save or publish anything.',
      inputSchema: { type: 'object', properties: { team: { type: 'string', description: 'Team name or common alias.' } }, required: ['team'], additionalProperties: false },
      execute: async ({ team: teamQuery }: { team: string }) => { const team = resolveTeam(teamQuery); if (!team) return { changed: false, message: `No team matched “${teamQuery}”.` }; await navigate({ search: (previous) => ({ ...previous, team, status: 'all' }) }); const count = fixtures.filter((fixture) => fixture.home === team || fixture.away === team).length; setAnnouncement(`Showing ${count} fixtures for ${team}.`); return { changed: true, team, visibleMatchCount: count }; },
    }, { signal: controller.signal });
    return () => controller.abort();
  }, [navigate]);

  function submitSearch(event: React.FormEvent) { event.preventDefault(); const team = resolveTeam(query); if (!team) { setAnnouncement(`No team matched ${query}. Try Liverpool or AFC Telford United.`); return; } void navigate({ search: (previous) => ({ ...previous, team, status: 'all' }) }); setAnnouncement(`Showing fixtures for ${team}.`); }

  return <div className="site-shell">
    <div className="score-ticker" aria-label="Live scores ticker"><span className="ticker-live"><i /> LIVE</span><span>CEL <strong>1–1</strong> BAS <b>74′</b></span><span>HER <strong>0–1</strong> CHE <b>68′</b></span><span className="ticker-note">Kick-off times shown in UK time</span></div>
    <header className="topbar"><a className="brand" href="#top" aria-label="Matchday home"><span className="brand-ball" aria-hidden="true">M</span><span>MATCHDAY</span></a><nav aria-label="Primary navigation"><a className="active" href="#scores">Scores</a><a href="#fixtures">Fixtures</a><a href="#tables">Tables</a><a href="#competitions">Competitions</a></nav><button className="menu-button" type="button">My teams <span>2</span></button></header>
    <div className="competition-nav" id="competitions"><div>{['Top matches', 'Premier League', 'Championship', 'League One', 'League Two', 'Non-League'].map((label, index) => <button className={index === 0 ? 'active' : ''} key={label} type="button">{label}</button>)}</div></div>
    <main id="top">
      <section className="score-hero" id="scores"><div><p className="eyebrow"><span className="live-dot" /> Wednesday football · 2 matches live</p><h1>Scores & fixtures</h1><p className="hero-copy">Every match. Every level. One place.</p></div><form className="team-search" onSubmit={submitSearch}><label htmlFor="team-search">Find a team or competition</label><div><input id="team-search" type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Try AFC Telford United" /><button type="submit">Search</button></div></form></section>
      <section className="date-strip" aria-label="Choose a date">{dates.map(([day, date, iso]) => <button className={!selectedTeam && search.date === iso ? 'selected' : ''} key={iso} onClick={() => void navigate({ search: { date: iso, status: search.status } })} type="button"><span>{day}</span><strong>{date}</strong></button>)}<button className="calendar-button" type="button" aria-label="Open calendar"><span>CAL</span><strong>▦</strong></button></section>
      <div className="mobile-filter-row" aria-label="Match status filter">{(['all', 'live', 'upcoming'] as const).map((status) => <button className={search.status === status ? 'active' : ''} key={status} onClick={() => void navigate({ search: (previous) => ({ ...previous, status }) })} type="button">{status}</button>)}</div>
      <div className="content-grid" id="fixtures"><div className="results-column">
        <div className="results-toolbar"><div><p>{selectedTeam ? 'TEAM VIEW' : 'MATCH CENTRE'}</p><h2>{heading}</h2></div>{selectedTeam && <button type="button" onClick={() => void navigate({ search: { date: search.date, status: search.status } })}>Clear team ×</button>}<span>{filteredFixtures.length} matches</span></div>
        {Object.keys(grouped).length === 0 ? <section className="empty-state"><span>90′</span><h2>No matches found</h2><p>Try another date, select “All”, or search for Liverpool or AFC Telford United.</p></section> : Object.entries(grouped).map(([competition, matches]) => <section className="results-panel" aria-labelledby={`competition-${competition}`} key={competition}>
          <div className="panel-heading"><div className="competition-mark" aria-hidden="true">{matches[0].competitionShort.slice(0, 1)}</div><div><p>{matches[0].competitionShort}</p><h2 id={`competition-${competition}`}>{competition}</h2></div><button type="button" aria-label={`Follow ${competition}`}>＋</button></div>
          <div className="round-label"><span>{matches[0].round}</span><button type="button">Match centre ↗</button></div>
          {matches.map((fixture) => <article className={`fixture-row ${fixture.status === 'live' ? 'is-live' : ''}`} key={fixture.id}><div className="team home-team"><span>{fixture.home}</span><i>{initials(fixture.home)}</i></div><div className="score-cell">{fixture.status === 'scheduled' ? <strong className="kickoff">{timeFormatter.format(new Date(fixture.kickoff))}</strong> : <strong>{fixture.homeScore}<b>–</b>{fixture.awayScore}</strong>}<span className={fixture.status === 'live' ? 'live-status' : ''}>{fixture.status === 'live' ? fixture.minute : fixture.status === 'finished' ? 'FT' : fixtureDate(fixture) === '2026-08-26' ? 'TODAY' : fixtureDate(fixture).slice(5).split('-').reverse().join('/')}</span></div><div className="team away-team"><i>{initials(fixture.away)}</i><span>{fixture.away}</span></div><button className="fixture-more" type="button" aria-label={`View ${fixture.home} versus ${fixture.away}`}>›</button></article>)}
        </section>)}
        <p className="data-note">Demonstration fixture data · Last updated 26 Aug 2026, 19:30 BST</p>
      </div><aside className="sidebar">
        <section className="agent-card"><div className="agent-topline"><span className="agent-badge">SITE TOOLS READY</span><i aria-hidden="true" /></div><h2>Just ask Matchday</h2><p>Your browser agent can cut through every league, date and fixture—without making you navigate them one by one.</p><ul><li>“When do Liverpool play next?”</li><li>“Show AFC Telford on Saturday.”</li></ul><div className="tool-count"><strong>3</strong><span>structured tools available</span></div></section>
        <section className="filter-card"><h2>Match filter</h2>{(['all', 'live', 'upcoming'] as const).map((status) => <button className={search.status === status ? 'active' : ''} key={status} onClick={() => void navigate({ search: (previous) => ({ ...previous, status }) })} type="button"><span>{status === 'all' ? 'All matches' : status === 'live' ? 'Live now' : 'Upcoming'}</span><b>{status === 'all' ? fixtures.length : fixtures.filter((fixture) => status === 'live' ? fixture.status === 'live' : fixture.status === 'scheduled').length}</b></button>)}</section>
        <section className="table-card" id="tables"><div className="sidebar-heading"><div><span>TABLE</span><h2>Premier League</h2></div><button type="button">View all</button></div><div className="table-head"><span>POS</span><span>TEAM</span><span>GD</span><span>PTS</span></div>{standings.map(([team, points, difference], index) => <div className="standing-row" key={team}><b>{index + 1}</b><span><i>{initials(team)}</i>{team}</span><em>{difference > 0 ? '+' : ''}{difference}</em><strong>{points}</strong></div>)}</section>
      </aside></div>
      <section className="accessibility-story"><div className="story-number">01</div><div><p>WHY SITE TOOLS?</p><h2>The full fixture list stays. The obstacle course doesn’t.</h2></div><p>Matchday keeps the rich, familiar scores interface for browsing while giving agents a direct, structured path to the answer.</p></section>
    </main>
    <footer><div className="brand footer-brand"><span className="brand-ball">M</span><span>MATCHDAY</span></div><p>An independent WebMCP accessibility demonstration. Not affiliated with the BBC or any football competition.</p><span>© 2026 Matchday</span></footer>
    <div className="sr-announcement" role="status" aria-live="polite">{announcement}</div>
  </div>;
}
