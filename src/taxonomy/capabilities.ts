// Capability presets for automotive supply chain
export const CAPABILITY_PRESETS = {
  manufacturing: [
    "Injection Molding",
    "Extrusion",
    "Stamping",
    "Assembly",
    "Machining",
    "Welding",
    "Painting",
    "Plating"
  ],
  logisticsOps: [
    "Warehousing",
    "Distribution",
    "Cross-Docking",
    "Line-Side Logistics",
    "JIT Delivery",
    "SPD (Sequenced Parts Delivery)",
    "Milk Run",
    "Consignment"
  ],
  packagingLifecycle: [
    "Returnable Packaging",
    "Disposable Packaging",
    "Packaging Design",
    "Packaging Management"
  ],
  relationshipTags: [
    "Tier 1 Supplier",
    "Tier 2 Supplier",
    "Tier 3 Supplier",
    "OEM",
    "Service Provider"
  ]
};

export function slug(label: string): string {
  return label.toLowerCase().trim().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "").slice(0, 64);
}
