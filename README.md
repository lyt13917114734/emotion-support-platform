# Human-AI Emotion Support Platform

An independent portfolio edition of a human-AI emotional support research platform.

## Features

- Participant onboarding and reading acknowledgement
- Counterbalanced assignment, practice and support tasks
- AI assistance cards, response editing and repeated measurements
- Progress tracking, browser session recovery and structured exports

## Local Development

Requires Node.js 22.13+ and pnpm.

```sh
pnpm install --frozen-lockfile
pnpm dev
```

Open the address printed by the server. Use fictitious participant details. The portfolio entry runs in local demo mode and stores demo responses in the browser.

```sh
pnpm typecheck
pnpm test
pnpm build
```

## Technology

React 19, TypeScript, Vinext, Vite, Tailwind CSS, Cloudflare Workers, D1, Drizzle ORM and Lucide.

## Scope

This copy excludes collected participant databases, exports, passwords, original consent attachments and original Git history. It is not an active study and offers no participation payment or clinical service. The original research platform remains separate.
