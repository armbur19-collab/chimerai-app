/**
 * RBAC Permission utilities — Free Tier Stub
 * All permission checks pass; no database lookups.
 * Run 'chimerai add rbac' to enable full Role-Based Access Control.
 * @chimerai component=PermissionsLib version=1.0-stub
 */

export const AVAILABLE_PERMISSIONS = [
  '*', 'chat:use', 'chat:history', 'profile:read', 'profile:write',
  'rag:use', 'rag:upload', 'providers:read', 'providers:write',
  'models:select', 'prompts:read', 'prompts:write', 'api:keys',
  'users:read', 'users:write', 'users:delete',
  'roles:read', 'roles:write', 'roles:delete',
  'settings:read', 'settings:write', 'admin:users', 'admin:analytics',
  'admin:providers', 'admin:*',
] as const;

export type Permission = (typeof AVAILABLE_PERMISSIONS)[number];
export const MODEL_TIERS = ['FREE', 'STANDARD', 'PREMIUM'] as const;
export type ModelTier = (typeof MODEL_TIERS)[number];

interface UserWithRoles {
  id: string;
  email?: string | null;
  roles?: Array<{ permissions?: string | string[] | null }>;
}

export function parsePermissions(permissions: string | string[] | null | undefined): string[] {
  if (!permissions) return [];
  if (Array.isArray(permissions)) return permissions.filter(Boolean);
  const trimmed = permissions.trim();
  if (trimmed.startsWith('[')) {
    try {
      const parsed = JSON.parse(trimmed);
      if (Array.isArray(parsed)) return parsed.map(String).filter(Boolean);
    } catch { /* fall through */ }
  }
  return trimmed.split(',').map((s: string) => s.trim()).filter(Boolean);
}

// Stub: free tier has no roles — all checks pass
export function hasPermission(_user: UserWithRoles | null, _permission: string): boolean { return true; }
export function hasAnyPermission(_user: UserWithRoles | null, _permissions: string[]): boolean { return true; }
export function hasAllPermissions(_user: UserWithRoles | null, _permissions: string[]): boolean { return true; }

export async function requirePermission(_userId: string, _permission: string): Promise<boolean> { return true; }
export async function getUserPermissions(_userId: string): Promise<string[]> { return ['*']; }
export async function getUserMaxModelTier(_userId: string): Promise<string> { return 'PREMIUM'; }
