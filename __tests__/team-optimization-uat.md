/**
 * Turbo Team Optimization - UAT Test Cases
 * 
 * Manual User Acceptance Testing scenarios for QA team.
 * These test cases verify the feature works correctly from an end-user perspective.
 */

# Turbo Team Optimization - UAT Test Plan

## Prerequisites
- [ ] User has Velocity or Enterprise subscription tier
- [ ] Workspace has at least 2 team members with skills defined
- [ ] Project/Sprint has at least 3 unassigned tasks
- [ ] Tasks have varying priorities and story points

---

## Test Suite 1: Access Control

### TC-1.1: Trial User Access Denied
**Steps:**
1. Log in as a Trial tier user
2. Navigate to a project with tasks
3. Click "Turbo Team" button in toolbar

**Expected Result:**
- Upgrade dialog appears
- Shows "Turbo Team Optimization" feature name
- Displays required tier: Velocity
- Contains upgrade CTA button

### TC-1.2: Launch User Access Denied
**Steps:**
1. Log in as a Launch tier user
2. Navigate to a project with tasks
3. Click "Turbo Team" button in toolbar

**Expected Result:**
- Same upgrade dialog as TC-1.1
- Feature is not accessible

### TC-1.3: Velocity User Access Granted
**Steps:**
1. Log in as a Velocity tier user
2. Navigate to a project with tasks
3. Click "Turbo Team" button in toolbar

**Expected Result:**
- Turbo Team Optimization modal opens
- AI recommendations load automatically
- No upgrade dialog shown

### TC-1.4: Enterprise User Access Granted
**Steps:**
1. Log in as an Enterprise tier user
2. Navigate to a project with tasks
3. Click "Turbo Team" button in toolbar

**Expected Result:**
- Full access to feature
- Same experience as Velocity tier

---

## Test Suite 2: UI Elements

### TC-2.1: Project View Toolbar Button
**Steps:**
1. Navigate to a project page
2. Look for "Turbo Team" button in AI tools section (desktop)

**Expected Result:**
- Button visible with UserCheck icon (blue)
- Button disabled if no tasks exist
- Button disabled if no team members exist
- Tooltip shows explanation when disabled

### TC-2.2: Sprint View Toolbar Button
**Steps:**
1. Navigate to a sprint page
2. Look for "Turbo Team" button in toolbar

**Expected Result:**
- Button visible with UserCheck icon (cyan)
- Same disabled states as TC-2.1

### TC-2.3: Mobile Dropdown Menu
**Steps:**
1. View project page on mobile viewport (< 640px)
2. Click the Brain icon dropdown
3. Look for "Turbo Team" option

**Expected Result:**
- Option visible in dropdown
- Icon and text match desktop version

### TC-2.4: Empty State - No Tasks
**Steps:**
1. Open Turbo Team on a project with 0 tasks

**Expected Result:**
- Modal shows "No Stories to Optimize" message
- Helpful guidance text displayed
- Target icon indicator

### TC-2.5: Empty State - No Team Members
**Steps:**
1. Open Turbo Team on a project with tasks but 0 team members

**Expected Result:**
- Modal shows "No Team Members Found" message
- Guidance to add team members

---

## Test Suite 3: Recommendation Generation

### TC-3.1: Load Recommendations
**Steps:**
1. Open Turbo Team modal on project with tasks and team
2. Wait for loading to complete

**Expected Result:**
- Loading spinner shown during fetch
- Recommendations appear in center panel
- Workload chart updates in left panel
- Stats appear in right panel

### TC-3.2: Recommendation Card Display
**Steps:**
1. View a recommendation card

**Expected Result:**
- Task title displayed
- Story points badge shown
- Priority badge with correct color
- Current assignee (or "Unassigned")
- Recommended assignee with avatar
- Confidence percentage badge
- Reasoning text
- Accept/Skip buttons

### TC-3.3: Confidence Level Colors
**Steps:**
1. View recommendations with varying confidence

**Expected Result:**
- 80-100%: Green badge, "High" label
- 60-79%: Yellow badge, "Medium" label
- < 60%: Red badge, "Low" label

### TC-3.4: Scoring Breakdown Tooltip
**Steps:**
1. Hover over confidence badge on a recommendation

**Expected Result:**
- Tooltip shows breakdown:
  - Skill Match %
  - Level Match %
  - Workload Score %
  - Distribution Score %

---

## Test Suite 4: User Actions

### TC-4.1: Accept Single Recommendation
**Steps:**
1. Click "Accept" (checkmark) on a recommendation

**Expected Result:**
- Card shows green "Accepted" state
- Accepted count increases in summary
- Pending count decreases

### TC-4.2: Skip Single Recommendation
**Steps:**
1. Click "Skip" (X) on a recommendation

**Expected Result:**
- Card shows gray "Skipped" state
- Skipped count increases in summary
- Pending count decreases

