# Shared Plans Feature

This document explains how to use the shared plans feature in the Schedule application.

## Overview

The shared plans feature allows users to share their plans with other users in the system. When a plan is shared, the recipient can view the plan and its tasks, but cannot modify them (read-only access).

## How to Share a Plan

1. Open the plan details by clicking on a plan in the calendar view
2. Click the "Share" button (👤 icon) in the plan detail modal
3. Enter the email address of the user you want to share the plan with
4. Click "Share Plan"

## How to Unshare a Plan

1. Open the plan details by clicking on a plan in the calendar view
2. Click the "Share" button (👤 icon) in the plan detail modal
3. Find the user in the "Shared With" list
4. Click the "Unshare" button (❌ icon) next to the user

## Technical Implementation

### Database Schema

The shared plans feature uses a new table called `shared_plans` with the following structure:

```sql
CREATE TABLE IF NOT EXISTS shared_plans (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  plan_id INTEGER NOT NULL,
  owner_id INTEGER NOT NULL,
  shared_with_user_id INTEGER NOT NULL,
  permissions TEXT DEFAULT 'read',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (plan_id) REFERENCES plans (id) ON DELETE CASCADE,
  FOREIGN KEY (owner_id) REFERENCES users (id) ON DELETE CASCADE,
  FOREIGN KEY (shared_with_user_id) REFERENCES users (id) ON DELETE CASCADE,
  UNIQUE(plan_id, shared_with_user_id)
);
```

### API Endpoints

1. `POST /api/plans/:id/share` - Share a plan with another user
2. `POST /api/plans/:id/unshare` - Unshare a plan with a user
3. `GET /api/plans/:id/shared-users` - Get users a plan is shared with

### Frontend Components

1. `SharePlanModal` - Modal for sharing plans
2. Updated `PlanDetailModal` - Added share button and functionality

## Limitations

- Currently, only read-only permissions are supported
- Users can only share plans they own (not plans shared with them)
- Shared plans appear in the recipient's plan list with a "Shared with you" badge