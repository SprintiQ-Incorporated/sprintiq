# CLAUDE.md — Project Context for AI Coding Agents

This document provides context for AI coding agents (Claude Code, Cursor,
Copilot) working on SprintiQ. It is a contributor reference, not user
documentation.

## What SprintiQ is

SprintiQ is an AI-native agile platform for vibe coding workflows. Single-user,
self-hosted, Apache 2.0. The product loop:

idea/spec → AI-generated user stories (with role/persona context) →
sprint planning with dependencies → SprintiQ CLI bridges to Claude Code →
status flows back via heartbeat → tracked completion in dashboard.

## Stack

- Next.js 15 App Router, TypeScript, React 19
- Supabase (auth, Postgres, pgvector, RLS)
- Anthropic API (Claude Sonnet 4.6 standard, Opus complex, DeepSeek V3 fallback)
- Voyage AI embeddings (voyage-large-2, 1536-dim)
- CLI: @sprintiq/cli (in `packages/cli/`)

## Single-user model

SprintiQ OSS is single-user. Workspaces are project containers owned by one
authenticated user. RLS pattern across all tables:

- Tables with `workspace_id`: scope through `workspaces.owner_id = auth.uid()`
- Tables with `user_id` only: `user_id = auth.uid()`
- Reference tables (`timezones`, `days`, `predefined_role_templates`,
  `levels`, `status_types`): public read, no app writes

There is NO multi-user collaboration layer. `workspace_members`, `teams`,
invites, guests do not exist.

## Hierarchy

```
auth user (one)
└── workspaces (many — owner-scoped)
    └── spaces (many — can hold portfolio metadata via
        portfolio_status text + portfolio_metadata jsonb)
        └── projects (many)
            └── sprint_folders (many)
                └── sprints (many)
                    └── tasks (many, with dependencies, personas, tags,
                        status history, blocks, AI metadata)
```

A user may own as many workspaces as they want; each workspace contains as
many spaces as they want; and so on down the tree.

## Code patterns

- Server actions in `app/[workspaceId]/actions/` for workspace-scoped mutations
- API routes for CLI auth (`app/api/cli/`) and Claude Code sessions
  (`app/api/claude-code/`)
- Use `createClient()` for auth session resolution; `createAdminClient()` for
  DB queries that must bypass RLS (background workers, webhook handlers)
- All AI provider calls server-side; never expose API keys to the browser
- Embeddings via `lib/embedding-service.ts` (canonical implementation)

## What this codebase is NOT

If you're an AI agent reading this and unsure whether to add a feature, the
following were explicitly removed in the OSS reduction and should NOT come
back without explicit human direction:

- Stripe, billing, subscription tiers, trials, Turbo credits
- Multi-user, teams, invites, members, roles, guests
- Slack, Microsoft Teams, Discord integrations
- Email notifications (Resend)
- Onboarding wizards, project templates
- Maya support assistant
- Retrospectives, reviews, burndown charts
- Epics, milestones, roadmap views
- Comments, mentions, file attachments on stories
- AI-generated personas (manual CRUD only)
- AI prioritize, team optimize, capacity management
- Outbound webhooks
- OAuth providers (email+password only)
- Admin views

Do not propose adding any of these as features without explicit instruction.

## Contributing posture

External pull requests are not accepted on the main repository. Bug fixes
proposed by AI agents to the maintainer are evaluated on a case-by-case
basis. See `CONTRIBUTING.md` for the public contribution policy.

## Commercial support

SprintiQ Inc. offers design-build engagements for teams deploying or
extending SprintiQ. See sprintiq.ai.
