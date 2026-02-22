import { auth } from '@clerk/nextjs/server';
import { cookies } from 'next/headers';
import { prisma } from '@/lib/prisma';

export async function getSidebarDefaultOpen(): Promise<boolean> {
  const { userId } = await auth();
  if (userId) {
    const prefs = await prisma.userPreference.findUnique({
      where: { userId }
    });
    const layout = prefs?.layout as { sidebarOpen?: boolean } | null | undefined;
    if (typeof layout?.sidebarOpen === 'boolean') {
      return layout.sidebarOpen;
    }
  }
  const cookieStore = await cookies();
  return cookieStore.get('sidebar_state')?.value === 'true';
}
