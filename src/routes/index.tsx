import { createFileRoute } from '@tanstack/react-router';
import { Scoreboard } from '../components/scoreboard';
type ScoresSearch = { date: string; team?: string; status: 'all' | 'live' | 'upcoming' };
export const Route = createFileRoute('/')({
  validateSearch: (search: Record<string, unknown>): ScoresSearch => ({ date: typeof search.date === 'string' ? search.date : '2026-08-26', team: typeof search.team === 'string' && search.team ? search.team : undefined, status: search.status === 'live' || search.status === 'upcoming' ? search.status : 'all' }),
  component: MatchdayHome,
});
function MatchdayHome() { return <Scoreboard search={Route.useSearch()} />; }
