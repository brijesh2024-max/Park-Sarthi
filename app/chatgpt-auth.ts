// Compatibility exports for earlier imports; identity now comes only from Supabase.
import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth/server';
import { safeReturnTo } from '@/lib/auth/policy';
export { getCurrentUser as getChatGPTUser } from '@/lib/auth/server';
export type { User as ChatGPTUser } from '@/lib/auth/server';
export async function requireChatGPTUser(returnTo: string) {
  const user = await getCurrentUser();
  if (user) return user;
  redirect(chatGPTSignInPath(returnTo));
}
export function chatGPTSignInPath(returnTo: string) {
  return '/auth/sign-in?return_to=' + encodeURIComponent(safeReturnTo(returnTo));
}
export function chatGPTSignOutPath() { return '/auth/sign-out'; }
