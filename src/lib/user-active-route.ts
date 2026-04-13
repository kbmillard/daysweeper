import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';

const ACTIVE_KEY = 'activeRouteId';

function readActiveRouteId(ui: unknown): string | null {
  if (!ui || typeof ui !== 'object') return null;
  const v = (ui as Record<string, unknown>)[ACTIVE_KEY];
  return typeof v === 'string' && v.length > 0 ? v : null;
}

/**
 * Preferred route id from `UserPreference.ui.activeRouteId`, else most recently updated route.
 */
export async function findActiveRouteIdForUser(userId: string): Promise<string | null> {
  const pref = await prisma.userPreference.findUnique({
    where: { userId },
    select: { ui: true }
  });
  const preferred = readActiveRouteId(pref?.ui);
  if (preferred) {
    const r = await prisma.route.findFirst({
      where: { id: preferred, assignedToUserId: userId },
      select: { id: true }
    });
    if (r) return r.id;
  }
  const latest = await prisma.route.findFirst({
    where: { assignedToUserId: userId },
    orderBy: { updatedAt: 'desc' },
    select: { id: true }
  });
  return latest?.id ?? null;
}

export async function setUserActiveRouteId(userId: string, routeId: string): Promise<void> {
  const ok = await prisma.route.findFirst({
    where: { id: routeId, assignedToUserId: userId },
    select: { id: true }
  });
  if (!ok) throw new Error('Route not found for this account');

  const existing = await prisma.userPreference.findUnique({
    where: { userId },
    select: { ui: true }
  });
  const prevUi =
    existing?.ui && typeof existing.ui === 'object' && existing.ui !== null
      ? { ...(existing.ui as Record<string, unknown>) }
      : {};
  prevUi[ACTIVE_KEY] = routeId;
  const uiJson = prevUi as Prisma.InputJsonValue;

  await prisma.userPreference.upsert({
    where: { userId },
    create: { userId, ui: uiJson },
    update: { ui: uiJson }
  });
}
