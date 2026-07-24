# chimerai-app

> This repo is the **unmodified output** of the ChimerAI CLI's free tier — generated with:
>
> ```bash
> npx chimerai create chimerai-app --sqlite -y
> cd chimerai-app
> npx chimerai add chat-ui
> npx chimerai add chat-widget
> npx chimerai add rag
> npx chimerai add sentry
> ```
>
> It is kept in sync with the current CLI release. Nothing here was hand-edited.

## What's included (free tier)

- 🔐 **Authentication** — NextAuth.js, credentials + OAuth-ready
- 🔌 **AI Model Provider Management** — OpenAI, Anthropic, Ollama, hot-swappable
- 📝 **Prompt Template Management**
- 💬 **AI Chat Interface** — streaming (SSE), markdown rendering
- 🔗 **Embeddable Chat Widget** — CORS + API-key auth, drop into any external site
- 🔍 **RAG / Vector Store** — upload documents, ask questions, FAISS-backed
- 🚨 **Sentry Error Monitoring**

Not included here (Enterprise / Enterprise Pro — see [chimerai.dev/pricing](https://chimerai.dev/pricing)):
RBAC, Billing (Stripe), Admin Dashboard, GDPR tooling, MFA, Audit Log, Analytics, Guardrails,
AI Tools, third-party Integrations.

## Getting Started

### Prerequisites

- Node.js 20+
- pnpm

### Quick Start

```bash
pnpm install
pnpm db:push
pnpm db:seed
pnpm dev
```

Open [http://localhost:3001](http://localhost:3001).

### Default Admin Credentials

- Email: `admin@example.com`
- Password: `admin123`

⚠️ Change these before deploying anywhere reachable from the internet.

## Tech Stack

- **Framework**: Next.js 15 (App Router)
- **Language**: TypeScript
- **Database**: SQLite + Prisma (swap to Postgres by dropping `--sqlite`)
- **Auth**: NextAuth.js
- **Styling**: Tailwind CSS
- **Error Monitoring**: Sentry

## Project Structure

```
├── app/              # Next.js app directory
├── components/       # React components
├── lib/              # Utility functions
├── services/         # Python AI service (RAG document processing)
├── prisma/           # Database schema
└── public/           # Static assets, embeddable widget
```

## Get the full CLI

```bash
npx chimerai create my-app
```

[ChimerAI Documentation](https://chimerai.dev) · [Pricing](https://chimerai.dev/pricing)

## License

MIT — this generated code is yours, no attribution required. See `LICENSE`.
