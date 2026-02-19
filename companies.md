# CRM Company ID Usage Guide

**For Cursor AI and developers working with supplier data import and CRM operations.**

---

## Table of Contents

1. [ID Structure Overview](#id-structure-overview)
2. [ID Mapping: JSON → Database](#id-mapping-json--database)
3. [Import Process](#import-process)
4. [Deduplication Strategy](#deduplication-strategy)
5. [Relationship Management](#relationship-management)
6. [Querying by External IDs](#querying-by-external-ids)
7. [Best Practices](#best-practices)
8. [Common Patterns](#common-patterns)

---

## ID Structure Overview

The supplier JSON data contains several ID fields that map to the CRM database:

### JSON Fields (from `has_both_website_and_address_cleaned.json`)

- **`companyId`** - UUID identifying the company entity
- **`locationId`** - UUID identifying a specific location/facility
- **`companyKey`** - Domain-based key (e.g., "magna.com") for company grouping
- **`parentCompanyId`** - UUID of the parent company (if applicable)
- **`parentCompanyWebsite`** - Website URL of parent company

### Database Fields (Prisma Schema)

- **`Company.externalId`** - Maps to JSON `companyId` (unique, indexed)
- **`Location.externalId`** - Maps to JSON `locationId` (unique, indexed)
- **`Company.companyKey`** - Maps to JSON `companyKey` (indexed)
- **`Company.externalParentId`** - Maps to JSON `parentCompanyId` (for import mapping)
- **`Company.parentCompanyDbId`** - Internal Prisma ID linking to parent Company

---

## ID Mapping: JSON → Database

### Company Import Mapping

```typescript
// JSON Entry
{
  "companyId": "550e8400-e29b-41d4-a716-446655440000",
  "company": "Magna International",
  "companyKey": "magna.com",
  "parentCompanyId": "123e4567-e89b-12d3-a456-426614174000",
  "website": "https://www.magna.com",
  // ... other fields
}

// Maps to Company model:
{
  externalId: "550e8400-e29b-41d4-a716-446655440000",  // from companyId
  name: "Magna International",                          // from company
  companyKey: "magna.com",                              // from companyKey
  externalParentId: "123e4567-e89b-12d3-a456-426614174000", // from parentCompanyId
  website: "https://www.magna.com",                     // from website
  // ... other mapped fields
}
```

### Location Import Mapping

```typescript
// JSON Entry
{
  "locationId": "660e8400-e29b-41d4-a716-446655440001",
  "companyId": "550e8400-e29b-41d4-a716-446655440000",
  "addressRaw": "123 Main St, Detroit, MI 48201",
  // ... other fields
}

// Maps to Location model:
{
  externalId: "660e8400-e29b-41d4-a716-446655440001",  // from locationId
  companyId: "<internal-prisma-id>",                   // resolved from companyId
  addressRaw: "123 Main St, Detroit, MI 48201",        // from addressRaw
  // ... other mapped fields
}
```

---

## Import Process

### Three-Pass Import Strategy

The import process uses a three-pass approach to handle relationships:

#### Pass 1: Create Companies (without parent relationships)

```typescript
// Build mapping: externalId -> dbId
const companyMap = new Map<string, string>();
const parentMap = new Map<string, string>();

for (const supplier of suppliers) {
  const companyExternalId = supplier.companyId;
  if (!companyExternalId) continue;

  // Check if company already exists
  const existing = await prisma.company.findUnique({
    where: { externalId: companyExternalId },
  });

  if (existing) {
    companyMap.set(companyExternalId, existing.id);
    continue;
  }

  // Create new company
  const company = await prisma.company.create({
    data: {
      externalId: companyExternalId,
      name: supplier.company,
      companyKey: supplier.companyKey,
      website: supplier.website,
      externalParentId: supplier.parentCompanyId, // Store for pass 2
      // ... other fields
    },
  });

  companyMap.set(companyExternalId, company.id);
  
  // Track parent relationships for pass 2
  if (supplier.parentCompanyId) {
    parentMap.set(companyExternalId, supplier.parentCompanyId);
  }
}
```

#### Pass 2: Link Parent Companies

```typescript
// Resolve parent relationships using external IDs
for (const [externalId, externalParentId] of parentMap.entries()) {
  const companyDbId = companyMap.get(externalId);
  if (!companyDbId) continue;

  // Find parent by externalId
  const parent = await prisma.company.findUnique({
    where: { externalId: externalParentId },
  });

  if (parent) {
    await prisma.company.update({
      where: { id: companyDbId },
      data: { parentCompanyDbId: parent.id }, // Link using internal ID
    });
  }
}
```

#### Pass 3: Create Locations

```typescript
for (const supplier of suppliers) {
  const locationExternalId = supplier.locationId;
  const companyExternalId = supplier.companyId;

  if (!locationExternalId || !companyExternalId) continue;

  const companyDbId = companyMap.get(companyExternalId);
  if (!companyDbId) continue;

  // Check if location already exists
  const existing = await prisma.location.findUnique({
    where: { externalId: locationExternalId },
  });

  if (existing) continue;

  // Create location linked to company
  await prisma.location.create({
    data: {
      externalId: locationExternalId,
      companyId: companyDbId, // Use internal Prisma ID
      addressRaw: supplier.addressRaw || '',
      // ... other fields
    },
  });
}
```

---

## Deduplication Strategy

### Using External IDs for Deduplication

External IDs (`companyId`, `locationId`) are the **primary deduplication keys**:

```typescript
// Check if company exists before creating
async function findOrCreateCompany(supplier: SupplierJson) {
  if (!supplier.companyId) {
    throw new Error('Missing companyId');
  }

  // Try to find existing company by externalId
  const existing = await prisma.company.findUnique({
    where: { externalId: supplier.companyId },
  });

  if (existing) {
    return existing; // Return existing, don't duplicate
  }

  // Create new company
  return await prisma.company.create({
    data: {
      externalId: supplier.companyId,
      name: supplier.company,
      // ... other fields
    },
  });
}
```

### Fallback Deduplication (when externalId missing)

If `companyId` is missing, use `companyKey` or `company` + `addressRaw`:

```typescript
async function findCompanyByFallback(supplier: SupplierJson) {
  // Try companyKey first
  if (supplier.companyKey) {
    const byKey = await prisma.company.findFirst({
      where: { companyKey: supplier.companyKey },
    });
    if (byKey) return byKey;
  }

  // Try company name + website
  if (supplier.company && supplier.website) {
    const byNameAndWebsite = await prisma.company.findFirst({
      where: {
        name: supplier.company,
        website: supplier.website,
      },
    });
    if (byNameAndWebsite) return byNameAndWebsite;
  }

  return null;
}
```

---

## Relationship Management

### Parent-Child Company Relationships

```typescript
// Find parent company by externalId
const parent = await prisma.company.findUnique({
  where: { externalId: supplier.parentCompanyId },
});

if (parent) {
  // Link child to parent using internal Prisma ID
  await prisma.company.update({
    where: { id: childCompany.id },
    data: { parentCompanyDbId: parent.id },
  });
}

// Query child companies
const children = await prisma.company.findMany({
  where: { parentCompanyDbId: parent.id },
});
```

### Company-Location Relationships

```typescript
// Find company by externalId, then get locations
const company = await prisma.company.findUnique({
  where: { externalId: supplier.companyId },
  include: { locations: true },
});

// Or query locations directly
const locations = await prisma.location.findMany({
  where: {
    company: {
      externalId: supplier.companyId,
    },
  },
});
```

---

## Querying by External IDs

### Find Company by External ID

```typescript
const company = await prisma.company.findUnique({
  where: { externalId: "550e8400-e29b-41d4-a716-446655440000" },
  include: {
    locations: true,
    parentCompany: true,
    childCompanies: true,
  },
});
```

### Find Location by External ID

```typescript
const location = await prisma.location.findUnique({
  where: { externalId: "660e8400-e29b-41d4-a716-446655440001" },
  include: {
    company: {
      include: {
        parentCompany: true,
      },
    },
  },
});
```

### Batch Lookup by External IDs

```typescript
const externalIds = [
  "550e8400-e29b-41d4-a716-446655440000",
  "550e8400-e29b-41d4-a716-446655440001",
  // ... more IDs
];

const companies = await prisma.company.findMany({
  where: {
    externalId: { in: externalIds },
  },
});

// Create lookup map
const companyMap = new Map(
  companies.map(c => [c.externalId!, c.id])
);
```

---

## Best Practices

### 1. Always Check for Existing Records

```typescript
// ✅ Good: Check before creating
const existing = await prisma.company.findUnique({
  where: { externalId: supplier.companyId },
});

if (!existing) {
  await prisma.company.create({ /* ... */ });
}

// ❌ Bad: Always create (causes duplicates)
await prisma.company.create({ /* ... */ });
```

### 2. Use External IDs for Cross-System References

```typescript
// ✅ Good: Store externalId for future imports/updates
{
  externalId: supplier.companyId,
  // ... other fields
}

// ❌ Bad: Only use internal IDs (loses connection to source data)
{
  // No externalId stored
}
```

### 3. Handle Missing External IDs Gracefully

```typescript
// ✅ Good: Validate and handle missing IDs
if (!supplier.companyId) {
  console.warn(`Missing companyId for ${supplier.company}`);
  // Use fallback deduplication or skip
  return;
}

// ❌ Bad: Assume IDs always exist
await prisma.company.create({
  data: {
    externalId: supplier.companyId, // Could be undefined!
  },
});
```

### 4. Preserve External IDs in Updates

```typescript
// ✅ Good: Update data but preserve externalId
await prisma.company.update({
  where: { externalId: supplier.companyId },
  data: {
    name: supplier.company, // Update name
    website: supplier.website, // Update website
    // externalId stays the same
  },
});

// ❌ Bad: Create new record instead of updating
await prisma.company.create({
  data: {
    externalId: supplier.companyId,
    // Creates duplicate if externalId already exists
  },
});
```

### 5. Use Transactions for Related Operations

```typescript
// ✅ Good: Use transaction for atomic operations
await prisma.$transaction(async (tx) => {
  const company = await tx.company.create({ /* ... */ });
  await tx.location.create({
    data: {
      companyId: company.id,
      // ...
    },
  });
});

// ❌ Bad: Separate operations (can fail partially)
const company = await prisma.company.create({ /* ... */ });
await prisma.location.create({ /* ... */ }); // Could fail, leaving orphaned company
```

---

## Common Patterns

### Pattern 1: Upsert Company

```typescript
async function upsertCompany(supplier: SupplierJson) {
  return await prisma.company.upsert({
    where: { externalId: supplier.companyId },
    update: {
      name: supplier.company,
      website: supplier.website,
      // ... update fields
    },
    create: {
      externalId: supplier.companyId,
      name: supplier.company,
      website: supplier.website,
      // ... create fields
    },
  });
}
```

### Pattern 2: Import with Relationship Resolution

```typescript
async function importWithRelations(suppliers: SupplierJson[]) {
  // Step 1: Create company map
  const companyMap = new Map<string, string>();
  
  for (const supplier of suppliers) {
    const company = await upsertCompany(supplier);
    companyMap.set(supplier.companyId, company.id);
  }

  // Step 2: Resolve parent relationships
  for (const supplier of suppliers) {
    if (supplier.parentCompanyId) {
      const parentDbId = companyMap.get(supplier.parentCompanyId);
      if (parentDbId) {
        await prisma.company.update({
          where: { id: companyMap.get(supplier.companyId)! },
          data: { parentCompanyDbId: parentDbId },
        });
      }
    }
  }

  // Step 3: Create locations
  for (const supplier of suppliers) {
    await upsertLocation(supplier, companyMap.get(supplier.companyId)!);
  }
}
```

### Pattern 3: Find or Create with Fallback

```typescript
async function findOrCreateCompanySafe(supplier: SupplierJson) {
  // Try externalId first
  if (supplier.companyId) {
    const existing = await prisma.company.findUnique({
      where: { externalId: supplier.companyId },
    });
    if (existing) return existing;
  }

  // Fallback to companyKey
  if (supplier.companyKey) {
    const byKey = await prisma.company.findFirst({
      where: { companyKey: supplier.companyKey },
    });
    if (byKey) {
      // Update with externalId if missing
      if (!byKey.externalId && supplier.companyId) {
        return await prisma.company.update({
          where: { id: byKey.id },
          data: { externalId: supplier.companyId },
        });
      }
      return byKey;
    }
  }

  // Create new
  return await prisma.company.create({
    data: {
      externalId: supplier.companyId,
      name: supplier.company,
      companyKey: supplier.companyKey,
      // ...
    },
  });
}
```

---

## Summary

**Key Takeaways:**

1. **`companyId` → `Company.externalId`** - Primary identifier for companies
2. **`locationId` → `Location.externalId`** - Primary identifier for locations
3. **`companyKey`** - Domain-based grouping key (indexed for fast lookup)
4. **`parentCompanyId` → `Company.externalParentId`** - Used during import to resolve relationships
5. **Always check for existing records** using `externalId` before creating
6. **Use three-pass import** for companies → parents → locations
7. **Preserve external IDs** for future imports and cross-system references

**Import Endpoint:** `POST /api/crm/import`

**Example Request:**
```json
{
  "suppliers": [
    {
      "companyId": "550e8400-e29b-41d4-a716-446655440000",
      "locationId": "660e8400-e29b-41d4-a716-446655440001",
      "company": "Magna International",
      "companyKey": "magna.com",
      "website": "https://www.magna.com",
      "addressRaw": "123 Main St, Detroit, MI 48201",
      "parentCompanyId": null
    }
  ]
}
```
