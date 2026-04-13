export type LastLegVisualStatus =
  | 'active'
  | 'visited'
  | 'noAnswer'
  | 'skipped'
  | 'user'
  | 'notInterested'
  | 'revisitingInterested'
  | 'dealMade'
  | 'containersCleared';

export function deriveLastLegVisualStatus(input: {
  accountState?: string | null;
  routeOutcome?: string | null;
  source?: 'kml' | 'user';
}): LastLegVisualStatus {
  const ro = input.routeOutcome;
  if (ro === 'NOT_INTERESTED') return 'notInterested';
  if (ro === 'REVISITING_INTERESTED') return 'revisitingInterested';
  if (ro === 'DEAL_MADE') return 'dealMade';
  if (ro === 'CONTAINERS_CLEARED') return 'containersCleared';
  if (ro === 'WRONG_ADDRESS') return 'skipped';
  if (ro === 'VISITED' || input.accountState === 'ACCOUNT') return 'visited';
  if (ro === 'NO_ANSWER' || input.accountState === 'NEW_CONTACTED_NO_ANSWER') {
    return 'noAnswer';
  }
  if (input.accountState === 'NEW_UNCONTACTED') return 'active';
  return input.source === 'user' ? 'user' : 'active';
}

export function lastLegStatusColorHex(status: LastLegVisualStatus): string {
  switch (status) {
    case 'visited':
    case 'dealMade':
      return '#22C55E';
    case 'noAnswer':
      return '#EC4899';
    case 'skipped':
      return '#EF4444';
    case 'active':
      return '#3B82F6';
    case 'user':
      return '#DC2626';
    case 'notInterested':
      return '#171717';
    case 'revisitingInterested':
      return '#EAB308';
    case 'containersCleared':
      return '#F5F5F5';
  }
}

export function lastLegStatusLabel(status: LastLegVisualStatus): string {
  switch (status) {
    case 'visited':
      return 'Visited';
    case 'dealMade':
      return 'Deal made';
    case 'noAnswer':
      return 'No answer';
    case 'skipped':
      return 'Skip';
    case 'active':
      return 'Active';
    case 'user':
      return 'User pin';
    case 'notInterested':
      return 'Not interested';
    case 'revisitingInterested':
      return 'Revisiting';
    case 'containersCleared':
      return 'Containers cleared';
  }
}

/** Legacy UI helper — prefer PATCH with `route_outcome` for new lifecycle. */
export function lastLegPatchPayload(status: LastLegVisualStatus): {
  status: string | null;
  account_state: string | null;
  route_outcome?: string | null;
} {
  switch (status) {
    case 'visited':
      return { status: 'visited', account_state: 'ACCOUNT', route_outcome: 'VISITED' };
    case 'dealMade':
      return { status: 'visited', account_state: 'ACCOUNT', route_outcome: 'DEAL_MADE' };
    case 'noAnswer':
      return {
        status: 'no_answer',
        account_state: 'NEW_CONTACTED_NO_ANSWER',
        route_outcome: 'NO_ANSWER'
      };
    case 'skipped':
      return { status: 'trashed', account_state: 'NEW_UNCONTACTED', route_outcome: 'WRONG_ADDRESS' };
    case 'active':
      return { status: 'active', account_state: 'NEW_UNCONTACTED', route_outcome: null };
    case 'user':
      return { status: null, account_state: null, route_outcome: null };
    case 'notInterested':
      return { status: 'visited', account_state: 'NEW_UNCONTACTED', route_outcome: 'NOT_INTERESTED' };
    case 'revisitingInterested':
      return { status: 'active', account_state: 'NEW_UNCONTACTED', route_outcome: 'REVISITING_INTERESTED' };
    case 'containersCleared':
      return { status: 'visited', account_state: 'NEW_UNCONTACTED', route_outcome: 'CONTAINERS_CLEARED' };
  }
}
