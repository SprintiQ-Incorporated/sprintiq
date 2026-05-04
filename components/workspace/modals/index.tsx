/**
 * Code-Split Modal Exports
 * All modals are dynamically imported to reduce initial bundle size
 * Uses next/dynamic with loading states
 * 
 * NOTE: Simplified version - only includes modals that definitely exist
 */

'use client';

import dynamic from 'next/dynamic';

// ============================================================================
// TASK MODALS
// ============================================================================

export const CreateTaskModal = dynamic(
  () => import('./create-task-modal'),
  { ssr: false }
);

export const MoveTaskModal = dynamic(
  () => import('./move-task-modal'),
  { ssr: false }
);

// ============================================================================
// WORKSPACE MODALS
// ============================================================================

export const CreateWorkspaceModal = dynamic(
  () => import('./create-workspace-modal'),
  { ssr: false }
);

export const CreateSpaceModal = dynamic(
  () => import('./create-space-modal'),
  { ssr: false }
);

export const CreateProjectModal = dynamic(
  () => import('./create-project-modal'),
  { ssr: false }
);

export const CreateSprintModal = dynamic(
  () => import('./create-sprint-modal'),
  { ssr: false }
);

// ============================================================================
// Add more modals as needed using the same pattern
// ============================================================================
