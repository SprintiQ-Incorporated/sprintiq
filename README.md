# SprintiQ

> The product brain for Claude Code.

SprintiQ Turbo is the planning layer that sits above Claude Code. While Claude Code writes the code, SprintiQ manages what gets built, when, and why — sprint planning, story generation, velocity tracking, and bidirectional sync with your AI coding agent. It's not a project management tool. It's the operating system for Claude Code workflows.

This repository is provided as open source under the Apache 2.0 license. You can self-host, fork, and extend it freely.

---

## What's in this repo

- Bidirectional sync with Claude Code via the SprintiQ CLI (`sprintiq watch`)
- AI-powered user story generation trained on agile anti-patterns (TAWOS)
- Sprint planning, capacity management, and velocity tracking
- Persona-aware story generation
- Single-user, self-hostable — your data, your infrastructure, your Claude API key

---

## Quick start (self-hosted)

See [SELF_HOSTING.md](./SELF_HOSTING.md) for the complete deployment guide.

### Prerequisites

- Node.js 18 or later
- A Supabase project (free tier sufficient for personal use)
- An Anthropic API key (Claude Sonnet 4.6 + Opus)
- A Voyage AI API key (for embeddings)

### Setup

```bash
git clone https://github.com/SprintiQ-Incorporated/sprintiq.git
cd sprintiq
cp env.example .env.local
# Fill in the required env vars — see SELF_HOSTING.md
npm install
npx supabase db push
npm run dev
```

### Storage Buckets

After running `supabase db push`, create two storage buckets in your Supabase dashboard
(Storage → New bucket):

| Bucket name | Public | Purpose |
|-------------|--------|---------|
| `avatars` | Yes | User profile photos |
| `images` | No | Task and workspace image uploads |

### CLI

```bash
cd packages/cli
npm install
npm run build
npm link
sprintiq watch
```

---

## Architecture

Built on Next.js App Router, Supabase (auth, Postgres, pgvector), Claude Sonnet 4.6 for generation, and Voyage AI for embeddings. The CLI (`sprintiq watch`) creates a live bridge between Claude Code sessions and your sprint board. RLS enforces single-owner workspace isolation at the database layer.

Top-level layout:

```
app/        Next.js App Router routes (pages + API)
components/ React components
contexts/   React context providers
hooks/      Custom React hooks
lib/        Server-side utilities, services, AI providers
packages/   @sprintiq/cli — CLI bridge for AI coding agents
public/     Static assets
scripts/    Operational scripts (migrations, audits, training)
supabase/   Database migrations
types/      Shared TypeScript types
e2e/        Playwright end-to-end tests
__tests__/  Vitest unit and integration tests
```

See [CLAUDE.md](./CLAUDE.md) for an AI-agent-oriented project briefing.

---

## Development

```bash
npm run dev          # Start the Next.js dev server
npm run typecheck    # Run TypeScript type-checking
npm run lint         # Run ESLint
npm run test         # Run Vitest unit tests
npm run test:e2e     # Run Playwright end-to-end tests
```

---

## Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md). External pull requests are evaluated case-by-case; bug reports and security disclosures are always welcome.

## Security

See [SECURITY.md](./SECURITY.md) for responsible disclosure.

## License

Apache 2.0 — see [LICENSE](./LICENSE).

---

SprintiQ Turbo is open source under Apache 2.0. Self-host it, fork it, build on it. The SaaS lives at [sprintiq.ai](https://sprintiq.ai).
