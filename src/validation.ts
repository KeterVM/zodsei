import { z } from 'zod';
import { ValidationError } from './errors';

type ValidationType = 'request' | 'response';
type SafeValidationResult<T> =
  | { success: true; data: T }
  | { success: false; error: ValidationError };

function validate<T>(run: () => T, type: ValidationType): T {
  try {
    return run();
  } catch (error) {
    if (error instanceof z.ZodError) {
      throw ValidationError.fromZodError(error, type);
    }
    throw error;
  }
}

function safeValidate<T>(
  run: () => z.ZodSafeParseResult<T>,
  type: ValidationType
): SafeValidationResult<T> {
  try {
    const result = run();
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

// Requests travel outbound, so they are encoded (output -> input), which is what makes
// codecs produce their wire form. Responses travel inbound and are parsed (input -> output).
export function validateRequest<S extends z.ZodType>(
  schema: S | undefined,
  data: unknown
): z.input<S> {
  return schema
    ? validate(() => z.encode(schema, data as z.output<S>), 'request')
    : (data as z.input<S>);
}

export function validateResponse<T>(schema: z.ZodType<T> | undefined, data: unknown): T {
  return schema ? validate(() => schema.parse(data), 'response') : (data as T);
}

export function safeParseRequest<S extends z.ZodType>(
  schema: S | undefined,
  data: unknown
): SafeValidationResult<z.input<S>> {
  return schema
    ? safeValidate(() => z.safeEncode(schema, data as z.output<S>), 'request')
    : { success: true, data: data as z.input<S> };
}

export function safeParseResponse<T>(
  schema: z.ZodType<T> | undefined,
  data: unknown
): SafeValidationResult<T> {
  return schema
    ? safeValidate(() => schema.safeParse(data), 'response')
    : { success: true, data: data as T };
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
