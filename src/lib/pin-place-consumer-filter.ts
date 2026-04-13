/**
 * Filters Google Places results for industrial/supplier map pins.
 * Kept prisma-free so CLI scripts can import safely before dotenv.
 */

const EXCLUDED_GOOGLE_TYPES = new Set<string>([
  'restaurant',
  'cafe',
  'meal_takeaway',
  'meal_delivery',
  'bakery',
  'bar',
  'night_club',
  'food',
  'dentist',
  'doctor',
  'hospital',
  'pharmacy',
  'veterinary_care',
  'physiotherapist',
  'spa',
  'beauty_salon',
  'hair_care',
  'shopping_mall',
  'supermarket',
  'convenience_store',
  'department_store',
  'electronics_store',
  'furniture_store',
  'hardware_store',
  'home_goods_store',
  'jewelry_store',
  'clothing_store',
  'shoe_store',
  'liquor_store',
  'book_store',
  'florist',
  'pet_store',
  'bicycle_store',
  'gas_station',
  'car_dealer',
  'car_repair',
  'car_wash',
  'lodging',
  'gym',
  'bowling_alley',
  'movie_theater',
  'casino',
  'church',
  'mosque',
  'synagogue',
  'hindu_temple',
  'school',
  'primary_school',
  'secondary_school',
  'university',
  'lawyer',
  'accounting',
  'bank',
  'atm',
  'insurance_agency',
  'real_estate_agency',
  'travel_agency',
  'funeral_home',
  'cemetery'
]);

const CONSUMER_NAME_REGEXES: RegExp[] = [
  /\borthodont/i,
  /\bdent(al|ist|istry)\b/i,
  /\bdental\b/i,
  /\b(smile|braces|invisalign)\b/i,
  /\b(veterinar|animal\s+hospital|pet\s+hospital)\b/i,
  /\b(medical\s+center|urgent\s+care|family\s+practice|physician|clinic)\b/i,
  /\b(chiropract)\b/i,
  /\b(optometr|eye\s+care)\b/i,
  /\b(pharmacy|drugstore|cvs|walgreens)\b/i,
  /\b(restaurant|café|cafe|coffee\s+shop|pizza|grill|tavern|brewery|bbq|bistro|diner)\b/i,
  /\b(mcdonald|burger\s+king|subway|starbucks|wendy|taco\s+bell|chipotle|kfc|dunkin)\b/i,
  /\b(walmart|target\s+store|kroger|publix|costco|sam'?s\s+club|dollar\s+general|family\s+dollar)\b/i,
  /\b(home\s+depot|lowe'?s|menards|ace\s+hardware|true\s+value|harbor\s+freight)\b/i,
  /\b(autozone|o'?reilly|advance\s+auto|napa\s+auto|pep\s+boys)\b/i,
  /\b(motel|hotel|inn\s+&|marriott|hilton|holiday\s+inn|comfort\s+inn)\b/i,
  /\b(fast\s+food)\b/i
];

export function shouldExcludeConsumerPoi(types: string[] | undefined, placeName: string): boolean {
  const name = placeName.trim();
  if (!name) return true;
  for (const t of types ?? []) {
    if (EXCLUDED_GOOGLE_TYPES.has(t)) return true;
  }
  for (const re of CONSUMER_NAME_REGEXES) {
    if (re.test(name)) return true;
  }
  return false;
}

export const PIN_RESEARCH_LLM_INDUSTRIAL_BIAS = `Context: pins are for industrial/supplier scouting (plants, warehouses, OEM/Tier-1 sites). NEVER prefer restaurants, dental/medical/vet offices, retail stores, grocery, hardware stores, hotels, schools, gas stations, or auto-parts retail chains unless the user hint explicitly names that business. Prefer manufacturing, logistics, industrial parks, and large commercial facilities.`;
