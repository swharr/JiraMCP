# Repository Guidelines

## Project Structure & Module Organization
- Source: `src/` (core entry `index.ts`, Jira clients, `notifiers/`, `copilot-*.ts`).
- Tests: `src/__tests__/` with `*.test.ts` (e.g., `rate-limiter.test.ts`).
- Build output: `dist/` (Node ESM, `type: module`).
- Docs: `docs/` (setup, deployment, security).
- Config: `.eslintrc.json`, `tsconfig.json`, `jest.config.js`, `.env.example`, `.env.copilot.example`.

## Build, Test, and Development Commands
- `npm run build`: Compile TypeScript to `dist/`.
- `npm start`: Run server from `dist/index.js`.
- `npm run dev`: Watch-run `dist/index.js` (rebuild between edits with `npm run build`).
- `npm run start:copilot`: Start Copilot entry (`dist/copilot-main.js`).
- `npm run dev:copilot`: Build once, then watch-run Copilot entry.
- `npm test` | `npm run test:watch` | `npm run test:coverage`: Jest tests and coverage.
- `npm run lint` | `npm run typecheck`: ESLint and TS diagnostics.

## Coding Style & Naming Conventions
- Language: TypeScript (strict, NodeNext ESM). Import paths resolve as ESM; prefer explicit `.js` in relative imports where applicable.
- Lint rules: explicit return types; no `any`, no unused vars, no non-null assertions; disallow `console` except `console.warn`/`console.error`.
- Formatting: 2-space indentation; camelCase for functions/vars, PascalCase for classes; file modules kebab-case (e.g., `health-service.ts`).

## Testing Guidelines
- Framework: Jest with `ts-jest` ESM preset.
- Location/pattern: `src/__tests__/**/*.test.ts`.
- Coverage: thresholds enforced (branches 70, lines/functions/statements 80). Aim to keep or raise.
- Run: `npm test` locally; use `npm run test:coverage` before PRs.

## Commit & Pull Request Guidelines
- Commits: short, imperative subject; include scope when helpful (e.g., `feat(notifiers): add Teams severity colors`).
- PRs must include: clear description, linked issue(s), tests for new/changed logic, and docs updates (README/docs or `.env.example`) when config/behavior changes. Add screenshots for Slack/Teams output when relevant.

## Security & Configuration Tips
- Never commit secrets. Use `.env`; keep `.env.example` in sync with new variables.
- Validate setup with `node test-connection.js` before pushing.
- Prefer project whitelisting and rate limiting via envs (`JIRA_ALLOWED_PROJECTS`, `RATE_LIMIT_*`).

