
# Chimerai App

Built with ChimerAI Kickstart

```bash
npm install -g @chimerai/cli

chimerai create my-app --sqlite

```
# Admin Dashboard
<img width="1920" height="1040" alt="brave_VNCNsd9pZy" src="https://github.com/user-attachments/assets/0c4b8488-3bb4-4013-9d92-0de620dfdd3c" />

# Manage Any AI Model Provider
<img width="1920" height="1040" alt="brave_3QTGDP8mpd" src="https://github.com/user-attachments/assets/4da76f73-ce40-4c43-814d-c9b2f2b2d961" />

<img width="1920" height="1040" alt="brave_qvURfSoGe9" src="https://github.com/user-attachments/assets/c6a23561-0b7b-4ca7-ad3f-2d5237d79b7f" />

# Manage Your Own AI Prompt Templates
<img width="1920" height="1040" alt="brave_RFcj3EzIdK" src="https://github.com/user-attachments/assets/e3459a7f-d461-437a-a47f-fe9e42212b3b" />


<img width="1920" height="1040" alt="brave_nJdncqU83V" src="https://github.com/user-attachments/assets/acd33031-7760-41f0-9a9e-e90649e8ef7f" />
<img width="1920" height="1040" alt="brave_dvIG2xOGLS" src="https://github.com/user-attachments/assets/b5ae0ccf-4d8e-4d95-8238-6c87a37d001d" />
<img width="1920" height="1040" alt="brave_xnMUu2xT70" src="https://github.com/user-attachments/assets/84a364ec-1141-4a4e-9539-88e2d6e69149" />

The command scaffolds a production-ready Next.js/TypeScript foundation for AI-powered applications — no Docker required, ready to run with SQLite as the database.

## Features

- 🔐 Authentication with NextAuth
- 🔌 AI Model Provider Management
- 📝 Prompt Template System
- 💬 AI Chat Interface
- 🔍 RAG / Vector Store
- 🚨 Sentry Error Monitoring


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
