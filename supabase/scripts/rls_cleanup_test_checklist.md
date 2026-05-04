# RLS Duplicate Policies Cleanup - Test Checklist

## Pre-Migration Checks

- [ ] Run `pre_migration_rls_verification.sql` and save output
- [ ] Verify policy counts match expected (52 total)
- [ ] Confirm helper functions exist (`is_workspace_member`, etc.)
- [ ] Take database backup/snapshot

---

## Post-Migration Verification

- [ ] Run `post_migration_rls_verification.sql`
- [ ] Verify policy counts are exactly 4 per table (28 total)
- [ ] Confirm no duplicate policies remain
- [ ] Verify helper functions still work

---

## Functional Tests

### 1. Workspace Access

| Test | Expected Result | Pass/Fail |
|------|-----------------|-----------|
| Workspace owner can view their workspace | Workspace visible in dashboard | [ ] |
| Workspace owner can update workspace name | Update succeeds | [ ] |
| Workspace owner can delete workspace | Delete succeeds (soft delete) | [ ] |
| Workspace member can view workspace | Workspace visible | [ ] |
| Workspace member CANNOT delete workspace | Operation denied | [ ] |
| Non-member CANNOT view workspace | Workspace not visible | [ ] |

### 2. Project Access

| Test | Expected Result | Pass/Fail |
|------|-----------------|-----------|
| Workspace member can view projects | Projects visible | [ ] |
| Workspace member can create project | Create succeeds | [ ] |
| Workspace member can update project | Update succeeds | [ ] |
| Workspace member can delete project | Delete succeeds | [ ] |
| Non-member CANNOT view projects | Projects not visible | [ ] |

### 3. Space Access

| Test | Expected Result | Pass/Fail |
|------|-----------------|-----------|
| Workspace member can view spaces | Spaces visible | [ ] |
| Workspace member can create space | Create succeeds | [ ] |
| Workspace member can update space | Update succeeds | [ ] |
| Non-member CANNOT view spaces | Spaces not visible | [ ] |

### 4. Sprint & Sprint Folder Access

| Test | Expected Result | Pass/Fail |
|------|-----------------|-----------|
| User can view sprint folders in their space | Folders visible | [ ] |
| User can create sprint folder | Create succeeds | [ ] |
| User can view sprints | Sprints visible | [ ] |
| User can create sprint | Create succeeds | [ ] |
| User can update sprint goal | Update succeeds | [ ] |
| User can delete sprint | Delete succeeds | [ ] |
| Non-member CANNOT view sprints | Sprints not visible | [ ] |

### 5. Status Access

| Test | Expected Result | Pass/Fail |
|------|-----------------|-----------|
| Workspace member can view statuses | Statuses visible | [ ] |
| Workspace member can create status | Create succeeds | [ ] |
| Workspace member can update status | Update succeeds | [ ] |
| Non-member CANNOT view statuses | Statuses not visible | [ ] |

### 6. Space Members Access

| Test | Expected Result | Pass/Fail |
|------|-----------------|-----------|
| Workspace member can view space members | Members visible | [ ] |
| Workspace member can add space member | Add succeeds | [ ] |
| Non-member CANNOT view space members | Members not visible | [ ] |

### 7. Workspace Member Management

| Test | Expected Result | Pass/Fail |
|------|-----------------|-----------|
| Workspace owner can view all members | Members visible | [ ] |
| Workspace owner can add new member | Add succeeds | [ ] |
| Workspace owner can update member role | Update succeeds | [ ] |
| Workspace owner can remove member | Remove succeeds | [ ] |
| Regular member CANNOT add members | Operation denied | [ ] |
| Regular member CANNOT remove others | Operation denied | [ ] |

---

## Performance Tests

| Test | Expected Result | Pass/Fail |
|------|-----------------|-----------|
| Query with many workspace members is fast | < 100ms response | [ ] |
| EXPLAIN ANALYZE shows index usage | Indexes used | [ ] |
| No excessive policy evaluation | Single policy per operation | [ ] |

---

## Rollback Test (Staging Only)

- [ ] Apply rollback migration
- [ ] Verify policy counts return to original (52)
- [ ] Run functional tests again
- [ ] Re-apply cleanup migration

---

## Sign-off

| Role | Name | Date | Approved |
|------|------|------|----------|
| Developer | | | [ ] |
| QA | | | [ ] |
| Tech Lead | | | [ ] |

---

## Notes

- All tests should be run as an authenticated user
- Use different test accounts: workspace owner, member, non-member
- Document any failures with error messages
- If rollback is needed, run `20260123_cleanup_duplicate_rls_policies_rollback.sql`
