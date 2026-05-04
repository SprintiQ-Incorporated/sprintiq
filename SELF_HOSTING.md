# Self-hosting SprintiQ

This guide walks through setting up SprintiQ on your own infrastructure.

## Prerequisites

- Node.js 18 or later
- npm (latest)
- A Supabase project (free tier works for personal use, paid tier recommended for any sustained use)
- An Anthropic API key with access to Claude Sonnet 4.6 (and optionally Claude Opus for complex tasks)
- A Voyage AI API key (used for embeddings powering RAG retrieval)
- Optional: a DeepSeek API key for cheaper non-critical AI calls
- A hosting target for production (Vercel, Fly.io, Render, or any Node-capable host)

## 1. Supabase setup

1. Create a new Supabase project at https://supabase.com.
2. From **Settings → API**, note your project URL and anon key.
3. From **Settings → API → service_role**, note your service role key. Keep this secret — it bypasses Row-Level Security and must never be exposed to the client.
4. Enable the `vector` extension under **Database → Extensions** (search for "vector"). Embeddings won't work without it.
5. Apply the migrations:

```bash
git clone https://github.com/SprintiQ-Incorporated/sprintiq.git
cd sprintiq
npx supabase link --project-ref <YOUR_PROJECT_REF>
npx supabase db push
```

## 2. Environment variables

Copy `env.example` to `.env.local` and fill in the values:

| Variable | Required | Purpose |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Yes | Your Supabase project URL (e.g. `https://abc123.supabase.co`) |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Yes | Supabase anon key — safe to expose to the browser |
| `SUPABASE_SERVICE_ROLE_KEY` | Yes | Supabase service role key — server-side only, never expose |
| `NEXT_PUBLIC_APP_URL` | Yes | Public URL where the app will be reachable (e.g. `https://your-domain.com`) |
| `CLAUDE_API_KEY` | Yes (or `ANTHROPIC_API_KEY`) | Anthropic API key for Claude calls |
| `VOYAGE_API_KEY` | Yes | Voyage AI API key for embeddings |
| `DEEPSEEK_API_KEY` | Optional | DeepSeek API key for cheaper non-critical AI calls; falls back to Claude when unset |
| `CLAUDE_MODEL` | Optional | Default Claude model override (default: `claude-sonnet-4-6`) |
| `DEEPSEEK_MODEL` | Optional | Default DeepSeek model override (default: `deepseek-chat`) |

The `SUPABASE_URL` and `SUPABASE_ANON_KEY` entries at the top of `env.example` are aliases consumed by Supabase tooling; the canonical values for application code are the `NEXT_PUBLIC_SUPABASE_*` versions.

## 3. Local development

```bash
npm install
npm run dev
```

The app will be available at http://localhost:3000.

Useful development scripts:

```bash
npm run typecheck    # TypeScript type-checking
npm run lint         # ESLint
npm run test         # Vitest unit tests
npm run test:e2e     # Playwright end-to-end tests
```

## 4. Production deployment

### Vercel (recommended)

1. Push your fork to GitHub.
2. Import the repository into Vercel.
3. Configure environment variables (same set as `.env.local`).
4. Set `NEXT_PUBLIC_APP_URL` to your production URL (e.g. `https://your-domain.com`).
5. Deploy.

### Other hosts

SprintiQ is a standard Next.js 15 App Router application. Any host that supports Next.js 15 with Node.js 18 or later will work.

## 5. CLI setup

The SprintiQ CLI provides bidirectional sync with Claude Code and Cursor.

```bash
cd packages/cli
npm install
npm run build
npm link
```

Then from any project directory:

```bash
export SPRINTIQ_API_URL=https://your-deployed-url.com
sprintiq watch
```

`sprintiq watch` starts a local bridge server that receives "Code with Claude" launch requests from your deployed SprintiQ web UI and spawns Claude Code (or Cursor) with the task context injected.

## 6. First-run verification

1. Visit your deployed URL.
2. Sign up for an account.
3. Create a workspace.
4. Generate your first user story.
5. Run `sprintiq watch` from a project directory and confirm the connection is established.

## Common issues

### Embeddings fail with "function does not exist"

The `vector` (pgvector) extension is not enabled in your Supabase project. See step 1.4.

### Auth callback redirects to localhost in production

`NEXT_PUBLIC_APP_URL` is unset or pointing at localhost. Check your production environment variables.

### Claude API calls return 401

`CLAUDE_API_KEY` (or `ANTHROPIC_API_KEY`) is missing or invalid. Verify in the Anthropic console.

### CLI can't reach the server

`SPRINTIQ_API_URL` is unset or wrong. Set it to your deployed URL with no trailing slash.
