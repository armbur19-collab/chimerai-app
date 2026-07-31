// @chimerai component=NavConfig version=1.0
export interface NavItem {
  href: string;
  label: string;
  feature: string;
  adminOnly?: boolean;
}

export const NAV_ITEMS: NavItem[] = [
  { href: '/dashboard', label: 'Dashboard', feature: 'core' },
  { href: '/dashboard/profile', label: 'Profile', feature: 'core' },
  { href: '/dashboard/settings', label: 'Settings', feature: 'core' },
  { href: '/dashboard/providers', label: 'AI Providers', feature: 'model-providers' },
  { href: '/dashboard/prompts', label: 'Prompt Templates', feature: 'prompt-management' },
  { href: '/chat', label: 'Chat', feature: 'chat-ui' },
  { href: '/rag', label: 'RAG', feature: 'rag' },
  // @chimerai-nav-end
];
