// @chimerai component=AuthLib version=2.0-free
import NextAuth from 'next-auth';
import { PrismaAdapter } from '@auth/prisma-adapter';
import { prisma } from './prisma';
import Credentials from 'next-auth/providers/credentials';
import bcrypt from 'bcryptjs';
import { logAuditAction } from './audit';
// Inline helper — no dependency on lib/permissions.ts (upgrade to Enterprise to enable RBAC)
const parsePermissions = (p: string | string[] | null | undefined): string[] => {
  if (!p) return [];
  if (Array.isArray(p)) return p;
  try { return JSON.parse(String(p)); } catch { return String(p).split(',').filter(Boolean); }
};

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: PrismaAdapter(prisma) as any,
  providers: [
    Credentials({
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          return null;
        }

        // Query user — try with RBAC roles first, fall back to plain user if roles relation doesn't exist
        let user: any = null;
        try {
          user = await (prisma.user as any).findUnique({
            where: { email: credentials.email as string },
            include: {
              roles: { select: { role: { select: { id: true, name: true, permissions: true } } } },
            },
          });
        } catch {
          // roles relation not available (admin-ui not installed) — plain query
          user = await prisma.user.findUnique({
            where: { email: credentials.email as string },
          });
        }

        if (!user || !user.password || !user.email) {
          return null;
        }

        const isValid = await bcrypt.compare(credentials.password as string, user.password);

        if (!isValid) {
          return null;
        }

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          roles: Array.isArray(user.roles)
            ? user.roles.map((ur: any) => ({
                ...ur.role,
                permissions: parsePermissions(ur.role?.permissions),
              }))
            : [],
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.roles = (user as any).roles;
      }
      // Re-fetch roles/permissions from DB so changes take effect without re-login
      if (token.id) {
        try {
          const freshUser = await (prisma.user as any).findUnique({
            where: { id: token.id as string },
            include: {
              roles: { select: { role: { select: { id: true, name: true, permissions: true } } } },
            },
          });
          if (freshUser?.roles) {
            token.roles = freshUser.roles.map((ur: any) => ({
              ...ur.role,
              permissions: parsePermissions(ur.role?.permissions),
            }));
          }
        } catch {
          // roles relation not available — keep existing token roles
        }
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
        session.user.roles = token.roles as any;
      }
      return session;
    },
  },
  events: {
    async signIn({ user }) {
      if (user?.id) {
        await logAuditAction({
          action: 'user.login',
          userId: user.id,
          metadata: { email: user.email },
        });
      }
    },
  },
  session: {
    strategy: 'jwt',
  },
  pages: {
    signIn: '/auth/signin',
  },
  secret: process.env.AUTH_SECRET,
});
