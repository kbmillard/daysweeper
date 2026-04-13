-- AlterTable
ALTER TABLE "Company" ADD COLUMN "isBuyer" BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex
CREATE INDEX "Company_isBuyer_idx" ON "Company"("isBuyer");

-- Migrate legacy Seller rows into Company + Location, then drop Seller (if table exists)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'Seller'
  ) THEN
    INSERT INTO "Company" (
      "id",
      "externalId",
      "userId",
      "orgId",
      "name",
      "parentCompanyDbId",
      "externalParentId",
      "website",
      "companyKey",
      "phone",
      "email",
      "tier",
      "segment",
      "category",
      "subtype",
      "subtypeGroup",
      "status",
      "hidden",
      "primaryLocationId",
      "legacyJson",
      "metadata",
      "createdAt",
      "updatedAt",
      "isBuyer"
    )
    SELECT
      s."id",
      s."externalId",
      NULL,
      NULL,
      s."name",
      NULL,
      NULL,
      s."website",
      NULL,
      s."phone",
      NULL,
      NULL,
      NULL,
      NULL,
      NULL,
      NULL,
      NULL,
      false,
      NULL,
      s."legacyJson",
      jsonb_build_object(
        'buyerImport',
        jsonb_strip_nulls(
          jsonb_build_object(
            'role', to_jsonb(s."role"),
            'notes', to_jsonb(s."notes"),
            'importCategory', to_jsonb(s."importCategory"),
            'migratedFromSeller', to_jsonb(true)
          )
        )
      ),
      s."createdAt",
      NOW(),
      true
    FROM "Seller" s
    ON CONFLICT ("externalId") DO UPDATE SET
      "isBuyer" = true,
      "name" = EXCLUDED."name",
      "phone" = COALESCE(EXCLUDED."phone", "Company"."phone"),
      "website" = COALESCE(EXCLUDED."website", "Company"."website"),
      "legacyJson" = COALESCE(EXCLUDED."legacyJson", "Company"."legacyJson"),
      "metadata" = COALESCE("Company"."metadata", '{}'::jsonb) || COALESCE(EXCLUDED."metadata", '{}'::jsonb),
      "updatedAt" = NOW();

    INSERT INTO "Location" (
      "id",
      "companyId",
      "externalId",
      "addressRaw",
      "addressNormalized",
      "addressComponents",
      "latitude",
      "longitude",
      "createdAt",
      "updatedAt"
    )
    SELECT
      gen_random_uuid()::text,
      c."id",
      s."externalId" || '__buyer_loc',
      s."addressRaw",
      s."addressNormalized",
      s."addressComponents",
      s."latitude",
      s."longitude",
      NOW(),
      NOW()
    FROM "Seller" s
    INNER JOIN "Company" c ON c."externalId" = s."externalId"
    ON CONFLICT ("externalId") DO UPDATE SET
      "companyId" = EXCLUDED."companyId",
      "addressRaw" = EXCLUDED."addressRaw",
      "addressNormalized" = EXCLUDED."addressNormalized",
      "addressComponents" = EXCLUDED."addressComponents",
      "latitude" = EXCLUDED."latitude",
      "longitude" = EXCLUDED."longitude",
      "updatedAt" = NOW();

    UPDATE "Company" c
    SET "primaryLocationId" = l."id"
    FROM "Location" l
    WHERE l."companyId" = c."id"
      AND l."externalId" = c."externalId" || '__buyer_loc'
      AND c."primaryLocationId" IS NULL
      AND c."isBuyer" = true;

    DROP TABLE "Seller";
  END IF;
END $$;
