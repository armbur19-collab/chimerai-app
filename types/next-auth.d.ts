// @chimerai component=NextAuthTypes version=1.0
import { DefaultSession } from 'next-auth';

declare module 'next-auth' {
  interface Session {
    user: {
      id: string;
      roles?: Array<{
        id: string;
        name: string;
        permissions: string[];
      }>;
    } & DefaultSession['user'];
  }

  interface User {
    id: string;
    email: string;
    name?: string | null;
    roles?: Array<{
      id: string;
      name: string;
      permissions: string[];
    }>;
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    id: string;
    roles?: Array<{
      id: string;
      name: string;
      permissions: string[];
    }>;
  }
}
