# Chimerai App

Built with ChimerAI Kickstart

```bash
npm install -g @chimerai/cli

chimerai create my-app --sqlite

```
## Admin Dashboard
<img width="1920" height="1040" alt="brave_VNCNsd9pZy" src="https://github.com/user-attachments/assets/0c4b8488-3bb4-4013-9d92-0de620dfdd3c" />

## Manage Any AI Model Provider
<img width="1920" height="1040" alt="brave_3QTGDP8mpd" src="https://github.com/user-attachments/assets/4da76f73-ce40-4c43-814d-c9b2f2b2d961" />

<img width="1920" height="1040" alt="brave_qvURfSoGe9" src="https://github.com/user-attachments/assets/c6a23561-0b7b-4ca7-ad3f-2d5237d79b7f" />

## Manage Your Own AI Prompt Templates
<img width="1920" height="1040" alt="brave_RFcj3EzIdK" src="https://github.com/user-attachments/assets/e3459a7f-d461-437a-a47f-fe9e42212b3b" />

# Chat Window - Free choice of model and prompt
<img width="1920" height="1040" alt="brave_nJdncqU83V" src="https://github.com/user-attachments/assets/acd33031-7760-41f0-9a9e-e90649e8ef7f" />

# Upload your documents to the vector database
<img width="1920" height="1040" alt="brave_dvIG2xOGLS" src="https://github.com/user-attachments/assets/b5ae0ccf-4d8e-4d95-8238-6c87a37d001d" />

# Query the vector database for information
<img width="1920" height="1040" alt="brave_xnMUu2xT70" src="https://github.com/user-attachments/assets/84a364ec-1141-4a4e-9539-88e2d6e69149" />

The command scaffolds a production-ready Next.js/TypeScript foundation for AI-powered applications — no Docker required, ready to run with SQLite as the database.

## Features

- 🔐 Authentication with NextAuth
- 🔌 AI Model Provider Management
- 📝 Prompt Template System
- 💬 AI Chat Interface
- 🔍 RAG / Vector Store
- 🚨 Sentry Error Monitoring


## Architecture

```mermaid
flowchart TB
    subgraph Client["Browser"]
        UI[Chat UI / Web App]
        Widget[Embeddable Chat Widget]
    end

    subgraph NextApp["Next.js App (TypeScript)"]
        Auth[NextAuth<br/>auth, sessions, OAuth]
        API[API Routes]
        Prompt[Prompt Template System]
        Webhooks[Webhook Dispatcher<br/>HMAC-signed]
    end

    subgraph AIService["AI Service (FastAPI + LiteLLM)"]
        Router[Chat / Completion Router]
        RAG[RAG Pipeline]
    end

    subgraph Data["Data Layer"]
        DB[(SQLite / PostgreSQL<br/>via Prisma)]
        Vector[(Vector Store)]
    end

    Providers[["Model Providers<br/>OpenAI · Anthropic · Gemini …"]]
    Sentry[Sentry<br/>Error Monitoring]
    External[["External Endpoints<br/>n8n · Zapier · Make.com · Slack"]]

    UI --> API
    Widget --> API
    API --> Auth
    API --> Prompt
    API --> Router
    Router --> RAG
    RAG --> Vector
    Router --> Providers
    API --> DB
    API --> Webhooks
    Webhooks -- events --> External
    Router -- agent tool calls --> External
    NextApp -.-> Sentry
    AIService -.-> Sentry
```

### The AI Service runs independently

The AI Service is not just an internal helper for the bundled web app — it's a standalone FastAPI service with its own REST API (default port `8002`), separate from the Next.js frontend and deployable on its own. Any of your other applications or scripts can call it directly over HTTP: chat completions, RAG queries, and the rest of the AI functionality are all exposed as regular REST endpoints, not tied to the Next.js UI in any way.

- **Auth:** requests are secured with a Bearer token (`INTERNAL_SERVICE_TOKEN`) — set it once and any authorized client can call in
- **Interactive API docs:** auto-generated OpenAPI/Swagger UI at `/docs` (and the raw schema at `/openapi.json`), so you can explore and test every endpoint without writing a client first
- **Health check:** `GET /health` for monitoring and orchestration

This makes it straightforward to reuse the same AI backend across multiple frontends, internal tools, or automation scripts — you're not limited to calling it through the generated web app.

The generated stack covers the core building blocks of a modern AI app:

