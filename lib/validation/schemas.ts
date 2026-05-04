/**
 * Zod Validation Schemas
 * Centralized schemas for all API input validation
 * 
 * Usage:
 * import { ContactFormSchema } from '@/lib/validation/schemas';
 * const result = ContactFormSchema.safeParse(data);
 */

import { z } from 'zod';

// ============================================================================
// COMMON PATTERNS
// ============================================================================

const uuidSchema = z.string().uuid();
const emailSchema = z.string().email().max(255);

// ============================================================================
// CONTACT FORM
// ============================================================================

export const ContactFormSchema = z.object({
  firstName: z
    .string()
    .min(1, 'First name is required')
    .max(50, 'First name must be less than 50 characters')
    .regex(/^[a-zA-Z\s\-']+$/, 'First name contains invalid characters'),
  lastName: z
    .string()
    .min(1, 'Last name is required')
    .max(50, 'Last name must be less than 50 characters')
    .regex(/^[a-zA-Z\s\-']+$/, 'Last name contains invalid characters'),
  email: emailSchema,
  company: z
    .string()
    .max(100, 'Company name must be less than 100 characters')
    .optional()
    .nullable(),
  subject: z
    .string()
    .min(1, 'Subject is required')
    .max(200, 'Subject must be less than 200 characters'),
  message: z
    .string()
    .min(10, 'Message must be at least 10 characters')
    .max(5000, 'Message must be less than 5000 characters'),
});

export type ContactForm = z.infer<typeof ContactFormSchema>;

// ============================================================================
// WORKSPACE OPERATIONS
// ============================================================================

export const CreateWorkspaceSchema = z.object({
  name: z
    .string()
    .min(1, 'Workspace name is required')
    .max(100, 'Workspace name must be less than 100 characters'),
  description: z
    .string()
    .max(500, 'Description must be less than 500 characters')
    .optional()
    .nullable(),
  industry: z.string().max(100).optional().nullable(),
});

export type CreateWorkspace = z.infer<typeof CreateWorkspaceSchema>;

// ============================================================================
// TEAM MANAGEMENT
// ============================================================================

export const CreateTeamSchema = z.object({
  name: z
    .string()
    .min(1, 'Team name is required')
    .max(100, 'Team name must be less than 100 characters'),
  description: z
    .string()
    .max(500, 'Description must be less than 500 characters')
    .optional()
    .nullable(),
  lead_id: uuidSchema.optional().nullable(),
});

export type CreateTeam = z.infer<typeof CreateTeamSchema>;

export const AddTeamMemberSchema = z.object({
  team_id: uuidSchema,
  user_id: uuidSchema,
  role: z.enum(['lead', 'member']),
});

export type AddTeamMember = z.infer<typeof AddTeamMemberSchema>;

// ============================================================================
// STORIES & TASKS
// ============================================================================

export const CreateStorySchema = z.object({
  title: z
    .string()
    .min(1, 'Title is required')
    .max(200, 'Title must be less than 200 characters'),
  description: z
    .string()
    .max(5000, 'Description must be less than 5000 characters')
    .optional()
    .nullable(),
  story_points: z
    .number()
    .int('Story points must be an integer')
    .min(1, 'Story points must be at least 1')
    .max(1000, 'Story points must be less than 1000')
    .optional()
    .nullable(),
  priority: z.enum(['low', 'medium', 'high', 'critical']).optional().nullable(),
  tags: z
    .array(z.string().max(100))
    .max(20, 'Maximum 20 tags allowed')
    .optional()
    .nullable(),
  sprint_id: uuidSchema.optional().nullable(),
  assignee_id: uuidSchema.optional().nullable(),
});

export type CreateStory = z.infer<typeof CreateStorySchema>;

export const SaveStorySchema = z.object({
  id: uuidSchema,
  title: z
    .string()
    .min(1, 'Title is required')
    .max(200, 'Title must be less than 200 characters'),
  description: z
    .string()
    .max(5000, 'Description must be less than 5000 characters')
    .optional()
    .nullable(),
  story_points: z
    .number()
    .int()
    .min(1)
    .max(1000)
    .optional()
    .nullable(),
  priority: z.enum(['low', 'medium', 'high', 'critical']).optional().nullable(),
  status: z.string().optional().nullable(),
  tags: z
    .array(z.string().max(100))
    .max(20)
    .optional()
    .nullable(),
  assignee_id: uuidSchema.optional().nullable(),
});

export type SaveStory = z.infer<typeof SaveStorySchema>;

// ============================================================================
// SPRINTS
// ============================================================================

export const CreateSprintSchema = z.object({
  name: z
    .string()
    .min(1, 'Sprint name is required')
    .max(100, 'Sprint name must be less than 100 characters'),
  start_date: z.string().datetime().optional().nullable(),
  end_date: z.string().datetime().optional().nullable(),
  goal: z
    .string()
    .max(1000, 'Goal must be less than 1000 characters')
    .optional()
    .nullable(),
});

export type CreateSprint = z.infer<typeof CreateSprintSchema>;

// ============================================================================
// ROLES & PERMISSIONS
// ============================================================================

export const CreateRoleSchema = z.object({
  name: z
    .string()
    .min(1, 'Role name is required')
    .max(100, 'Role name must be less than 100 characters'),
  description: z
    .string()
    .max(500, 'Description must be less than 500 characters')
    .optional()
    .nullable(),
  permissions: z
    .array(z.string())
    .min(1, 'At least one permission is required')
    .max(100, 'Maximum 100 permissions'),
});

export type CreateRole = z.infer<typeof CreateRoleSchema>;

// ============================================================================
// AI OPERATIONS
// ============================================================================

export const GenerateStoriesSchema = z.object({
  count: z
    .number()
    .int()
    .min(1, 'At least 1 story required')
    .max(50, 'Maximum 50 stories at a time'),
  tone: z.enum(['formal', 'casual', 'technical']).optional().default('technical'),
});

export type GenerateStories = z.infer<typeof GenerateStoriesSchema>;

export const TeamOptimizationSchema = z.object({
  stories: z
    .array(
      z.object({
        id: uuidSchema,
        title: z.string(),
        story_points: z.number().optional(),
        required_skills: z.array(z.string()).optional(),
      })
    )
    .min(1, 'At least one story required')
    .max(100, 'Maximum 100 stories at a time'),
  team_members: z
    .array(
      z.object({
        id: uuidSchema,
        name: z.string(),
        role: z.string(),
        skills: z.array(z.string()),
      })
    )
    .min(1, 'At least one team member required'),
});

export type TeamOptimization = z.infer<typeof TeamOptimizationSchema>;

// ============================================================================
// VALIDATION HELPER FUNCTION
// ============================================================================

/**
 * Safely parse and validate data against a schema
 * Returns { success: true, data } or { success: false, errors }
 */
export function validateData<T>(
  schema: z.ZodSchema<T>,
  data: unknown
): { success: true; data: T } | { success: false; errors: z.ZodError['errors'] } {
  const result = schema.safeParse(data);

  if (!result.success) {
    return {
      success: false,
      errors: result.error.errors,
    };
  }

  return {
    success: true,
    data: result.data,
  };
}
