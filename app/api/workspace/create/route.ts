/**
 * Server-side Workspace Creation API
 * 
 * POST /api/workspace/create
 * 
 * Creates a new workspace with atomic workspace + member insertion.
 * Uses service role to bypass RLS for initial setup.
 * Sets correct trial subscription status.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient, getAuthUser } from '@/lib/supabase/server';
import { verifyCsrfToken } from '@/lib/csrf-protection';

// Rate limiting: Track creation attempts per user
const creationAttempts = new Map<string, { count: number; resetAt: number }>();
const MAX_WORKSPACES_PER_HOUR = 5;
const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000; // 1 hour

// Request body validation
interface CreateWorkspaceRequest {
  name: string;
  purpose: string;
  type: string;
  category: string;
}

// Response types
interface CreateWorkspaceResponse {
  success: true;
  workspace: {
    id: string;
    workspace_id: string;
    name: string;
  };
}

interface ErrorResponse {
  success: false;
  error: string;
  code: string;
  details?: string;
}

/**
 * Validate workspace creation request data
 */
function validateRequest(data: any): { valid: boolean; error?: string } {
  if (!data.name || typeof data.name !== 'string') {
    return { valid: false, error: 'Workspace name is required' };
  }

  if (data.name.trim().length === 0) {
    return { valid: false, error: 'Workspace name cannot be empty' };
  }

  if (data.name.length > 255) {
    return { valid: false, error: 'Workspace name must be under 255 characters' };
  }

  if (!data.purpose || typeof data.purpose !== 'string') {
    return { valid: false, error: 'Purpose is required' };
  }

  if (!data.type || typeof data.type !== 'string') {
    return { valid: false, error: 'Type is required' };
  }

  if (!data.category || typeof data.category !== 'string') {
    return { valid: false, error: 'Category is required' };
  }

  return { valid: true };
}

/**
 * Check rate limiting for user
 */
function checkRateLimit(userId: string): { allowed: boolean; error?: string } {
  const now = Date.now();
  const userAttempts = creationAttempts.get(userId);

  if (!userAttempts || now > userAttempts.resetAt) {
    // First attempt or window expired
    creationAttempts.set(userId, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return { allowed: true };
  }

  if (userAttempts.count >= MAX_WORKSPACES_PER_HOUR) {
    return {
      allowed: false,
      error: `Rate limit exceeded. You can create up to ${MAX_WORKSPACES_PER_HOUR} workspaces per hour.`,
    };
  }

  // Increment count
  userAttempts.count++;
  creationAttempts.set(userId, userAttempts);
  return { allowed: true };
}

/**
 * Clean up rate limit map periodically (prevent memory leak)
 */
function cleanupRateLimitMap() {
  const now = Date.now();
  for (const [userId, data] of creationAttempts.entries()) {
    if (now > data.resetAt) {
      creationAttempts.delete(userId);
    }
  }
}

export async function POST(request: NextRequest): Promise<NextResponse<CreateWorkspaceResponse | ErrorResponse>> {
  const requestId = Math.random().toString(36).substring(7);

  try {
    // Step 1: Verify authentication using regular client
    const supabase = await createClient();
    const { user } = await getAuthUser(supabase);

    if (!user) {
      return NextResponse.json(
        {
          success: false,
          error: 'Authentication required',
          code: 'AUTH_REQUIRED',
        },
        { status: 401 }
      );
    }

    // Step 2: Parse and validate request body
    let body: CreateWorkspaceRequest;
    try {
      body = await request.json();
    } catch (e) {
      console.error(`[${requestId}] Invalid JSON:`, e);
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid request body',
          code: 'INVALID_JSON',
        },
        { status: 400 }
      );
    }

    const validation = validateRequest(body);
    if (!validation.valid) {
      return NextResponse.json(
        {
          success: false,
          error: validation.error!,
          code: 'VALIDATION_FAILED',
        },
        { status: 400 }
      );
    }

    // Step 3: Check rate limiting
    const rateLimit = checkRateLimit(user.id);
    if (!rateLimit.allowed) {
      return NextResponse.json(
        {
          success: false,
          error: rateLimit.error!,
          code: 'RATE_LIMIT_EXCEEDED',
        },
        { status: 429 }
      );
    }

    // Step 5: Call atomic workspace creation function
    // This function handles everything in a single database transaction
    const adminClient = createAdminClient();

    const { data: result, error: functionError } = await adminClient
      .rpc('create_workspace_with_defaults', {
        p_name: body.name.trim(),
        p_purpose: body.purpose,
        p_type: body.type,
        p_category: body.category,
        p_owner_id: user.id,
      });

    if (functionError) {
      console.error(`[${requestId}] Workspace creation failed:`, functionError);
      
      // Parse error to provide specific feedback
      let errorMessage = 'Failed to create workspace';
      let errorCode = 'WORKSPACE_CREATION_FAILED';
      
      if (functionError.message?.includes('already have a workspace named')) {
        errorMessage = functionError.message;
        errorCode = 'DUPLICATE_WORKSPACE';
      } else if (functionError.message?.includes('name is required')) {
        errorMessage = 'Workspace name is required';
        errorCode = 'VALIDATION_FAILED';
      } else if (functionError.message?.includes('must be under 255')) {
        errorMessage = 'Workspace name must be under 255 characters';
        errorCode = 'VALIDATION_FAILED';
      } else if (functionError.message?.includes('failed at step')) {
        // Extract which step failed for detailed error reporting
        errorMessage = functionError.message;
        errorCode = 'WORKSPACE_SETUP_FAILED';
      }

      return NextResponse.json(
        {
          success: false,
          error: errorMessage,
          code: errorCode,
          details: functionError.message,
        },
        { status: 500 }
      );
    }

    if (!result) {
      console.error(`[${requestId}] Function returned no data`);
      return NextResponse.json(
        {
          success: false,
          error: 'Workspace creation failed - no data returned',
          code: 'WORKSPACE_CREATION_FAILED',
        },
        { status: 500 }
      );
    }

    // Step 6: Periodic cleanup of rate limit map
    if (Math.random() < 0.1) {
      // 10% chance to run cleanup
      cleanupRateLimitMap();
    }


    const rpcResult = result as { workspace_id: string; workspace_short_id: string; workspace_name: string };
    return NextResponse.json({
      success: true,
      workspace: {
        id: rpcResult.workspace_id,
        workspace_id: rpcResult.workspace_short_id,
        name: rpcResult.workspace_name,
      },
    });

  } catch (error: any) {
    console.error(`[${requestId}] Unexpected error:`, error);
    return NextResponse.json(
      {
        success: false,
        error: 'An unexpected error occurred',
        code: 'INTERNAL_ERROR',
        details: error.message,
      },
      { status: 500 }
    );
  }
}
