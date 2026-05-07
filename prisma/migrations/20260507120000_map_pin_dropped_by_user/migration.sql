-- Manually dropped pins (main map) — smaller marker; distinct from synced pipeline dots.
ALTER TABLE "MapPin" ADD COLUMN "droppedByUser" BOOLEAN NOT NULL DEFAULT false;
