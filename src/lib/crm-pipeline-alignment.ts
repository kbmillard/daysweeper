import { displayStatus } from '@/constants/company-status';

/** LastLeg map popout + iOS three-lane CRM (see `map-pin-colors.statusButtonToPatch`). */
export type CrmLane = 'NEW_UNCONTACTED' | 'NEW_CONTACTED_NO_ANSWER' | 'ACCOUNT';

export const CRM_LANE_CHIPS: readonly {
  lane: CrmLane;
  label: string;
  activeClass: string;
}[] = [
  {
    lane: 'NEW_UNCONTACTED',
    label: 'New',
    activeClass: 'bg-blue-600 text-white ring-2 ring-blue-300'
  },
  {
    lane: 'NEW_CONTACTED_NO_ANSWER',
    label: 'No answer',
    activeClass: 'bg-amber-500 text-white ring-2 ring-amber-300'
  },
  { lane: 'ACCOUNT', label: 'Account', activeClass: 'bg-emerald-600 text-white ring-2 ring-emerald-300' }
] as const;

/** Extra CRM strings kept for kanban / legacy — not one of the three lanes. */
export const PIPELINE_EXTRA_NOT_INTERESTED = 'Contacted - not interested' as const;
export const PIPELINE_EXTRA_MEETING_SET = 'Contacted - meeting set' as const;

/** Which main chip is highlighted (null = none — not interested / meeting set / empty extras). */
export function companyStatusToCrmLane(status: string | null | undefined): CrmLane | null {
  const d = displayStatus(status?.trim() || null) ?? '';
  if (!d) return 'NEW_UNCONTACTED';
  if (d === 'Contacted - no answer') return 'NEW_CONTACTED_NO_ANSWER';
  if (d === 'Account') return 'ACCOUNT';
  if (d === PIPELINE_EXTRA_NOT_INTERESTED || d === PIPELINE_EXTRA_MEETING_SET) return null;
  return 'NEW_UNCONTACTED';
}

/** Form value for PATCH (empty string clears to “no pipeline label” = New lane). */
export function crmLaneToCompanyStatus(lane: CrmLane): string {
  switch (lane) {
    case 'NEW_UNCONTACTED':
      return '';
    case 'NEW_CONTACTED_NO_ANSWER':
      return 'Contacted - no answer';
    case 'ACCOUNT':
      return 'Account';
  }
}

export function isPipelineNotInterested(status: string | null | undefined): boolean {
  return displayStatus(status?.trim() || null) === PIPELINE_EXTRA_NOT_INTERESTED;
}

export function isPipelineMeetingSet(status: string | null | undefined): boolean {
  return displayStatus(status?.trim() || null) === PIPELINE_EXTRA_MEETING_SET;
}
