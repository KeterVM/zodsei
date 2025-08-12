import { z } from 'zod';
import { ValidationError } from './errors';

/**
 * Validation utility functions
 */

// Validate request data
export function validateRequest<T>(schema: z.ZodSchema<T> | undefined, data: unknown): T {
  if (!schema) {
    return data as T;
  }
  
  try {
    return schema.parse(data);
  } catch (error) {
    if (error instanceof z.ZodError) {
      throw ValidationError.fromZodError(error, 'request');
    }
    throw error;
  }
}

// Validate response data
export function validateResponse<T>(schema: z.ZodSchema<T> | undefined, data: unknown): T {
  if (!schema) {
    return data as T;
  }
  
  try {
    return schema.parse(data);
  } catch (error) {
    if (error instanceof z.ZodError) {
      throw ValidationError.fromZodError(error, 'response');
    }
    throw error;
  }
}

// Safe parse (no error throwing)
export function safeParseRequest<T>(
  schema: z.ZodSchema<T> | undefined, 
  data: unknown
): { success: true; data: T } | { success: false; error: ValidationError } {
  if (!schema) {
    return { success: true, data: data as T };
  }
  
  try {
    const result = schema.parse(data);
    return { success: true, data: result };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return { success: false, error: ValidationError.fromZodError(error, 'request') };
    }
    return { 
      success: false, 
      error: new ValidationError('Unknown validation error', [], 'request') 
    };
  }
}

// Safe parse response
export function safeParseResponse<T>(
  schema: z.ZodSchema<T> | undefined, 
  data: unknown
): { success: true; data: T } | { success: false; error: ValidationError } {
  if (!schema) {
    return { success: true, data: data as T };
  }
  
  try {
    const result = schema.parse(data);
    return { success: true, data: result };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return { success: false, error: ValidationError.fromZodError(error, 'response') };
    }
    return { 
      success: false, 
      error: new ValidationError('Unknown validation error', [], 'response') 
    };
  }
}

// Create optional validator
export function createValidator<T>(schema: z.ZodSchema<T> | undefined, enabled: boolean) {
  return {
    validateRequest: enabled 
      ? (data: unknown) => validateRequest(schema, data)
      : (data: unknown) => data as T,
    
    validateResponse: enabled 
      ? (data: unknown) => validateResponse(schema, data)
      : (data: unknown) => data as T,
    
    safeParseRequest: (data: unknown) => safeParseRequest(schema, data),
    safeParseResponse: (data: unknown) => safeParseResponse(schema, data),
  };
}
