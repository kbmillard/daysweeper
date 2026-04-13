import { Prisma } from '@prisma/client';
import type { Option } from '@/types/data-table';
import { prisma } from '@/lib/prisma';

/**
 * URL/query value for "at least one location has no usable state".
 * Must not collide with real `addressComponents.state` values.
 */
export const BLANK_STATE_FILTER_VALUE = '__NO_STATE__';

/** Distinct non-empty `addressComponents.state` values for visible companies' locations (sorted). */
export async function getDistinctCompanyLocationStates(): Promise<Option[]> {
  const [rows, blankRow] = await Promise.all([
    prisma.$queryRaw<Array<{ state: string }>>(
      Prisma.sql`
        SELECT DISTINCT TRIM(l."addressComponents"->>'state') AS state
        FROM "Location" l
        INNER JOIN "Company" c ON c.id = l."companyId"
        WHERE c.hidden = false
          AND l."addressComponents" IS NOT NULL
          AND TRIM(COALESCE(l."addressComponents"->>'state', '')) != ''
        ORDER BY state ASC
      `
    ),
    prisma.$queryRaw<Array<{ has_blank: boolean }>>(
      Prisma.sql`
        SELECT EXISTS (
          SELECT 1
          FROM "Location" l
          INNER JOIN "Company" c ON c.id = l."companyId"
          WHERE c.hidden = false
            AND (
              l."addressComponents" IS NULL
              OR TRIM(COALESCE(l."addressComponents"->>'state', '')) = ''
            )
        ) AS has_blank
      `
    )
  ]);

  const options: Option[] = rows.map((r) => ({ label: r.state, value: r.state }));
  if (blankRow[0]?.has_blank) {
    options.unshift({
      label: 'No state',
      value: BLANK_STATE_FILTER_VALUE
    });
  }
  return options;
}

/**
 * Location rows (visible companies only) where parsed state is missing or blank after trim.
 * Used for the "No state" filter so it matches the same rows as {@link getDistinctCompanyLocationStates}'s has_blank check.
 */
export async function getLocationIdsWithBlankParsedState(): Promise<string[]> {
  const rows = await prisma.$queryRaw<Array<{ id: string }>>(
    Prisma.sql`
      SELECT l.id
      FROM "Location" l
      INNER JOIN "Company" c ON c.id = l."companyId"
      WHERE c.hidden = false
        AND (
          l."addressComponents" IS NULL
          OR TRIM(COALESCE(l."addressComponents"->>'state', '')) = ''
        )
    `
  );
  return rows.map((r) => r.id);
}
