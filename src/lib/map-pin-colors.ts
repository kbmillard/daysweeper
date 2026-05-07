import { displayStatus } from '@/constants/company-status';
import {
  companyStatusToCrmLane,
  isPipelineMeetingSet,
  isPipelineNotInterested
} from '@/lib/crm-pipeline-alignment';

/**
 * Pin fill for company / location CRM pipeline labels (web display strings).
 * Aligns with {@link CRM_LANE_CHIPS} and the three-lane selector on map popouts.
 */
export function dotColorFromCrmDisplayStatus(status: string | null | undefined): string {
  const d = displayStatus(typeof status === 'string' ? status.trim() || null : null);
  if (!d) return '#2563EB';
  if (isPipelineNotInterested(d)) return '#171717';
  if (isPipelineMeetingSet(d)) return '#10B981';
  const lane = companyStatusToCrmLane(d);
  if (lane === 'ACCOUNT') return '#10B981';
  if (lane === 'NEW_CONTACTED_NO_ANSWER') return '#EAB308';
  return '#2563EB';
}

/**
 * Map dot colors aligned with LastLeg iOS `Lead.serverStatus`
 * (`route_outcome` wins, then `account_state`).
 */
export function dotColorFromLastLegSignals(
  accountState: string | undefined | null,
  routeOutcome: string | undefined | null
): string {
  const o = (routeOutcome ?? '').trim().toUpperCase();
  if (o) {
    switch (o) {
      case 'NOT_INTERESTED':
      case 'VISITED_NOT_INTERESTED':
      case 'WRONG_ADDRESS':
        return '#171717';
      case 'REVISITING_INTERESTED':
      case 'NO_ANSWER':
        return '#EAB308';
      case 'DEAL_MADE':
      case 'VISITED_DEAL_MADE':
      case 'VISITED':
        return '#10B981';
      case 'CONTAINERS_CLEARED':
        return '#F3F4F6';
      case 'LASTLEG_ACTIVE':
      case 'ACTIVE':
        return '#2563EB';
      default:
        break;
    }
  }
  const s = (accountState ?? '').trim().toUpperCase();
  if (s === 'ACCOUNT') return '#10B981';
  if (s === 'NEW_CONTACTED_NO_ANSWER') return '#EAB308';
  if (!s || s === 'NEW_UNCONTACTED') return '#2563EB';
  return '#78716c';
}

/** Which of the three CRM chips is selected (null = none — e.g. not-interested outcome). */
export function statusButtonSelectionFromSignals(
  accountState: string | undefined | null,
  routeOutcome: string | undefined | null
): 'NEW_UNCONTACTED' | 'NEW_CONTACTED_NO_ANSWER' | 'ACCOUNT' | null {
  const o = (routeOutcome ?? '').trim().toUpperCase();
  if (o === 'NO_ANSWER' || o === 'REVISITING_INTERESTED') return 'NEW_CONTACTED_NO_ANSWER';
  if (o === 'DEAL_MADE' || o === 'VISITED_DEAL_MADE' || o === 'VISITED') return 'ACCOUNT';
  if (
    o === 'NOT_INTERESTED' ||
    o === 'VISITED_NOT_INTERESTED' ||
    o === 'WRONG_ADDRESS' ||
    o === 'CONTAINERS_CLEARED' ||
    o === 'FOLLOW_UP'
  ) {
    return null;
  }
  if (o === 'LASTLEG_ACTIVE' || o === 'ACTIVE') return 'NEW_UNCONTACTED';

  const s = (accountState ?? '').trim().toUpperCase();
  if (s === 'ACCOUNT') return 'ACCOUNT';
  if (s === 'NEW_CONTACTED_NO_ANSWER') return 'NEW_CONTACTED_NO_ANSWER';
  return 'NEW_UNCONTACTED';
}

/** Map 3-button web status to `account_state` + `route_outcome` (LastLeg-aligned). */
export function statusButtonToPatch(state: string): {
  account_state: string;
  route_outcome: null | 'NO_ANSWER' | 'DEAL_MADE';
} {
  switch (state) {
    case 'NEW_UNCONTACTED':
      return { account_state: 'NEW_UNCONTACTED', route_outcome: null };
    case 'NEW_CONTACTED_NO_ANSWER':
      return { account_state: 'NEW_CONTACTED_NO_ANSWER', route_outcome: 'NO_ANSWER' };
    case 'ACCOUNT':
      return { account_state: 'ACCOUNT', route_outcome: 'DEAL_MADE' };
    default:
      return { account_state: 'NEW_UNCONTACTED', route_outcome: null };
  }
}