- **Chat interface (`chat-ui`)** – streaming chat UI built on Next.js, ready to use out of the box
- **RAG pipeline (`rag`)** – Retrieval-Augmented Generation with vector search over your own knowledge sources
- **Model provider management (`model-providers`)** – unified integration for OpenAI, Anthropic, Gemini, and others, with easy provider switching
- **Prompt template system (`prompt-management`)** – versionable, reusable prompt templates
- **Authentication (`auth`)** – NextAuth-based login with sessions, email, and OAuth (GitHub, Google, Facebook)
- **Sentry monitoring (`sentry`)** – error tracking built in from the start
- **SQLite or PostgreSQL + Prisma** – choose the database that fits your use case
- **Docker-ready & self-hostable**

The generated code is entirely yours — MIT licensed, no attribution required.

## Getting Started

### Prerequisites

- Node.js 20+
- Docker Desktop
- npm

### Quick Start (Recommended)

**Windows:**
```bash
install.bat
```

**Linux/macOS:**
```bash
./install.sh
```

The install script will automatically:
- Install dependencies
- Start Docker containers
- Setup and seed the database
- Show you the next steps

### Manual Installation

If you prefer to run commands manually:

```bash
# Install dependencies
npm install

# Start Docker services
docker-compose up -d

# Setup database
npm run db:push
npm run db:seed

# Start development server
npm run dev
```

