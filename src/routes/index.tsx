import { createFileRoute } from '@tanstack/react-router';
import { Scoreboard } from '../components/scoreboard';
type ScoresSearch = { date: string; team?: string; status: 'all' | 'live' | 'upcoming'; countries?: string; competitions?: string };
function isIsoDate(value: unknown): value is string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  return new Date(`${value}T12:00:00Z`).toISOString().slice(0, 10) === value;
}
export const Route = createFileRoute('/')({
  validateSearch: (search: Record<string, unknown>): ScoresSearch => ({ date: isIsoDate(search.date) ? search.date : '2026-08-26', team: typeof search.team === 'string' && search.team ? search.team : undefined, status: search.status === 'live' || search.status === 'upcoming' ? search.status : 'all', countries: typeof search.countries === 'string' && search.countries ? search.countries : undefined, competitions: typeof search.competitions === 'string' && search.competitions ? search.competitions : undefined }),
  component: MatchdayHome,
});
function MatchdayHome() { return <Scoreboard search={Route.useSearch()} />; }
