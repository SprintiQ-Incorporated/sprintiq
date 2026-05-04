# SprintIQ ID Conventions

**Version:** 2.0  
**Last Updated:** January 7, 2026  
**Status:** Production Standard

## Overview

SprintIQ uses a **dual ID system** for maximum flexibility and user experience:

| Type | Column | Format | Example | Used For |
|------|--------|--------|---------|----------|
| **UUID** | `id` | UUID v4 | `caccc78d-2e82-4fc8-98c3-62fe302a957d` | Primary keys, Foreign keys, Database relations |
| **Short ID** | `*_id` | Prefix + 8 hex | `sp_caccc78d` | URLs, Display, User-facing references |

## ID Formats

| Entity | Short ID Column | Format | Regex |
|--------|----------------|--------|-------|
| Workspace | `workspace_id` | `w` + 12 digits | `^w\d{12}$` |
| Space | `space_id` | `sp_` + 8 hex | `^sp_[a-f0-9]{8}$` |
| Project | `project_id` | `proj_` + 8 hex | `^proj_[a-f0-9]{8}$` |
| Sprint Folder | `sprint_folder_id` | `sf_` + 8 hex | `^sf_[a-f0-9]{8}$` |
| Sprint | `sprint_id` | `s_` + 8 hex | `^s_[a-f0-9]{8}$` |
| Task | `task_id` | `t_` + 8 hex | `^t_[a-f0-9]{8}$` |

## ⚠️ CRITICAL RULES

### Rule 1: Foreign Keys ALWAYS Use UUID
```typescript
// ✅ CORRECT - Foreign key uses UUID
.eq("space_id", space.id)

// ❌ WRONG - Never use short ID for foreign keys
.eq("space_id", space.space_id)
```

### Rule 2: URL Parameters Use Short IDs
```typescript
// ✅ CORRECT - URL uses short ID
`/workspace/${workspace.workspace_id}/space/${space.space_id}`

// ❌ WRONG - Never use UUID in URLs
`/workspace/${workspace.id}/space/${space.id}`
```

### Rule 3: Never Use .or() for ID Columns
```typescript
// ❌ WRONG - This causes type mismatch errors
.or(`space_id.eq.${space.id},space_id.eq.${space.space_id}`)

// ✅ CORRECT - Pick one: UUID for FK, short ID for URL param
.eq("space_id", space.id)  // For foreign key
```

### Rule 4: Never Mix ID Formats in .in() Queries
```typescript
// ❌ WRONG - Mixing UUIDs and short IDs causes 400 errors
const allSpaceIds = [...spaceUUIDs, ...spaceShortIds];
.in("space_id", allSpaceIds)

// ✅ CORRECT - Use only UUIDs for foreign key columns
const allSpaceIds = spaces.map(s => s.id); // UUIDs only
.in("space_id", allSpaceIds)
```

**Common Mistake:** Combining both ID types when batch fetching:
```typescript
// ❌ This pattern causes production bugs
const spaceInternalIds = spaces.map(s => s.id);
const spaceFriendlyIds = spaces.map(s => s.space_id);
const allIds = [...spaceInternalIds, ...spaceFriendlyIds]; // WRONG!

// ✅ Correct pattern
const spaceIds = spaces.map(s => s.id); // UUIDs only for FK queries
```

### Rule 4: Use Generated IDs
```typescript
import { generateSpaceId, generateProjectId } from '@/lib/branded-ids';

// ✅ CORRECT - Use generators
const newSpace = {
  space_id: generateSpaceId(),  // "sp_a1b2c3d4"
  name: "My Space",
};

// ❌ WRONG - Don't manually construct
const newSpace = {
  space_id: crypto.randomUUID(),  // Wrong format!
};
```

## Query Patterns

### Looking Up by URL Parameter (Short ID)
```typescript
// Space by short ID from URL
const { data: space } = await supabase
  .from("spaces")
  .select("*")
  .eq("space_id", params.spaceId)  // sp_xxxxxxxx
  .single();
```

