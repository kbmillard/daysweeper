import { prisma } from "@/lib/prisma";
import PresetsAdmin from "@/components/admin/PresetsAdmin";

export default async function PresetsPage() {
  // server-load current presets
  const row = await prisma.metaKV.findUnique({ where: { key: "capability_presets" } });
  const value = (row?.value as any) ?? { manufacturing:[], logisticsOps:[], packagingLifecycle:[], relationshipTags:[] };
  return (
    <div className="p-6 space-y-6">
      <h1 className="text-lg font-semibold">Capability Presets</h1>
      <PresetsAdmin initial={value} />
    </div>
  );
}
