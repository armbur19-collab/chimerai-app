# Chimerai App

Built with ChimerAI Kickstart

```bash
npm install -g @chimerai/cli

chimerai create my-app --sqlite

```

## Features

- 🔐 Authentication with NextAuth
- 🔌 AI Model Provider Management
- 📝 Prompt Template System
- 💬 AI Chat Interface
- 🔍 RAG / Vector Store
- 🚨 Sentry Error Monitoring


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

## Learn More

- [ChimerAI Documentation](https://chimerai.dev)
- [Next.js Documentation](https://nextjs.org/docs)
- [Prisma Documentation](https://www.prisma.io/docs)

## License

MIT — this generated code is yours, no attribution required. See `LICENSE`.
