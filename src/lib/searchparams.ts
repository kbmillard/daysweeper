import {
  createSearchParamsCache,
  createSerializer,
  parseAsArrayOf,
  parseAsInteger,
  parseAsString
} from 'nuqs/server';
import { getSortingStateParser } from './parsers';

export const searchParams = {
  page: parseAsInteger.withDefault(1),
  perPage: parseAsInteger.withDefault(10),
  name: parseAsString,
  gender: parseAsString,
  category: parseAsString,
  company: parseAsString,
  segment: parseAsString,
  tier: parseAsString,
  accountState: parseAsString,
  email: parseAsString,
  phone: parseAsString,
  website: parseAsString,
  status: parseAsString,
  state: parseAsArrayOf(parseAsString, ','),
  /** Buyer / vendor research companies (`Company.isBuyer`) */
  buyer: parseAsArrayOf(parseAsString, ','),
  address: parseAsString,
  subCategory: parseAsString,
  subCategoryGroup: parseAsString,
  locations: parseAsString,
  createdAt: parseAsString,
  hideAccounts: parseAsString,
  sort: getSortingStateParser()
  // advanced filter
  // filters: getFiltersStateParser().withDefault([]),
  // joinOperator: parseAsStringEnum(['and', 'or']).withDefault('and')
};

export const searchParamsCache = createSearchParamsCache(searchParams);
export const serialize = createSerializer(searchParams);
