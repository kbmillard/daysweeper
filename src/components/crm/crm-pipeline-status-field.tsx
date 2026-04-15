'use client';

import { Label } from '@/components/ui/label';
import {
  CRM_LANE_CHIPS,
  PIPELINE_EXTRA_MEETING_SET,
  PIPELINE_EXTRA_NOT_INTERESTED,
  companyStatusToCrmLane,
  crmLaneToCompanyStatus,
  isPipelineMeetingSet,
  isPipelineNotInterested,
  type CrmLane
} from '@/lib/crm-pipeline-alignment';

type Props = {
  id: string;
  label: string;
  value: string;
  onChange: (next: string) => void;
  /** Hint under the chips (map pages). */
  helperText?: string;
};

/**
 * Same three-lane CRM as the `/map` popout and LastLeg `account_state` / `route_outcome` presets,
 * plus optional “Not interested” / “Meeting set” for the remaining `COMPANY_STATUSES` values.
 */
export function CrmPipelineStatusField({ id, label, value, onChange, helperText }: Props) {
  const lane = companyStatusToCrmLane(value);
  const ni = isPipelineNotInterested(value);
  const ms = isPipelineMeetingSet(value);

  const setLane = (l: CrmLane) => {
    onChange(crmLaneToCompanyStatus(l));
  };

  return (
    <div>
      <Label htmlFor={id} className="mb-1.5 block">
        {label}
      </Label>
      {helperText ? (
        <p className="text-muted-foreground mb-2 text-[12px] leading-snug">{helperText}</p>
      ) : null}
      <div className="flex flex-wrap gap-2" id={id}>
        {CRM_LANE_CHIPS.map(({ lane: key, label: chipLabel, activeClass }) => {
          const on = lane === key;
          return (
            <button
              key={key}
              type="button"
              onClick={() => setLane(key)}
              className={`rounded-full px-3 py-2 text-[13px] font-semibold transition-all border border-black/10 shadow-sm dark:border-white/20 ${
                on
                  ? activeClass
                  : 'bg-slate-200 text-slate-900 hover:bg-slate-300 dark:bg-zinc-800/95 dark:text-zinc-50 dark:hover:bg-zinc-700/95'
              }`}
            >
              {chipLabel}
            </button>
          );
        })}
      </div>
      <div className="mt-2 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => onChange(PIPELINE_EXTRA_NOT_INTERESTED)}
          className={`rounded-full px-3 py-1.5 text-[12px] font-medium transition-colors border ${
            ni
              ? 'border-neutral-700 bg-neutral-800 text-white dark:bg-neutral-700'
              : 'border-border bg-muted/50 text-muted-foreground hover:bg-muted'
          }`}
        >
          Not interested
        </button>
        <button
          type="button"
          onClick={() => onChange(PIPELINE_EXTRA_MEETING_SET)}
          className={`rounded-full px-3 py-1.5 text-[12px] font-medium transition-colors border ${
            ms
              ? 'border-sky-600 bg-sky-600 text-white'
              : 'border-border bg-muted/50 text-muted-foreground hover:bg-muted'
          }`}
        >
          Meeting set
        </button>
      </div>
    </div>
  );
}