### TC-4.3: Undo Accept/Skip
**Steps:**
1. Accept or skip a recommendation
2. Click "Undo" button on that card

**Expected Result:**
- Card returns to default state
- Counts update accordingly

### TC-4.4: Accept All
**Steps:**
1. Click "Accept All" button in header

**Expected Result:**
- All recommendations marked as accepted
- Confirmation toast or visual feedback

### TC-4.5: Reset All
**Steps:**
1. Accept some, skip some recommendations
2. Click "Reset" button

**Expected Result:**
- All recommendations return to default state
- Counts reset to initial values

---

## Test Suite 5: Filtering

### TC-5.1: Filter by "All"
**Steps:**
1. Select "All" in filter dropdown

**Expected Result:**
- All recommendations visible
- Count matches total

### TC-5.2: Filter by "Changed"
**Steps:**
1. Select "Changed" in filter dropdown

**Expected Result:**
- Only recommendations where current != recommended assignee
- Filter badge updates

### TC-5.3: Filter by "Unassigned"
**Steps:**
1. Select "Unassigned" in filter dropdown

**Expected Result:**
- Only recommendations for unassigned tasks
- Tasks with existing assignee hidden

---

## Test Suite 6: Workload Chart

### TC-6.1: Current vs Recommended Bars
**Steps:**
1. View workload chart in left panel

**Expected Result:**
- Each team member has two bars
- Light bar: current workload
- Dark bar: after recommendations applied

### TC-6.2: Utilization Color Coding
**Steps:**
1. View bars for different utilization levels

**Expected Result:**
- < 50%: Blue
- 50-80%: Green
- 80-100%: Yellow
- > 100%: Red (overloaded)

### TC-6.3: Capacity Line
**Steps:**
1. View chart with capacity indicators

**Expected Result:**
- Vertical line at 100% capacity
- Members exceeding show red indicators

---

## Test Suite 7: Apply Assignments

### TC-7.1: Apply Accepted Recommendations
**Steps:**
1. Accept 2+ recommendations
2. Click "Apply X Assignments" button

**Expected Result:**
- Loading state during API call
- Success toast: "Turbo Team Assignments Applied"
- Toast shows count of applied tasks
- Modal closes
- Task list refreshes with new assignments

### TC-7.2: Database Updates
**Steps:**
1. Apply recommendations
2. Check task details in database/UI

**Expected Result:**
- assigned_member_id updated
- ai_assigned = true
- ai_assignment_confidence populated
- ai_assignment_reasoning stored
- ai_assignment_date set

### TC-7.3: Partial Application Failure
**Steps:**
1. Apply recommendations where one task was deleted

**Expected Result:**
- Error handling for failed task
- Successful tasks still applied
- Error message shown to user

---

## Test Suite 8: Re-analysis

### TC-8.1: Reanalyze After Changes
**Steps:**
1. View recommendations
2. Click "Reanalyze" button

**Expected Result:**
- States reset
- Fresh API call made
- New recommendations loaded
- May have different suggestions

---

## Test Suite 9: Edge Cases

### TC-9.1: Single Team Member
**Steps:**
1. Have only 1 team member
2. Open Turbo Team

**Expected Result:**
- All tasks recommended to that member
- Warning about workload concentration

### TC-9.2: No Matching Skills
**Steps:**
1. Have tasks requiring skills no team member has
2. Open Turbo Team

**Expected Result:**
- Lower confidence scores
- Skill gap warnings shown
- Still provides best-effort recommendations

### TC-9.3: All Tasks Already Assigned
**Steps:**
1. Assign all tasks manually
2. Open Turbo Team

**Expected Result:**
- "Changed" filter shows reassignment suggestions
- May suggest keeping current assignments (100% match)

### TC-9.4: Large Dataset (50+ tasks)
**Steps:**
1. Project with 50+ tasks
2. Open Turbo Team

**Expected Result:**
- Recommendations load (may take longer)
- Scrollable list handles all items
- Performance remains acceptable (< 10s)

---

## Test Suite 10: Analytics Events

### TC-10.1: Modal Open Event
**Expected Event:**
```json
{
  "event": "turbo_team_modal_opened",
  "properties": {
    "workspace_id": "...",
    "project_id": "...",
    "task_count": 10,
    "team_member_count": 3
  }
}
```

### TC-10.2: Recommendations Loaded Event
**Expected Event:**
```json
{
  "event": "turbo_team_recommendations_loaded",
  "properties": {
    "recommendation_count": 5,
    "avg_confidence": 78.5,
    "optimization_improvement": 20
  }
}
```

### TC-10.3: Assignments Applied Event
**Expected Event:**
```json
{
  "event": "turbo_team_assignments_applied",
  "properties": {
    "applied_count": 3,
    "avg_confidence": 85.2
  }
}
```

---

## Sign-off

| Tester | Date | Result | Notes |
|--------|------|--------|-------|
|        |      |        |       |

