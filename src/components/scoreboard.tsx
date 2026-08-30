import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { competitionCount, dataSource, dataUpdatedAt, fixtures, resolveTeam, standings, type Fixture } from '../data/fixtures';

type ScoresSearch = { date: string; team?: string; status: 'all' | 'live' | 'upcoming'; countries?: string; competitions?: string };
const countryOptions = [...new Set(fixtures.map((fixture) => fixture.competitionShort))].sort();
const competitionOptions = [...new Set(fixtures.map((fixture) => fixture.competition))].sort();
const quickFilters: Array<[string, string[]]> = [['Top matches', []], ['Premier League', ['Premier League']], ['Championship', ['Championship']], ['League One', ['League One']], ['League Two', ['League Two']], ['Non-League', ['Enterprise National League', 'Enterprise National League North']]];
const timeFormatter = new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'Europe/London' });
const dateFormatter = new Intl.DateTimeFormat('en-GB', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'Europe/London' });
const updateFormatter = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'Europe/London' });
const monthFormatter = new Intl.DateTimeFormat('en-GB', { month: 'long', year: 'numeric', timeZone: 'UTC' });
const weekdayFormatter = new Intl.DateTimeFormat('en-GB', { weekday: 'short', timeZone: 'UTC' });
const longDateFormatter = new Intl.DateTimeFormat('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });
const weekdayNames = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
function initials(team: string) { const ignored = new Set(['AFC', 'FC', 'United', 'Town']); return team.split(' ').filter((word) => !ignored.has(word)).slice(0, 2).map((word) => word[0]).join('').toUpperCase(); }
function fixtureDate(fixture: Fixture) { return fixture.kickoff.slice(0, 10); }
function isIsoDate(value: string) { return /^\d{4}-\d{2}-\d{2}$/.test(value) && new Date(`${value}T12:00:00Z`).toISOString().slice(0, 10) === value; }
function parseDate(value: string) { return new Date(`${value}T12:00:00Z`); }
function isoDate(value: Date) { return value.toISOString().slice(0, 10); }
function getWeekDates(selectedDate: string) {
  const selected = parseDate(selectedDate);
  const monday = new Date(selected);
  monday.setUTCDate(selected.getUTCDate() - ((selected.getUTCDay() + 6) % 7));
  return Array.from({ length: 7 }, (_, index) => {
    const date = new Date(monday);
    date.setUTCDate(monday.getUTCDate() + index);
    return { day: weekdayFormatter.format(date).toUpperCase(), date: String(date.getUTCDate()), iso: isoDate(date) };
  });
}
function getCalendarDays(month: string) {
  const [year, monthNumber] = month.split('-').map(Number);
  const first = new Date(Date.UTC(year, monthNumber - 1, 1, 12));
  const gridStart = new Date(first);
  gridStart.setUTCDate(first.getUTCDate() - ((first.getUTCDay() + 6) % 7));
  return Array.from({ length: 42 }, (_, index) => {
    const date = new Date(gridStart);
    date.setUTCDate(gridStart.getUTCDate() + index);
    return { iso: isoDate(date), day: date.getUTCDate(), outsideMonth: date.getUTCMonth() !== monthNumber - 1 };
  });
}
function shiftMonth(month: string, amount: number) {
  const [year, monthNumber] = month.split('-').map(Number);
  return isoDate(new Date(Date.UTC(year, monthNumber - 1 + amount, 1, 12))).slice(0, 7);
}
function groupFixtures(list: Fixture[]) { return list.reduce<Record<string, Fixture[]>>((groups, fixture) => { (groups[fixture.competition] ??= []).push(fixture); return groups; }, {}); }
function parseSelection(value?: string) { return value ? value.split('|').filter(Boolean) : []; }
function encodeSelection(values: string[]) { return values.length ? values.join('|') : undefined; }
function canonicalSelections(values: string[], options: string[]) { return values.map((value) => options.find((option) => option.toLowerCase() === value.toLowerCase())).filter((value): value is string => Boolean(value)); }

export function Scoreboard({ search }: { search: ScoresSearch }) {
  const navigate = useNavigate({ from: '/' });
  const [query, setQuery] = useState(search.team ?? '');
  const [announcement, setAnnouncement] = useState('');
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [calendarMonth, setCalendarMonth] = useState(search.date.slice(0, 7));
  const [selectedFixture, setSelectedFixture] = useState<Fixture>();
  const [followedCompetitions, setFollowedCompetitions] = useState<string[]>([]);
  const [followingOpen, setFollowingOpen] = useState(false);
  const [openFilter, setOpenFilter] = useState<'countries' | 'competitions' | null>(null);
  const calendarDialog = useRef<HTMLDialogElement>(null);
  const fixtureDialog = useRef<HTMLDialogElement>(null);
  const followingMenu = useRef<HTMLDivElement>(null);
  const followingButton = useRef<HTMLButtonElement>(null);
  const followingLoaded = useRef(false);
  const filterBar = useRef<HTMLElement>(null);
  const countryFilterButton = useRef<HTMLButtonElement>(null);
  const competitionFilterButton = useRef<HTMLButtonElement>(null);
  const searchState = useRef(search);
  useEffect(() => setQuery(search.team ?? ''), [search.team]);
  useEffect(() => { searchState.current = search; }, [search]);
  useEffect(() => {
    if (!calendarOpen) return;
    setCalendarMonth(search.date.slice(0, 7));
    calendarDialog.current?.showModal();
  }, [calendarOpen, search.date]);
  useEffect(() => { selectedFixture && fixtureDialog.current?.showModal(); }, [selectedFixture]);
  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem('matchday-followed-competitions') ?? '[]');
      if (Array.isArray(saved)) setFollowedCompetitions(saved.filter((competition): competition is string => typeof competition === 'string' && competitionOptions.includes(competition)));
    } catch { /* Ignore damaged device-local preferences. */ }
  }, []);
  useEffect(() => {
    if (!followingLoaded.current) { followingLoaded.current = true; return; }
    try { localStorage.setItem('matchday-followed-competitions', JSON.stringify(followedCompetitions)); } catch { /* The list still works for this session. */ }
  }, [followedCompetitions]);
  useEffect(() => {
    if (!followingOpen) return;
    function closeOnOutsideClick(event: PointerEvent) {
      if (!followingMenu.current?.contains(event.target as Node)) setFollowingOpen(false);
    }
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key !== 'Escape') return;
      setFollowingOpen(false);
      followingButton.current?.focus();
    }
    document.addEventListener('pointerdown', closeOnOutsideClick);
    document.addEventListener('keydown', closeOnEscape);
    return () => {
      document.removeEventListener('pointerdown', closeOnOutsideClick);
      document.removeEventListener('keydown', closeOnEscape);
    };
  }, [followingOpen]);
  useEffect(() => {
    if (!openFilter) return;
    function closeOnOutsideClick(event: PointerEvent) {
      if (!filterBar.current?.contains(event.target as Node)) setOpenFilter(null);
    }
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key !== 'Escape') return;
      const trigger = openFilter === 'countries' ? countryFilterButton.current : competitionFilterButton.current;
      setOpenFilter(null);
      trigger?.focus();
    }
    document.addEventListener('pointerdown', closeOnOutsideClick);
    document.addEventListener('keydown', closeOnEscape);
    return () => {
      document.removeEventListener('pointerdown', closeOnOutsideClick);
      document.removeEventListener('keydown', closeOnEscape);
    };
  }, [openFilter]);
  const selectedTeam = search.team ? resolveTeam(search.team) : undefined;
  const selectedCountries = parseSelection(search.countries);
  const selectedCompetitions = parseSelection(search.competitions);
  const scopedFixtures = useMemo(() => {
    let result = selectedTeam ? fixtures.filter((fixture) => fixture.home === selectedTeam || fixture.away === selectedTeam) : fixtures.filter((fixture) => fixtureDate(fixture) === search.date);
    if (selectedCountries.length) result = result.filter((fixture) => selectedCountries.includes(fixture.competitionShort));
    if (selectedCompetitions.length) result = result.filter((fixture) => selectedCompetitions.includes(fixture.competition));
    return result;
  }, [search.date, search.countries, search.competitions, selectedTeam]);
  const filteredFixtures = useMemo(() => {
    if (search.status === 'live') return scopedFixtures.filter((fixture) => fixture.status === 'live');
    if (search.status === 'upcoming') return scopedFixtures.filter((fixture) => fixture.status === 'scheduled');
    return scopedFixtures;
  }, [scopedFixtures, search.status]);
  const grouped = groupFixtures(filteredFixtures);
  const heading = selectedTeam ? `${selectedTeam} fixtures` : dateFormatter.format(new Date(`${search.date}T12:00:00Z`));
  const dateFixtures = fixtures.filter((fixture) => fixtureDate(fixture) === search.date);
  const liveCount = dateFixtures.filter((fixture) => fixture.status === 'live').length;
  const tickerFixtures = dateFixtures.slice(0, 2);
  const weekDates = getWeekDates(search.date);
  const calendarDays = getCalendarDays(calendarMonth);
  const calendarMonthDate = parseDate(`${calendarMonth}-01`);

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
      inputSchema: { type: 'object', properties: { team: { type: 'string', description: 'Team name or common alias.' }, dateFrom: { type: 'string', pattern: '^\\d{4}-\\d{2}-\\d{2}$', description: 'Inclusive start date in YYYY-MM-DD format.' }, dateTo: { type: 'string', pattern: '^\\d{4}-\\d{2}-\\d{2}$', description: 'Inclusive end date in YYYY-MM-DD format.' }, limit: { type: 'integer', minimum: 1, maximum: 20, default: 10 } }, required: ['team', 'dateFrom', 'dateTo'], additionalProperties: false }, annotations: { readOnlyHint: true },
      execute: async ({ team: teamQuery, dateFrom, dateTo, limit = 10 }: { team: string; dateFrom: string; dateTo: string; limit?: number }) => {
        const team = resolveTeam(teamQuery); if (!team) return { matches: [], message: `No team matched “${teamQuery}”.` };
        if (!isIsoDate(dateFrom) || !isIsoDate(dateTo) || dateFrom > dateTo) return { team, matches: [], message: 'Use valid ISO dates with dateFrom on or before dateTo.' };
        const matches = fixtures.filter((fixture) => (fixture.home === team || fixture.away === team) && fixtureDate(fixture) >= dateFrom && fixtureDate(fixture) <= dateTo).sort((a, b) => a.kickoff.localeCompare(b.kickoff)).slice(0, limit).map((fixture) => ({ id: fixture.id, competition: fixture.competition, kickoff: fixture.kickoff, homeTeam: fixture.home, awayTeam: fixture.away, venue: fixture.venue, status: fixture.status, score: fixture.status === 'scheduled' ? null : { home: fixture.homeScore, away: fixture.awayScore } }));
        return { team, matches, dataUpdatedAt, source: dataSource };
      },
    }, { signal: controller.signal });
    void document.modelContext.registerTool({
      name: 'show_team_fixtures', description: 'Filter the visible page to show fixtures for one football team. This changes the page but does not save or publish anything.',
      inputSchema: { type: 'object', properties: { team: { type: 'string', description: 'Team name or common alias.' } }, required: ['team'], additionalProperties: false },
      execute: async ({ team: teamQuery }: { team: string }) => { const team = resolveTeam(teamQuery); if (!team) return { changed: false, message: `No team matched “${teamQuery}”.` }; await navigate({ search: (previous) => ({ ...previous, team, status: 'all', countries: undefined, competitions: undefined }) }); const count = fixtures.filter((fixture) => fixture.home === team || fixture.away === team).length; setAnnouncement(`Showing ${count} fixtures for ${team}.`); return { changed: true, team, visibleMatchCount: count, clearedMatchFilters: true }; },
    }, { signal: controller.signal });
    void document.modelContext.registerTool({
      name: 'get_match_filter_options', description: 'List the countries and football competitions that can be used to filter the visible scores and fixtures page.',
      inputSchema: { type: 'object', properties: {}, additionalProperties: false }, annotations: { readOnlyHint: true },
      execute: async () => { const current = searchState.current; return { countries: countryOptions, competitions: competitionOptions, selected: { countries: parseSelection(current.countries), competitions: parseSelection(current.competitions), status: current.status, date: current.date } }; },
    }, { signal: controller.signal });
    void document.modelContext.registerTool({
      name: 'set_match_filters', description: 'Change which countries and competitions are listed on the visible page. Empty arrays clear those filters.',
      inputSchema: { type: 'object', properties: { countries: { type: 'array', items: { type: 'string' }, description: 'Country names from get_match_filter_options. Use an empty array for all countries.' }, competitions: { type: 'array', items: { type: 'string' }, description: 'Competition names from get_match_filter_options. Use an empty array for all competitions.' }, date: { type: 'string', pattern: '^\\d{4}-\\d{2}-\\d{2}$', description: 'Optional fixture date in YYYY-MM-DD format.' }, status: { type: 'string', enum: ['all', 'live', 'upcoming'], description: 'Optional match status filter.' } }, required: ['countries', 'competitions'], additionalProperties: false },
      execute: async ({ countries, competitions, date, status }: { countries: string[]; competitions: string[]; date?: string; status?: 'all' | 'live' | 'upcoming' }) => { const current = searchState.current; if (date && !isIsoDate(date)) return { changed: false, message: 'Use a valid ISO date in YYYY-MM-DD format.' }; const validCountries = canonicalSelections(countries, countryOptions); const validCompetitions = canonicalSelections(competitions, competitionOptions); const ignoredCountries = countries.filter((country) => !validCountries.includes(country)); const ignoredCompetitions = competitions.filter((competition) => !validCompetitions.includes(competition)); const nextDate = date ?? current.date; const nextStatus = status ?? current.status; await navigate({ search: (previous) => ({ ...previous, team: undefined, countries: encodeSelection(validCountries), competitions: encodeSelection(validCompetitions), date: nextDate, status: nextStatus }) }); setAnnouncement(`Filters updated: ${validCountries.length || 'all'} countries and ${validCompetitions.length || 'all'} competitions.`); return { changed: true, countries: validCountries, competitions: validCompetitions, ignoredCountries, ignoredCompetitions, date: nextDate, status: nextStatus }; },
    }, { signal: controller.signal });
    return () => controller.abort();
  }, [navigate]);

  function submitSearch(event: React.FormEvent) { event.preventDefault(); const team = resolveTeam(query); if (!team) { setAnnouncement(`No team matched ${query || 'that search'}. Try Liverpool or AFC Telford United.`); return; } void navigate({ search: (previous) => ({ ...previous, team, status: 'all', countries: undefined, competitions: undefined }) }); setAnnouncement(`Showing fixtures for ${team}.`); }
  function toggleSelection(kind: 'countries' | 'competitions', value: string) { const selected = kind === 'countries' ? selectedCountries : selectedCompetitions; const next = selected.includes(value) ? selected.filter((item) => item !== value) : [...selected, value]; void navigate({ search: (previous) => ({ ...previous, [kind]: encodeSelection(next) }) }); }
  function setQuickFilter(competitions: string[]) { void navigate({ search: (previous) => ({ ...previous, competitions: encodeSelection(competitions) }) }); }
  function chooseDate(date: string) {
    void navigate({ search: (previous) => ({ ...previous, date, team: undefined }) });
    setCalendarOpen(false);
    setAnnouncement(`Showing fixtures for ${longDateFormatter.format(parseDate(date))}.`);
  }
  function toggleFollow(competition: string) {
    const followed = followedCompetitions.includes(competition);
    setFollowedCompetitions((current) => followed ? current.filter((item) => item !== competition) : [...current, competition]);
    setAnnouncement(`${followed ? 'Stopped following' : 'Now following'} ${competition}.`);
  }
  const hasFilters = selectedCountries.length > 0 || selectedCompetitions.length > 0;

  return <div className="site-shell">
    <div className="score-ticker" aria-label="Selected match ticker"><span className="ticker-live"><i /> {liveCount ? 'LIVE' : 'REAL DATA'}</span>{tickerFixtures.map((fixture) => <span key={fixture.id}>{initials(fixture.home)} <strong>{fixture.status === 'scheduled' ? timeFormatter.format(new Date(fixture.kickoff)) : `${fixture.homeScore ?? 0}–${fixture.awayScore ?? 0}`}</strong> {initials(fixture.away)} <b>{fixture.status === 'finished' ? 'FT' : fixture.status === 'live' ? fixture.minute ?? 'LIVE' : ''}</b></span>)}<span className="ticker-note">Kick-off times shown in UK time</span></div>
    <header className="topbar"><a className="brand" href="#top" aria-label="Matchday home"><span className="brand-ball" aria-hidden="true">M</span><span>MATCHDAY</span></a><nav aria-label="Primary navigation"><a className="active" href="#scores">Scores</a><a href="#fixtures">Fixtures</a><a href="#tables">Tables</a><a href="#competitions">Competitions</a></nav><div className="following-menu" ref={followingMenu}><button aria-controls="following-panel" aria-expanded={followingOpen} className="menu-button" onClick={() => { setOpenFilter(null); setFollowingOpen((open) => !open); }} ref={followingButton} type="button">Following <span>{followedCompetitions.length}</span></button>{followingOpen && <section aria-label="Followed competitions" className="following-panel" id="following-panel"><div className="following-heading"><span>MY FOOTBALL</span><h2>Following</h2></div>{followedCompetitions.length ? <ul>{followedCompetitions.map((competition) => <li key={competition}><span>{competition}</span><button aria-label={`Stop following ${competition}`} onClick={() => toggleFollow(competition)} type="button">Remove</button></li>)}</ul> : <div className="following-empty"><strong>Nothing followed yet</strong><p>Use the ＋ beside any competition to add it here.</p></div>}</section>}</div></header>
    <div className="competition-nav" id="competitions"><div>{quickFilters.map(([label, competitions]) => <button className={selectedCompetitions.length === competitions.length && competitions.every((competition) => selectedCompetitions.includes(competition)) ? 'active' : ''} key={label} onClick={() => setQuickFilter(competitions)} type="button">{label}</button>)}</div></div>
    <main id="top">
      <section className="score-hero" id="scores"><div><p className="eyebrow"><span className="live-dot" /> {dateFixtures.length} matches · {competitionCount} competitions loaded</p><h1>Scores & fixtures</h1><p className="hero-copy">Every match. Every level. One place.</p></div><form className="team-search" onSubmit={submitSearch}><label htmlFor="team-search">Find a football team</label><div><input id="team-search" type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Try AFC Telford United" /><button type="submit">Search</button></div></form></section>
      <section className="date-strip" aria-label="Choose a date">{weekDates.map(({ day, date, iso }) => <button aria-current={!selectedTeam && search.date === iso ? 'date' : undefined} aria-label={longDateFormatter.format(parseDate(iso))} className={!selectedTeam && search.date === iso ? 'selected' : ''} key={iso} onClick={() => chooseDate(iso)} type="button"><span>{day}</span><strong>{date}</strong></button>)}<button aria-haspopup="dialog" className="calendar-button" onClick={() => setCalendarOpen(true)} type="button"><span>CAL</span><strong aria-hidden="true">▦</strong><span className="sr-only">Open calendar</span></button></section>
      {calendarOpen && <dialog aria-labelledby="calendar-title" className="calendar-dialog" onCancel={() => setCalendarOpen(false)} onClose={() => setCalendarOpen(false)} ref={calendarDialog}>
        <div className="calendar-heading"><div><span>CHOOSE A DATE</span><h2 id="calendar-title">{monthFormatter.format(calendarMonthDate)}</h2></div><button aria-label="Close calendar" className="calendar-close" onClick={() => setCalendarOpen(false)} type="button">×</button></div>
        <div className="calendar-navigation"><button aria-label="Previous month" onClick={() => setCalendarMonth((month) => shiftMonth(month, -1))} type="button">←</button><button aria-label="Return to selected month" onClick={() => setCalendarMonth(search.date.slice(0, 7))} type="button">Selected date</button><button aria-label="Next month" onClick={() => setCalendarMonth((month) => shiftMonth(month, 1))} type="button">→</button></div>
        <div aria-hidden="true" className="calendar-weekdays">{weekdayNames.map((day) => <span key={day}>{day.slice(0, 2)}</span>)}</div>
        <div className="calendar-grid">{calendarDays.map((date, index) => <button aria-current={date.iso === search.date ? 'date' : undefined} aria-label={longDateFormatter.format(parseDate(date.iso))} autoFocus={date.iso === search.date} className={`${date.outsideMonth ? 'outside-month' : ''} ${date.iso === search.date ? 'selected-date' : ''}`} key={date.iso} onClick={() => chooseDate(date.iso)} tabIndex={date.outsideMonth ? -1 : 0} type="button"><span aria-hidden="true">{date.day}</span>{index < 7 && <span className="sr-only">{weekdayNames[index]}</span>}</button>)}</div>
        <p>Choose any date to update the scores and fixtures shown on the page.</p>
      </dialog>}
      <section className="fixture-filters" aria-label="Filter visible fixtures" ref={filterBar}><div className="filter-intro"><span>FILTER VIEW</span><strong>{hasFilters ? `${selectedCountries.length + selectedCompetitions.length} selected` : 'All football'}</strong></div><div className="filter-menu"><button aria-controls="country-filter-options" aria-expanded={openFilter === 'countries'} className="filter-summary" onClick={() => { setFollowingOpen(false); setOpenFilter((current) => current === 'countries' ? null : 'countries'); }} ref={countryFilterButton} type="button"><span>Countries</span><b>{selectedCountries.length || 'All'}</b></button>{openFilter === 'countries' && <div aria-label="Countries" className="filter-options" id="country-filter-options" role="group">{countryOptions.map((country) => <label key={country}><input checked={selectedCountries.includes(country)} onChange={() => toggleSelection('countries', country)} type="checkbox" /><span>{country}</span></label>)}</div>}</div><div className="filter-menu"><button aria-controls="competition-filter-options" aria-expanded={openFilter === 'competitions'} className="filter-summary" onClick={() => { setFollowingOpen(false); setOpenFilter((current) => current === 'competitions' ? null : 'competitions'); }} ref={competitionFilterButton} type="button"><span>Competitions</span><b>{selectedCompetitions.length || 'All'}</b></button>{openFilter === 'competitions' && <div aria-label="Competitions" className="filter-options" id="competition-filter-options" role="group">{competitionOptions.map((competition) => <label key={competition}><input checked={selectedCompetitions.includes(competition)} onChange={() => toggleSelection('competitions', competition)} type="checkbox" /><span>{competition}</span></label>)}</div>}</div>{hasFilters && <button className="clear-filters" type="button" onClick={() => void navigate({ search: (previous) => ({ ...previous, countries: undefined, competitions: undefined }) })}>Clear filters</button>}</section>
      <div className="mobile-filter-row" aria-label="Match status filter">{(['all', 'live', 'upcoming'] as const).map((status) => <button className={search.status === status ? 'active' : ''} key={status} onClick={() => void navigate({ search: (previous) => ({ ...previous, status }) })} type="button">{status}</button>)}</div>
      <div className="content-grid" id="fixtures"><div className="results-column">
        <div className="results-toolbar"><div><p>{selectedTeam ? 'TEAM VIEW' : 'MATCH CENTRE'}</p><h2>{heading}</h2></div>{selectedTeam && <button type="button" onClick={() => void navigate({ search: (previous) => ({ ...previous, team: undefined }) })}>Clear team ×</button>}<span>{filteredFixtures.length} matches</span></div>
        {Object.keys(grouped).length === 0 ? <section className="empty-state"><span>90′</span><h2>No matches found</h2><p>Try another date, select “All”, or search for Liverpool or AFC Telford United.</p></section> : Object.entries(grouped).map(([competition, matches]) => <section className="results-panel" aria-labelledby={`competition-${competition}`} key={competition}>
          <div className="panel-heading"><div className="competition-mark" aria-hidden="true">{matches[0].competitionShort.slice(0, 1)}</div><div><p>{matches[0].competitionShort}</p><h2 id={`competition-${competition}`}>{competition}</h2></div><button aria-label={`${followedCompetitions.includes(competition) ? 'Stop following' : 'Follow'} ${competition}`} aria-pressed={followedCompetitions.includes(competition)} onClick={() => toggleFollow(competition)} type="button">{followedCompetitions.includes(competition) ? '✓' : '＋'}</button></div>
          <div className="round-label"><span>{matches[0].round}</span><span>Match centre</span></div>
          {matches.map((fixture) => <article className={`fixture-row ${fixture.status === 'live' ? 'is-live' : ''}`} key={fixture.id}><div className="team home-team"><span>{fixture.home}</span><i>{initials(fixture.home)}</i></div><div className="score-cell">{fixture.status === 'scheduled' ? <strong className="kickoff">{timeFormatter.format(new Date(fixture.kickoff))}</strong> : <strong>{fixture.homeScore}<b>–</b>{fixture.awayScore}</strong>}<span className={fixture.status === 'live' ? 'live-status' : ''}>{fixture.status === 'live' ? fixture.minute : fixture.status === 'finished' ? 'FT' : fixtureDate(fixture) === '2026-08-26' ? 'TODAY' : fixtureDate(fixture).slice(5).split('-').reverse().join('/')}</span></div><div className="team away-team"><i>{initials(fixture.away)}</i><span>{fixture.away}</span></div><button className="fixture-more" onClick={() => setSelectedFixture(fixture)} type="button" aria-label={`View ${fixture.home} versus ${fixture.away}`}>›</button></article>)}
        </section>)}
        <p className="data-note">{dataSource} · {fixtures.length.toLocaleString('en-GB')} fixtures · Imported {updateFormatter.format(new Date(dataUpdatedAt))}</p>
      </div><aside className="sidebar">
        <section className="agent-card"><div className="agent-topline"><span className="agent-badge">SITE TOOLS READY</span><i aria-hidden="true" /></div><h2>Just ask Matchday</h2><p>Your browser agent can cut through every league, date and fixture—without making you navigate them one by one.</p><ul><li>“When do Liverpool play next?”</li><li>“Only show English non-league football.”</li></ul><div className="tool-count"><strong>5</strong><span>structured tools available</span></div></section>
        <section className="filter-card"><h2>Match filter</h2>{(['all', 'live', 'upcoming'] as const).map((status) => <button className={search.status === status ? 'active' : ''} key={status} onClick={() => void navigate({ search: (previous) => ({ ...previous, status }) })} type="button"><span>{status === 'all' ? 'All matches' : status === 'live' ? 'Live now' : 'Upcoming'}</span><b>{status === 'all' ? scopedFixtures.length : scopedFixtures.filter((fixture) => status === 'live' ? fixture.status === 'live' : fixture.status === 'scheduled').length}</b></button>)}</section>
        <section className="table-card" id="tables"><div className="sidebar-heading"><div><span>TABLE</span><h2>Premier League</h2></div><span>Top five</span></div><div className="table-head"><span>POS</span><span>TEAM</span><span>GD</span><span>PTS</span></div>{standings.map(([team, points, difference], index) => <div className="standing-row" key={team}><b>{index + 1}</b><span><i>{initials(team)}</i>{team}</span><em>{difference > 0 ? '+' : ''}{difference}</em><strong>{points}</strong></div>)}</section>
      </aside></div>
      <section className="accessibility-story"><div className="story-number">01</div><div><p>WHY SITE TOOLS?</p><h2>The full fixture list stays. The obstacle course doesn’t.</h2></div><p>Matchday keeps the rich, familiar scores interface for browsing while giving agents a direct, structured path to the answer.</p></section>
    </main>
    {selectedFixture && <dialog aria-labelledby="fixture-dialog-title" className="fixture-dialog" onCancel={() => setSelectedFixture(undefined)} onClose={() => setSelectedFixture(undefined)} ref={fixtureDialog}>
      <div className="fixture-dialog-heading"><div><span>{selectedFixture.competitionShort} · {selectedFixture.competition}</span><h2 id="fixture-dialog-title">Match details</h2></div><button aria-label="Close match details" onClick={() => setSelectedFixture(undefined)} type="button">×</button></div>
      <div className="fixture-dialog-score"><div><i>{initials(selectedFixture.home)}</i><strong>{selectedFixture.home}</strong></div><p>{selectedFixture.status === 'scheduled' ? timeFormatter.format(new Date(selectedFixture.kickoff)) : `${selectedFixture.homeScore}–${selectedFixture.awayScore}`}<span>{selectedFixture.status === 'finished' ? 'Full time' : selectedFixture.status === 'live' ? selectedFixture.minute : longDateFormatter.format(parseDate(fixtureDate(selectedFixture)))}</span></p><div><i>{initials(selectedFixture.away)}</i><strong>{selectedFixture.away}</strong></div></div>
      <dl><div><dt>Competition</dt><dd>{selectedFixture.competition}</dd></div><div><dt>Round</dt><dd>{selectedFixture.round}</dd></div><div><dt>Venue</dt><dd>{selectedFixture.venue || 'To be confirmed'}</dd></div></dl>
    </dialog>}
    <footer><div className="brand footer-brand"><span className="brand-ball">M</span><span>MATCHDAY</span></div><p>An independent WebMCP accessibility demonstration. Not affiliated with the BBC or any football competition.</p><span>© 2026 Matchday</span></footer>
    <div className="sr-announcement" role="status" aria-live="polite">{announcement}</div>
  </div>;
}
