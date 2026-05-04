# Contributing to SprintiQ

Thanks for your interest in contributing. This document covers the basics for getting set up locally and submitting changes.

## Local setup

See [SELF_HOSTING.md](./SELF_HOSTING.md) for environment setup. The same instructions apply for local development.

## Branching and pull requests

- Fork the repository
- Create a branch from `main`
- Open a pull request against `main`

External pull requests are evaluated case-by-case. For larger changes, open an issue first to discuss the approach.

## Code style

- TypeScript strict mode
- ESLint (run `npm run lint` before committing)
- Type-check passes (run `npm run typecheck`)
- No `console.log` in production code paths
- No `as any` type assertions
- Tree-shakeable imports (`import { X }` not `import * as X`)

## Commits

Conventional commit prefixes: `feat:`, `fix:`, `chore:`, `refactor:`, `docs:`, `test:`.

## Tests

- Unit and integration tests: `npm run test` (Vitest)
- End-to-end tests: `npm run test:e2e` (Playwright)
- Full suite: `npm run test:all`
- Coverage: `npm run test:coverage`

The pre-commit hook runs typecheck and lint via `npm run precommit`.

## Reporting bugs

Open a GitHub issue at https://github.com/SprintiQ-Incorporated/sprintiq/issues.

## Reporting security issues

Do not open public issues for security vulnerabilities. See [SECURITY.md](./SECURITY.md).

## License

By contributing, you agree that your contributions will be licensed under the Apache 2.0 License.
