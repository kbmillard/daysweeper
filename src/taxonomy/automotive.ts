export const automotiveSupplyChain = {
  automotive_supply_chain: {
    OEM: {
      description: "Original Equipment Manufacturers that design vehicles and perform final assembly",
      subtypes: ["Passenger vehicle OEMs", "Commercial vehicle OEMs", "EV / Battery-electric OEMs"]
    },
    Tier_1: {
      description: "Direct-to-OEM suppliers providing complete systems or engineered modules",
      characteristics: [
        "Direct OEM contracts",
        "Program-specific engineering",
        "High-volume production",
        "Heavy use of returnable packaging"
      ],
      subtypes: {
        Manufacturing: ["Seating systems", "Interior modules", "Chassis systems", "Powertrain systems"],
        Battery_and_Energy: ["Battery cells", "Battery modules", "Battery packs", "Energy storage systems"],
        Electronics_and_Mechatronics: ["ADAS systems", "ECUs", "Wiring harness assemblies"],
        Engineering_and_Technology: ["Design validation", "Systems integration", "Program engineering"]
      }
    },
    Tier_2: {
      description: "Suppliers providing components or sub-assemblies to Tier 1 companies",
      examples: [
        "Stamped metal parts",
        "Injection-molded plastics",
        "Castings and forgings",
        "Fasteners",
        "Sub-assemblies",
        "Sensors (component-level)"
      ]
    },
    Tier_3: {
      description: "Suppliers of raw materials or basic processed inputs",
      examples: ["Steel coils", "Aluminum billets", "Plastic resins", "Rubber compounds", "Glass sheets", "Chemicals and coatings"]
    },
    Logistics_and_3PL: {
      description: "Parallel operational layer supporting OEM and Tier 1–3 material flow",
      subtypes: [
        "3PL providers",
        "JIT / JIS operations",
        "Sequencing centers",
        "Kitting operations",
        "Line-side logistics",
        "Cross-dock facilities",
        "Container pool management"
      ]
    },
    Tooling_and_Capital_Equipment: {
      description: "Production-support suppliers not shipping production parts",
      examples: [
        "Tool and die shops",
        "Mold makers",
        "Automation integrators",
        "Robotics",
        "Conveyance systems",
        "Testing and inspection equipment"
      ]
    },
    Aftermarket_and_Services: {
      description: "Post-production and lifecycle support ecosystem",
      examples: [
        "Service parts suppliers",
        "Remanufacturing",
        "Recycling and scrap processing",
        "Container repair and refurbishment",
        "Packaging services"
      ]
    }
  }
} as const;

export type SupplyTier =
  | "OEM"
  | "Tier_1"
  | "Tier_2"
  | "Tier_3"
  | "Logistics_and_3PL"
  | "Tooling_and_Capital_Equipment"
  | "Aftermarket_and_Services";

export function listGroups(tier: SupplyTier): string[] {
  if (tier === "Tier_1") return Object.keys(automotiveSupplyChain.automotive_supply_chain.Tier_1.subtypes);
  return ["General"];
}

export function listSubtypes(tier: SupplyTier, group?: string): string[] {
  const asc = automotiveSupplyChain.automotive_supply_chain;
  if (tier === "OEM") return Array.from(asc.OEM.subtypes);
  if (tier === "Tier_1") {
    if (!group) return [];
    const subtypesObj = asc.Tier_1.subtypes as Record<string, readonly string[]>;
    const g = subtypesObj[group];
    return g ? Array.from(g) : [];
  }
  if (tier === "Tier_2") return Array.from(asc.Tier_2.examples);
  if (tier === "Tier_3") return Array.from(asc.Tier_3.examples);
  if (tier === "Logistics_and_3PL") return Array.from(asc.Logistics_and_3PL.subtypes);
  if (tier === "Tooling_and_Capital_Equipment") return Array.from(asc.Tooling_and_Capital_Equipment.examples);
  if (tier === "Aftermarket_and_Services") return Array.from(asc.Aftermarket_and_Services.examples);
  return [];
}

export function normalizeTierLabel(t: SupplyTier): string {
  return t
    .replaceAll("_and_", " & ")
    .replaceAll("_", " ")
    .replace("Tier 1", "Tier 1")
    .replace("Tier 2", "Tier 2")
    .replace("Tier 3", "Tier 3");
}
