export type LastLegVisualStatus = 'active' | 'visited' | 'noAnswer' | 'skipped' | 'user';

export function deriveLastLegVisualStatus(input: {
  accountState?: string | null;
  routeOutcome?: string | null;
  source?: 'kml' | 'user';
}): LastLegVisualStatus {
  if (input.routeOutcome === 'WRONG_ADDRESS') return 'skipped';
  if (input.routeOutcome === 'VISITED' || input.accountState === 'ACCOUNT') return 'visited';
  if (input.routeOutcome === 'NO_ANSWER' || input.accountState === 'NEW_CONTACTED_NO_ANSWER') {
    return 'noAnswer';
  }
  if (input.accountState === 'NEW_UNCONTACTED') return 'active';
  return input.source === 'user' ? 'user' : 'active';
}

export function lastLegStatusColorHex(status: LastLegVisualStatus): string {
  switch (status) {
    case 'visited':
      return '#10B981';
    case 'noAnswer':
      return '#EC4899';
    case 'skipped':
      return '#EF4444';
    case 'active':
      return '#3B82F6';
    case 'user':
      return '#DC2626';
  }
}

export function lastLegStatusLabel(status: LastLegVisualStatus): string {
  switch (status) {
    case 'visited':
      return 'Visited';
    case 'noAnswer':
      return 'No Answer';
    case 'skipped':
      return 'Skip';
    case 'active':
      return 'Active';
    case 'user':
      return 'User pin';
  }
}

export function lastLegPatchPayload(status: LastLegVisualStatus): {
  status: string | null;
  account_state: string | null;
} {
  switch (status) {
    case 'visited':
      return { status: 'visited', account_state: 'ACCOUNT' };
    case 'noAnswer':
      return { status: 'no_answer', account_state: 'NEW_CONTACTED_NO_ANSWER' };
    case 'skipped':
      return { status: 'trashed', account_state: 'NEW_UNCONTACTED' };
    case 'active':
      return { status: 'active', account_state: 'NEW_UNCONTACTED' };
    case 'user':
      return { status: null, account_state: null };
  }
}
