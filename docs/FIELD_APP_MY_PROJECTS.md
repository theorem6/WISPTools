---
title: Field App – My Projects Integration
description: How plans are assigned to techs and shown in the field app (My Projects).
---

# Field App – "My Projects" Integration

## Overview

When a plan is approved in the Deploy module, staff can optionally **assign** it to a tech (Firebase UID or email). The field app can then show only plans assigned to the current user via the existing plans API.

## Backend

- **Approve with assign:** `POST /api/plans/:id/approve` body may include:
  - `assignedToUserId` – Firebase UID (or email) of the assigned tech
  - `assignedToName` – Display name (optional)
- Stored on the plan as `plan.deployment.assignedTo`, `plan.deployment.assignedToName`, and (if using multiple assignees) `plan.deployment.assignedTeam`.

## API

- **All plans (role-based):**  
  `GET /api/plans/mobile/:userId?role=tower-crew`  
  Returns approved/ready plans for the tenant, formatted by role.

- **My Projects only:**  
  `GET /api/plans/mobile/:userId?role=tower-crew&filter=assigned-to-me`  
  Returns only plans where `userId` is in `deployment.assignedTo`, `deployment.assignedTeam`, or `deployment.fieldTechs[].userId`.

## Field app usage

Use the existing `apiService.getPlans()` with the new option:

```ts
// My Projects (assigned to current user)
const myPlans = await apiService.getPlans(currentUserId, 'tower-crew', { filter: 'assigned-to-me' });

// All approved/ready plans (unchanged)
const allPlans = await apiService.getPlans(currentUserId, 'tower-crew');
```

**Implemented:** The Plans screen has a "My Projects" | "All Plans" segment. "My Projects" calls `getPlans(userId, role, { filter: 'assigned-to-me' })` and lists assigned plans. Plan details (tower-crew/installer) include deployment stage and field notes; techs can update stage and save notes via `updatePlanDeployment(userId, planId, { deploymentStage?, notes? })`. Backend: `PATCH /api/plans/mobile/:userId/:planId/deployment`.

## Deployment progress and notes

- **Backend:** `PATCH /api/plans/mobile/:userId/:planId/deployment`  
  Body: `{ deploymentStage?, notes?, documentation?: { notes? } }`.  
  Allowed only when the user is in `deployment.assignedTo`, `assignedTeam`, or `fieldTechs[].userId`.  
  `deploymentStage` must be one of: planning, procurement, preparation, in_progress, testing, completed, on_hold, cancelled.
- **Field app:** Plan details (tower-crew/installer) show "Progress & Notes": current stage, stage buttons (Preparation, In Progress, Testing, Completed, On Hold), field notes input, Save notes; installation photo URLs (one per line), Save photo URLs.  
  `apiService.updatePlanDeployment(userId, planId, { deploymentStage?, notes?, documentation?: { installationPhotos? } })` is used after each action.

## Deploy module

In **Plan Approval**, the form has optional fields:

- **Assign to tech (optional)** – "Firebase UID or email"; used for "My Projects".
- **Display name (optional)** – Shown in reports; recommend using the same UID the field app uses so filtering matches.

See [PROJECT_WORKFLOW_QUICK_START.md](./PROJECT_WORKFLOW_QUICK_START.md) and [PROJECT_WORKFLOW_STATUS.md](./PROJECT_WORKFLOW_STATUS.md) for full workflow status.