### Looking Up Child Records by Foreign Key (UUID)
```typescript
// Projects in a space (FK relationship)
const { data: projects } = await supabase
  .from("projects")
  .select("*")
  .eq("space_id", space.id);  // UUID, NOT space.space_id
```

### Creating New Records
```typescript
import { generateProjectId } from '@/lib/branded-ids';

const { data: project } = await supabase
  .from("projects")
  .insert({
    project_id: generateProjectId(),  // proj_xxxxxxxx
    name: "New Project",
    space_id: space.id,  // UUID foreign key
    workspace_id: workspace.id,  // UUID foreign key
  })
  .select()
  .single();
```

## Database Constraints

All short ID columns have CHECK constraints:
```sql
CHECK (space_id ~ '^sp_[a-f0-9]{8}$')
CHECK (project_id ~ '^proj_[a-f0-9]{8}$')
CHECK (sprint_folder_id ~ '^sf_[a-f0-9]{8}$')
CHECK (sprint_id ~ '^s_[a-f0-9]{8}$')
CHECK (task_id ~ '^t_[a-f0-9]{8}$')
```

These constraints prevent inserting records with invalid ID formats.

## Troubleshooting

### Error: "invalid input syntax for type uuid"

**Cause:** Trying to compare a UUID column with a short ID string.

**Fix:** Use the UUID (`entity.id`) not the short ID (`entity.entity_id`).

```typescript
// ❌ Wrong
.eq("space_id", "sp_caccc78d")

// ✅ Correct
.eq("space_id", space.id) // UUID value
```

### Error: "check constraint violated"

**Cause:** Trying to insert a record with invalid short ID format.

**Fix:** Use the ID generators from `@/lib/branded-ids`.

```typescript
import { generateSpaceId } from '@/lib/branded-ids';
const spaceId = generateSpaceId(); // sp_xxxxxxxx
```

### Error: 400 Bad Request on .in() queries

**Cause:** Mixing UUID and short ID formats in array passed to `.in()` query.

**Common Pattern:**
```typescript
// ❌ This causes 400 errors
const allIds = [...spaces.map(s => s.id), ...spaces.map(s => s.space_id)];
.in("space_id", allIds) // 400 Error!
```

**Fix:** Use only UUIDs for foreign key columns:
```typescript
// ✅ Correct - use only s.id (UUID)
const spaceIds = spaces.map(s => s.id);
.in("space_id", spaceIds)
```

**Affected queries fixed in production (Jan 7, 2026):**
- `app/api/workspace/[workspaceId]/spaces/route.ts` - projects & sprint_folders
- `app/[workspaceId]/home/page.tsx` - sprints, tasks, sprint_folders  
- `app/[workspaceId]/manage/page.tsx` - projects & space_members

## Type Safety

SprintIQ provides branded types for compile-time safety:

```typescript
import { 
  UUID, 
  SpaceShortId, 
  ProjectShortId,
  isUUID,
  isSpaceShortId,
  assertUUID
} from '@/lib/branded-ids';

// Type guards prevent mixing IDs
function queryByForeignKey(spaceId: UUID) {
  // Compiler ensures you pass a UUID
}

function navigateToSpace(spaceId: SpaceShortId) {
  // Compiler ensures you pass a short ID
}

// Runtime validation
if (isSpaceShortId(value)) {
  // TypeScript knows value is SpaceShortId
}

// Assertions for critical paths
assertUUID(value, "space foreign key");
```

## Linting & Pre-commit Checks

SprintIQ enforces ID conventions via:

1. **ESLint Rules** - Warns about `.or()` patterns with ID columns
2. **Pre-commit Hooks** - Blocks commits with dangerous patterns
3. **TypeScript** - Branded types prevent type mismatches

See [.eslintrc.json](../.eslintrc.json) and [.husky/pre-commit](../.husky/pre-commit) for details.