Open [http://localhost:3001](http://localhost:3001) in your browser.

### Default Admin Credentials

- Email: admin@example.com
- Password: admin123

⚠️ Change these in production!

### OAuth Setup

Email/password login works out of the box. GitHub/Google/Facebook sign-in need a registered
app on each provider's side before they'll work — until then, those buttons will fail. Documented
for all three regardless of which ones you picked during setup, since it's harmless to have the
instructions even for a provider you add later.

**GitHub**
1. Create an OAuth app at [https://github.com/settings/developers](https://github.com/settings/developers)
2. Set the callback/redirect URL to `{NEXTAUTH_URL}/api/auth/callback/github` (e.g. `http://localhost:3001/api/auth/callback/github` in dev)
3. Copy the client ID/secret into `.env` as `AUTH_GITHUB_ID` and `AUTH_GITHUB_SECRET`

**Google**
1. Create an OAuth app at [https://console.cloud.google.com/apis/credentials](https://console.cloud.google.com/apis/credentials)
2. Set the callback/redirect URL to `{NEXTAUTH_URL}/api/auth/callback/google` (e.g. `http://localhost:3001/api/auth/callback/google` in dev)
3. Copy the client ID/secret into `.env` as `AUTH_GOOGLE_ID` and `AUTH_GOOGLE_SECRET`

**Facebook**
1. Create an OAuth app at [https://developers.facebook.com/apps](https://developers.facebook.com/apps)
2. Set the callback/redirect URL to `{NEXTAUTH_URL}/api/auth/callback/facebook` (e.g. `http://localhost:3001/api/auth/callback/facebook` in dev)
3. Copy the client ID/secret into `.env` as `AUTH_FACEBOOK_ID` and `AUTH_FACEBOOK_SECRET`


## Available Scripts

- `pnpm dev` - Start development server
- `pnpm build` - Build for production
- `pnpm start` - Start production server
- `pnpm lint` - Run linter
- `pnpm db:push` - Push database schema
- `pnpm db:seed` - Seed database
- `pnpm db:studio` - Open Prisma Studio

## Tech Stack

- **Framework**: Next.js 15
- **Language**: TypeScript
- **Database**: PostgreSQL + Prisma
- **Auth**: NextAuth.js
- **Styling**: Tailwind CSS
- **UI Components**: Radix UI

## Project Structure

```
├── app/              # Next.js app directory
├── components/       # React components
├── lib/              # Utility functions
├── prisma/           # Database schema
└── public/           # Static assets
```


## Need more? ChimerAI CLI Enterprise & Enterprise Pro

The Free tier covers the essentials — for production, team-ready, or AI-heavy products, the ChimerAI CLI offers two paid license tiers with additional generated components (one-time payment, all future updates included):

<img width="1920" height="1040" alt="brave_I3EMcddhbq" src="https://github.com/user-attachments/assets/40e8ac9d-b7c6-49c4-b675-3a90d53114a6" />

## User Management
<img width="1920" height="1030" alt="msedge_yRyfFRt71F" src="https://github.com/user-attachments/assets/bc005df5-6da5-4b79-9d2d-64d5a389b5c2" />

## Role Management
<img width="1920" height="1030" alt="msedge_7FZxPdTl6g" src="https://github.com/user-attachments/assets/674bbd36-cf2c-4e1e-b6c6-ae26c538e582" />

## Complete Access Control over Users, Roles, Models, and Prompts
<img width="1920" height="1030" alt="brave_dJG8CwDbTB" src="https://github.com/user-attachments/assets/b57743a4-e0af-4d43-bf6e-d9ff4d419467" />

## Monitoring Model Usage
<img width="1920" height="1030" alt="brave_qztg82f6Rz" src="https://github.com/user-attachments/assets/797c49a6-fd26-4e7f-8e9f-213b3cd97d57" />

## Stripe Billing Integration
<img width="1920" height="1030" alt="brave_W1QYt09P8I" src="https://github.com/user-attachments/assets/dab84f9b-6433-4837-ba13-2a079cac86d5" />

## Two-Factor Authentication
<img width="1920" height="1030" alt="brave_BaRyAebAVY" src="https://github.com/user-attachments/assets/8d06caa1-c228-4814-9db4-a2cc248b8a9a" />

## Guardrails
<img width="1920" height="1030" alt="brave_tpmesrlowf" src="https://github.com/user-attachments/assets/d346120a-c390-4537-8f5e-05f7fdeca1c5" />

## AI Tools
<img width="1920" height="1030" alt="brave_HYUQtRDxwU" src="https://github.com/user-attachments/assets/7bf69ef5-377c-40bb-a9c4-7ec777206189" />

## Code Execution
<img width="1920" height="1030" alt="brave_3eNIe00O00" src="https://github.com/user-attachments/assets/edab6adc-a1df-4a48-97de-70e63e6f13a9" />

## Image AI Analysis
<img width="1920" height="1030" alt="brave_o8mFB5dIju" src="https://github.com/user-attachments/assets/0952e039-ea9e-4fe6-ad2f-8c2b82d9e02a" />

## Integrations (Google Sheets, Airtable, Webhooks)
<img width="1920" height="1030" alt="brave_414zEs3CSc" src="https://github.com/user-attachments/assets/48363e8f-3433-47ad-a9dd-798493ddffc8" />

#### Automation integration (n8n, Zapier, Make.com)

Enterprise Pro's webhook stack ships with two complementary ways to connect your app to automation platforms like **n8n**. The outbound webhook system lets you register any endpoint URL in the dashboard and receive HMAC-signed HTTP calls whenever a chosen event fires (`user.created`, `billing.payment_succeeded`, your own custom events, or `*` for everything) — point it at an n8n Webhook Trigger node and workflows kick off automatically. On top of that, the AI Agent Webhook Tools give the AI agent itself a callable tool (`call_n8n_webhook`, plus `call_zapier_webhook` and a generic `call_webhook`) so it can decide at inference time to trigger an n8n workflow with a relevant payload — no separate event has to fire first.


### Enterprise ($349, one-time)

Everything in Free, plus:

- **RBAC** – role-based access control
- **Billing** – Stripe / Lemon Squeezy integration for subscriptions & payments
- **Admin dashboard** including **users table** and **roles table** (CRUD)
- **GDPR tools** – consent management & data export
- **MFA** – multi-factor authentication (TOTP)
- **Audit log** for compliance requirements
- **Analytics** – API usage statistics
- 3 device activations, priority support (48h)

### Enterprise Pro ($699, one-time)

Everything in Enterprise, plus:

- **Webhooks** – event system with HMAC signing
- **Theming** – dynamic theme engine for white-label products
- **Guardrails** – PII detection, toxicity and prompt-injection filtering
- **AI tools** – web search, OCR, vision, and more
- 5 device activations, priority support (24h)
  
## Learn More

📺 **Video tutorials:**

- [ChimerAI Presentation](https://www.youtube.com/watch?v=hbfbY2adfcA) — a walk through the core features of ChimerAI Kickstart
- [RAG Pipeline](https://www.youtube.com/watch?v=n1ut5dUlIdo) — document ingestion, vector search, and grounded answers with citations
- [RBAC & User Management](https://www.youtube.com/watch?v=JSOX8IO4JMs) — roles, permissions, and access control
- [AI Chat](https://www.youtube.com/watch?v=skhTEHIoKH8) — streaming chat interface with multi-model support
- [Airtable Integration](https://www.youtube.com/watch?v=oUZxpxxtu-I) — read, create, update, and delete Airtable records
- [Stripe Billing Integration](https://www.youtube.com/watch?v=UOsjW7sPHJg) — API keys, webhooks, subscription and one-time payment checkout

📚 **Documentation:**
- [ChimerAI Documentation](https://chimerai.dev)
- [Next.js Documentation](https://nextjs.org/docs)
- [Prisma Documentation](https://www.prisma.io/docs)

## License

MIT — this generated code is yours, no attribution required. See `LICENSE`.
