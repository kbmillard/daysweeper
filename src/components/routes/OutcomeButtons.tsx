"use client";

import { Button } from "@/components/ui/button";
import { usePatchStopOutcome } from "@/lib/routes";

export default function OutcomeButtons({ 
  stopId, 
  onDone 
}: { 
  stopId: string; 
  onDone?: () => void;
}) {
  const mut = usePatchStopOutcome();
  
  const click = (outcome: "VISITED" | "NO_ANSWER" | "WRONG_ADDRESS" | "FOLLOW_UP") =>
    mut.mutate({ stopId, outcome }, { onSuccess: onDone });

  return (
    <div className="flex flex-wrap gap-2">
      <Button 
        size="sm" 
        onClick={() => click("VISITED")}
        disabled={mut.isPending}
      >
        Visited
      </Button>
      <Button 
        size="sm" 
        variant="secondary" 
        onClick={() => click("NO_ANSWER")}
        disabled={mut.isPending}
      >
        No Answer
      </Button>
      <Button 
        size="sm" 
        variant="secondary" 
        onClick={() => click("WRONG_ADDRESS")}
        disabled={mut.isPending}
      >
        Wrong Address
      </Button>
      <Button 
        size="sm" 
        variant="secondary" 
        onClick={() => click("FOLLOW_UP")}
        disabled={mut.isPending}
      >
        Follow-Up
      </Button>
    </div>
  );
}
