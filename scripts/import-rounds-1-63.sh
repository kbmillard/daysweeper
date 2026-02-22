#!/bin/bash
# Import all new_entries JSON files (rounds 37-62) in order.
# Excludes remove_entries. Run from project root.

set -e
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

# All new_entries files, sorted by round number (37-62)
FILES="JSON/round2/new_entries_round37_MO_KS_OK_TX_only.json"
FILES="$FILES,JSON/round2/new_entries_round37_MO_KS_OK_TX_suppliers_only.json"
FILES="$FILES,JSON/round2/new_entries_round37to39_MO_KS_OK_TX_AUTOMOTIVE_ONLY.json"
FILES="$FILES,JSON/round2/new_entries_round37to39_MO_KS_OK_TX_suppliers_only_combined.json"
FILES="$FILES,JSON/round2/new_entries_round38_MO_KS_OK_TX_location_pages_only.json"
FILES="$FILES,JSON/round2/new_entries_round39_MO_KS_OK_TX_location_pages_deeper.json"
FILES="$FILES,JSON/round2/new_entries_round40_MO_OK_TX_AR_only.json"
FILES="$FILES,JSON/round2/new_entries_round40_TX_suppliers_only.json"
FILES="$FILES,JSON/round2/new_entries_round41_TX_suppliers_only.json"
FILES="$FILES,JSON/round2/new_entries_round42_TX_suppliers_only.json"
FILES="$FILES,JSON/round2/new_entries_round43_TX_suppliers_only.json"
FILES="$FILES,JSON/round2/new_entries_round44_TX_suppliers_only.json"
FILES="$FILES,JSON/round2/new_entries_round44_TX_tier1_tier2_only.json"
FILES="$FILES,JSON/round2/new_entries_round45_TX_suppliers_only.json"
FILES="$FILES,JSON/round2/new_entries_round46_WI_suppliers_only.json"
FILES="$FILES,JSON/round2/new_entries_round47_WI_suppliers_only.json"
FILES="$FILES,JSON/round2/new_entries_round48_WI_suppliers_only.json"
FILES="$FILES,JSON/round2/new_entries_round49_WI_suppliers_only.json"
FILES="$FILES,JSON/round2/new_entries_round50_IL_Chicago_suppliers_only.json"
FILES="$FILES,JSON/round2/new_entries_round51_IL_workdown_deeper_suppliers_only.json"
FILES="$FILES,JSON/round2/new_entries_round52_IL_workdown_downstate_plus_NW_IN_suppliers_only.json"
FILES="$FILES,JSON/round2/new_entries_round53_Eastward_IN_OH_PA_suppliers_only.json"
FILES="$FILES,JSON/round2/new_entries_round54_Eastward_50_suppliers_only.json"
FILES="$FILES,JSON/round2/new_entries_round55_Westward_50_suppliers_only.json"
FILES="$FILES,JSON/round2/new_entries_round56_Westward_50_tier1_tier2_automotive_only.json"
FILES="$FILES,JSON/round2/new_entries_round57_midwest_official_sites_suppliers_only.json"
FILES="$FILES,JSON/round2/new_entries_round58_corridor_official_sites_suppliers_only.json"
FILES="$FILES,JSON/round2/new_entries_round60_corridor_automotive_only.json"
FILES="$FILES,JSON/round2/new_entries_round61_corridor_automotive_only.json"
FILES="$FILES,JSON/round2/new_entries_round62_corridor_official_sites_suppliers_only (3).json"

echo "Purging..."
npx tsx scripts/purge-all.ts

echo "Importing rounds 37-62..."
npx tsx scripts/importSuppliers.ts --files "$FILES"

echo "Done."
