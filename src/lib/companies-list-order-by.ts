import type { Prisma } from '@prisma/client';

type SortItem = { id: string; desc: boolean };

/** Maps companies table column ids to Prisma orderBy (server-side, pagination-safe). */
export function buildCompaniesListOrderBy(
  sort: SortItem[] | null | undefined
): Prisma.CompanyOrderByWithRelationInput {
  const first = sort?.[0];
  if (!first?.id) {
    return { createdAt: 'desc' };
  }

  const dir = first.desc ? ('desc' as const) : ('asc' as const);

  switch (first.id) {
    case 'name':
      return { name: dir };
    case 'website':
      return { website: dir };
    case 'status':
      return { status: dir };
    case 'address':
      return {
        primaryLocation: {
          addressRaw: dir
        }
      };
    case 'state':
      return {
        primaryLocation: {
          addressComponents: {
            path: ['state'],
            sort: dir
          }
        }
      } as Prisma.CompanyOrderByWithRelationInput;
    case 'productType':
      return {
        metadata: {
          path: ['productType'],
          sort: dir
        }
      } as Prisma.CompanyOrderByWithRelationInput;
    default:
      return { createdAt: 'desc' };
  }
}
