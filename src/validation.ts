import { z } from 'zod';
import { ValidationError } from './errors';

type ValidationType = 'request' | 'response';
type SafeValidationResult<T> =
  | { success: true; data: T }
  | { success: false; error: ValidationError };

function validate<T>(schema: z.ZodType<T> | undefined, data: unknown, type: ValidationType): T {
  if (!schema) {
    return data as T;
  }

  try {
    return schema.parse(data);
  } catch (error) {
    if (error instanceof z.ZodError) {
      throw ValidationError.fromZodError(error, type);
    }
    throw error;
  }
}

function safeValidate<T>(
  schema: z.ZodType<T> | undefined,
  data: unknown,
  type: ValidationType
): SafeValidationResult<T> {
  if (!schema) {
    return { success: true, data: data as T };
  }

  try {
    const result = schema.safeParse(data);
    return result.success
      ? { success: true, data: result.data }
      : { success: false, error: ValidationError.fromZodError(result.error, type) };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return { success: false, error: ValidationError.fromZodError(error, type) };
    }
    return {
      success: false,
      error: new ValidationError('Unknown validation error', [], type),
    };
  }
}

export function validateRequest<T>(schema: z.ZodType<T> | undefined, data: unknown): T {
  return validate(schema, data, 'request');
}

export function validateResponse<T>(schema: z.ZodType<T> | undefined, data: unknown): T {
  return validate(schema, data, 'response');
}

export function safeParseRequest<T>(
  schema: z.ZodType<T> | undefined,
  data: unknown
): SafeValidationResult<T> {
  return safeValidate(schema, data, 'request');
}

export function safeParseResponse<T>(
  schema: z.ZodType<T> | undefined,
  data: unknown
): SafeValidationResult<T> {
  return safeValidate(schema, data, 'response');
}

/** @deprecated Prefer the individual validation functions. */
export function createValidator<T>(schema: z.ZodType<T> | undefined, enabled: boolean) {
  const passthrough = (data: unknown) => data as T;

  return {
    validateRequest: enabled ? (data: unknown) => validateRequest(schema, data) : passthrough,
    validateResponse: enabled ? (data: unknown) => validateResponse(schema, data) : passthrough,
    safeParseRequest: (data: unknown) => safeParseRequest(schema, data),
    safeParseResponse: (data: unknown) => safeParseResponse(schema, data),
  };
}
