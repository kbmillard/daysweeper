"use client";
import { usePatchStopOutcome } from "@/lib/routes";
import { Button } from "@/components/ui/button";

export default function OutcomeButtons({ stopId, onDone }: { stopId: string; onDone?: () => void }) {
  const mut = usePatchStopOutcome();
  const click = (outcome: "VISITED"|"NO_ANSWER"|"WRONG_ADDRESS"|"FOLLOW_UP") =>
    mut.mutate({ stopId, outcome }, { onSuccess: onDone });

  return (
    <div className="flex flex-wrap gap-2">
      <Button size="sm" onClick={() => click("VISITED")}>Visited</Button>
      <Button size="sm" variant="secondary" onClick={() => click("NO_ANSWER")}>No Answer</Button>
      <Button size="sm" variant="secondary" onClick={() => click("WRONG_ADDRESS")}>Wrong Address</Button>
      <Button size="sm" variant="secondary" onClick={() => click("FOLLOW_UP")}>Follow-Up</Button>
    </div>
  );
}
