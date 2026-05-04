/**
 * Validation Middleware
 * Express-style middleware for validating API requests
 * 
 * Usage:
 * import { validateRequest } from '@/lib/validation/middleware';
 * import { CreateStorySchema } from '@/lib/validation/schemas';
 * 
 * export async function POST(request: NextRequest) {
 *   const validation = await validateRequest(request, CreateStorySchema);
 *   if (!validation.valid) {
 *     return validation.response;
 *   }
 *   
 *   const data = validation.data;
 *   // Continue with validated data
 * }
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

interface ValidationResult<T> {
  valid: boolean;
  data?: T;
  response?: NextResponse;
  errors?: Record<string, string>;
}

/**
 * Validates request body against a Zod schema
 * Returns error response if validation fails
 */
export async function validateRequest<T>(
  request: NextRequest,
  schema: z.ZodSchema<T>
): Promise<ValidationResult<T>> {
  try {
    const body = await request.json();
    const result = schema.safeParse(body);

    if (!result.success) {
      const errors = result.error.flatten().fieldErrors;
      const errorMap: Record<string, string> = {};

      // Convert Zod errors to simple object
      for (const [field, messages] of Object.entries(errors)) {
        const messageArray = messages as string[] | undefined;
        errorMap[field] = messageArray?.[0] || 'Invalid value';
      }

      return {
        valid: false,
        response: NextResponse.json(
          {
            error: 'Validation failed',
            details: errorMap,
          },
          { status: 400 }
        ),
      };
    }

    return {
      valid: true,
      data: result.data,
    };
  } catch (error) {
    if (error instanceof SyntaxError) {
      return {
        valid: false,
        response: NextResponse.json(
          {
            error: 'Invalid JSON in request body',
          },
          { status: 400 }
        ),
      };
    }

    return {
      valid: false,
      response: NextResponse.json(
        {
          error: 'Failed to parse request',
        },
        { status: 400 }
      ),
    };
  }
}

/**
 * Validates request query parameters against a schema
 */
export async function validateQuery<T>(
  request: NextRequest,
  schema: z.ZodSchema<T>
): Promise<ValidationResult<T>> {
  try {
    const searchParams = request.nextUrl.searchParams;
    const params: Record<string, string> = {};

    searchParams.forEach((value, key) => {
      params[key] = value;
    });

    const result = schema.safeParse(params);

    if (!result.success) {
      const errors = result.error.flatten().fieldErrors;
      const errorMap: Record<string, string> = {};

      for (const [field, messages] of Object.entries(errors)) {
        const messageArray = messages as string[] | undefined;
        errorMap[field] = messageArray?.[0] || 'Invalid value';
      }

      return {
        valid: false,
        response: NextResponse.json(
          {
            error: 'Invalid query parameters',
            details: errorMap,
          },
          { status: 400 }
        ),
      };
    }

    return {
      valid: true,
      data: result.data,
    };
  } catch {
    return {
      valid: false,
      response: NextResponse.json(
        {
          error: 'Failed to parse query parameters',
        },
        { status: 400 }
      ),
    };
  }
}

/**
 * Create a validated endpoint handler
 * Automatically validates request and returns errors
 * 
 * Usage:
 * export const POST = createValidatedHandler(CreateStorySchema, async (data, request) => {
 *   // data is already validated
 *   return NextResponse.json({ success: true });
 * });
 */
export function createValidatedHandler<T>(
  schema: z.ZodSchema<T>,
  handler: (data: T, request: NextRequest) => Promise<NextResponse>
) {
  return async (request: NextRequest) => {
    const validation = await validateRequest(request, schema);

    if (!validation.valid) {
      return validation.response!;
    }

    try {
      return await handler(validation.data!, request);
    } catch (error) {
      console.error('[Handler Error]', error);
      return NextResponse.json(
        { error: 'Internal server error' },
        { status: 500 }
      );
    }
  };
}
