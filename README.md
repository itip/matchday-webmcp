# Matchday WebMCP

An accessible football scores and fixtures experience built for people and AI agents.

Matchday demonstrates how [WebMCP](https://webmachinelearning.github.io/webmcp/) can give ChatGPT a direct, structured route to football information without forcing a user or an agent to navigate a long, link-heavy fixture page one item at a time.

**[Open the public Matchday demo](https://matchday-webmcp.ian-tipton.workers.dev/)**

The project was inspired by a blind football supporter who finds conventional scores and fixtures pages cumbersome with a screen reader—particularly when looking for lower-league clubs such as AFC Telford United.

## What Matchday does

- Presents scores and fixtures across 32 competitions and 18 countries.
- Searches clubs and competitions with keyboard-accessible autocomplete.
- Filters by date, status, country, competition and followed favourites.
- Stores followed teams, competitions and filter preferences on the device.
- Exposes five page-level WebMCP tools for faster, more reliable agent interaction.
- Includes lower-league coverage that can be difficult to find through voice assistants.

## WebMCP tools

| Tool | Purpose |
| --- | --- |
| `search_football_teams` | Resolve full names, partial names and common aliases. |
| `get_team_fixtures` | Retrieve a team's fixtures and results for a date range. |
| `show_team_fixtures` | Change the visible page to a selected team's fixtures. |
| `get_match_filter_options` | Discover available countries and competitions. |
| `set_match_filters` | Change the visible date, status, country, competition and Following-only filters. |

Try prompts such as:

- “When do Liverpool play next?”
- “What was AFC Telford United's latest result?”
- “Show Scottish competitions on 30 August.”
- “Show matches involving teams I follow.”

## How it works

```text
Sportmonks Football API
          │
          ▼
  import/audit scripts
          │
          ▼
 local fixture snapshot ──► TanStack Start UI
                                  │
                                  ▼
                           WebMCP site tools
                                  │
                                  ▼
                         ChatGPT built-in browser
```

The checked-in snapshot makes the competition demonstration deterministic and keeps the deployed site fast. The import script can also prepare SQL for a future Cloudflare D1-backed deployment.

## Technology

- TanStack Start, TanStack Router and React 19
- TypeScript and Vite
- Cloudflare Workers tooling
- Drizzle ORM with a Cloudflare D1-compatible schema
- WebMCP through `document.modelContext.registerTool()`
- Sportmonks Football API v3 data

## Run locally

Requirements:

- Node.js 22.13 or later
- npm

```bash
git clone https://github.com/itip/matchday-webmcp.git
cd matchday-webmcp
npm install
npm run dev
```

The application uses the included fixture snapshot, so an API token is not required to run it.

Useful commands:

```bash
npm run dev       # start the development server
npm run build     # create and type-check the production build
npm run preview   # preview a production build locally
npm run lint      # run the TypeScript checks
```

## Refresh the football data

Refreshing data is optional and requires a Sportmonks API subscription with access to the desired competitions.

1. Copy `.env.example` to `.env.local`.
2. Add your token as `SPORTMONKS_API_TOKEN`.
3. Audit the competitions available to the subscription.
4. Import a bounded fixture range.

```bash
npm run data:audit
npm run data:import -- --from=2026-08-01 --to=2026-09-30
```

Never commit `.env.local` or an API token. Generated audit reports and D1 import files are written to the ignored `work/` directory.

## Deploy to Cloudflare

The repository includes Cloudflare-compatible Vite and Worker configuration. Once authenticated with Cloudflare:

```bash
npm run deploy
```

For the first public deployment, connect this GitHub repository in Cloudflare or deploy with Wrangler. The current application reads its checked-in fixture snapshot and does not require D1 or any production secrets. A D1 binding can be added later when the application is changed to query the prepared database schema at runtime.

## Accessibility

Matchday is designed around semantic headings and landmarks, labelled controls, keyboard-operable autocomplete and filters, a skip link, persistent high-contrast focus indicators, focus-managed modal dialogs, announced state changes and a screen-reader-readable standings table.

The public deployment was audited on 30 August 2026 for accessible names, landmark and heading structure, ARIA references and state, keyboard focus management, modal behaviour, text contrast and WebMCP operation. Accessibility should still be tested with real users and their preferred assistive technology; automated and developer checks are not a substitute for that experience.

## Data and trademarks

Fixture data is sourced from the Sportmonks Football API v3 and is used for this demonstration subject to the applicable Sportmonks plan and terms. Team and competition names may be trademarks of their respective owners.

Matchday is an independent WebMCP accessibility demonstration. It is not affiliated with the BBC, OpenAI, Sportmonks, or any football club or competition.

## Licence

The application source code is available under the [MIT Licence](LICENSE). The licence does not grant rights to third-party fixture data, names or trademarks.
