# Paracetamol Haze Web

Open-source web tools for Twitch streamers, small creator communities, and
interactive online events.

Paracetamol Haze Web is a Next.js application that collects several community
tools in one deployable project: real-time games, Twitch overlays, viewer
interaction screens, movie quizzes, and a standalone Cloudflare Worker backend
for Lotomal.

The project is maintained as a public, self-hostable codebase so small streamer
communities can run their own lightweight games and overlays without depending
on closed, paid dashboards.

## Public URLs

- Main site: https://paracetamolhaze.ru
- Lotomal: https://lotomal.paracetamolhaze.ru
- Repository: https://github.com/almazazamatov22-blip/paracetamolhazeweb

## What Is Included

| Area | Path | Purpose |
| --- | --- | --- |
| Main hub | `/` | Project launcher for Paracetamol Haze community tools. |
| Roz | `/roz` | Twitch chat giveaways and reward-driven interactions. |
| Check | `/check` | Twitch subscription and follower lookup utilities. |
| Lotomal | `/lotomal` and `workers/lotomal` | Multiplayer lotto-style game with host controls, overlays, and a Cloudflare Worker backend. |
| Overlays | `/overlays` | Twitch overlay dashboard, roll screens, slot screens, and sound assets. |
| 67 | `/67` | Fast reaction game with profile and leaderboard support. |
| Kinokadr | `/kinokadr` | Guess-the-movie-by-frame game. |
| Kinoquiz | `/kinoquiz` | Interactive movie quiz for viewers. |
| Emojino | `/emojino` | Guess-the-movie-by-emoji game. |
| Poker | `/poker` and `/poker_pixel` | Poker table experiments and card assets. |
| Detective | `/detective` | Narrative puzzle/event pages for community games. |

## Why This Is Open Source

The project is aimed at real streamer and viewer workflows:

- Give small Twitch communities free, inspectable tools for events and games.
- Make overlay logic, auth flows, and deployment setup visible instead of hidden
  inside a closed service.
- Keep production fixes, UI changes, API routes, and Cloudflare Worker logic in
  a public repository that others can learn from or adapt.
- Provide a practical playground for maintaining Next.js, Twitch OAuth,
  Supabase, Cloudflare Workers, and real-time community features together.

## Maintainer Workflows

This repository is actively maintained by the project owner. Typical maintenance
work includes:

- fixing production regressions in Twitch authentication and callback routing;
- improving mobile and overlay layouts;
- maintaining Supabase-backed API routes and profile/stat storage;
- deploying the Next.js app and the Lotomal Cloudflare Worker;
- reviewing security-sensitive code around auth, uploads, webhooks, and service
  keys;
- refactoring older static pages into maintainable application routes.

AI coding tools such as Codex are useful here for review, debugging,
test-writing, migration work, deployment checks, and security review of
maintainer-owned code.

## Tech Stack

- Next.js with the App Router
- React
- TypeScript
- Tailwind CSS
- Supabase
- Twitch OAuth and Twitch API integrations
- Cloudflare Workers and Durable Objects for Lotomal
- Vercel deployment support

## Getting Started

Install dependencies:

```bash
npm install
```

Create local environment variables:

```bash
cp .env.example .env.local
```

Fill in only the services you need. The main variables are documented in
`.env.example`.

Run the Next.js app:

```bash
npm run dev
```

Build the app:

```bash
npm run build
```

## Lotomal Worker

The Lotomal backend can run separately as a Cloudflare Worker:

```bash
npm run dev:loto
```

Deploy the Worker:

```bash
npm run deploy:loto
```

More Worker-specific notes live in `workers/lotomal/README.md`.

## Environment Variables

The project can use several external services depending on which module is
enabled:

- Twitch app credentials for OAuth and Twitch API access.
- Supabase URL, anon key, and service role key for database-backed features.
- TMDB API token for movie-related tools.
- Vercel KV or compatible KV settings for legacy routes.
- Cloudflare credentials for Worker deployment.

Never commit real `.env` files or service tokens.

## Project Status

This is an active community project. Some modules are production tools, some are
experiments, and some pages are event-specific. The codebase favors practical
shipping for real streamer workflows, while gradually moving toward clearer
documentation, safer deployment, and easier self-hosting.

Issues and pull requests are welcome when they improve reliability, security,
documentation, or self-hosting.

## License

This project is licensed under the MIT License. See [LICENSE](LICENSE).
