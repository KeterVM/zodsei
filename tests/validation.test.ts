import { describe, it, expect } from 'vitest';
import { z } from 'zod';
import { 
  validateRequest, 
  validateResponse, 
  safeParseRequest, 
  safeParseResponse, 
  createValidator 
} from '../src/validation';
import { ValidationError } from '../src/errors';

describe('Validation Utilities', () => {
  const userSchema = z.object({
    id: z.string().uuid(),
    name: z.string().min(1),
    email: z.string().email(),
    age: z.number().min(0).optional()
  });

  const validUser = {
    id: '123e4567-e89b-12d3-a456-426614174000',
    name: 'John Doe',
    email: 'john@example.com',
    age: 30
  };

  const invalidUser = {
    id: 'invalid-uuid',
    name: '',
    email: 'invalid-email',
    age: -5
  };

  describe('validateRequest', () => {
    it('should validate valid request data', () => {
      const result = validateRequest(userSchema, validUser);
      expect(result).toEqual(validUser);
    });

    it('should throw ValidationError for invalid request data', () => {
      expect(() => validateRequest(userSchema, invalidUser))
        .toThrow(ValidationError);
    });

    it('should throw ValidationError with correct type for request', () => {
      try {
        validateRequest(userSchema, invalidUser);
      } catch (error) {
        expect(error).toBeInstanceOf(ValidationError);
        expect((error as ValidationError).type).toBe('request');
      }
    });

    it('should handle non-Zod errors', () => {
      const throwingSchema = {
        parse: () => {
          throw new Error('Custom error');
        }
      } as any;

      expect(() => validateRequest(throwingSchema, validUser))
        .toThrow('Custom error');
    });
  });

  describe('validateResponse', () => {
    it('should validate valid response data', () => {
      const result = validateResponse(userSchema, validUser);
      expect(result).toEqual(validUser);
    });

    it('should throw ValidationError for invalid response data', () => {
      expect(() => validateResponse(userSchema, invalidUser))
        .toThrow(ValidationError);
    });

    it('should throw ValidationError with correct type for response', () => {
      try {
        validateResponse(userSchema, invalidUser);
      } catch (error) {
        expect(error).toBeInstanceOf(ValidationError);
        expect((error as ValidationError).type).toBe('response');
      }
    });

    it('should handle non-Zod errors', () => {
      const throwingSchema = {
        parse: () => {
          throw new Error('Custom error');
        }
      } as any;

      expect(() => validateResponse(throwingSchema, validUser))
        .toThrow('Custom error');
    });
  });

  describe('safeParseRequest', () => {
    it('should return success result for valid data', () => {
      const result = safeParseRequest(userSchema, validUser);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toEqual(validUser);
      }
    });

    it('should return error result for invalid data', () => {
      const result = safeParseRequest(userSchema, invalidUser);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBeInstanceOf(ValidationError);
        expect(result.error.type).toBe('request');
      }
    });

    it('should handle non-Zod errors', () => {
      const throwingSchema = {
        parse: () => {
          throw new Error('Custom error');
        }
      } as any;

      const result = safeParseRequest(throwingSchema, validUser);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBeInstanceOf(ValidationError);
        expect(result.error.message).toBe('Unknown validation error');
        expect(result.error.type).toBe('request');
      }
    });
  });

  describe('safeParseResponse', () => {
    it('should return success result for valid data', () => {
      const result = safeParseResponse(userSchema, validUser);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toEqual(validUser);
      }
    });

    it('should return error result for invalid data', () => {
      const result = safeParseResponse(userSchema, invalidUser);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBeInstanceOf(ValidationError);
        expect(result.error.type).toBe('response');
      }
    });

    it('should handle non-Zod errors', () => {
      const throwingSchema = {
        parse: () => {
          throw new Error('Custom error');
        }
      } as any;

      const result = safeParseResponse(throwingSchema, validUser);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBeInstanceOf(ValidationError);
        expect(result.error.message).toBe('Unknown validation error');
        expect(result.error.type).toBe('response');
      }
    });
  });

  describe('createValidator', () => {
    it('should create validator with validation enabled', () => {
      const validator = createValidator(userSchema, true);
      
      // Test validateRequest
      const requestResult = validator.validateRequest(validUser);
      expect(requestResult).toEqual(validUser);
      
      expect(() => validator.validateRequest(invalidUser))
        .toThrow(ValidationError);

      // Test validateResponse
      const responseResult = validator.validateResponse(validUser);
      expect(responseResult).toEqual(validUser);
      
      expect(() => validator.validateResponse(invalidUser))
        .toThrow(ValidationError);
    });

    it('should create validator with validation disabled', () => {
      const validator = createValidator(userSchema, false);
      
      // Should return data as-is without validation
      const requestResult = validator.validateRequest(invalidUser);
      expect(requestResult).toEqual(invalidUser);
      
      const responseResult = validator.validateResponse(invalidUser);
      expect(responseResult).toEqual(invalidUser);
    });

    it('should always provide safe parse methods regardless of enabled flag', () => {
      const enabledValidator = createValidator(userSchema, true);
      const disabledValidator = createValidator(userSchema, false);
      
      // Both should have safe parse methods
      const enabledResult = enabledValidator.safeParseRequest(validUser);
      const disabledResult = disabledValidator.safeParseRequest(validUser);
      
      expect(enabledResult.success).toBe(true);
      expect(disabledResult.success).toBe(true);
      
      if (enabledResult.success && disabledResult.success) {
        expect(enabledResult.data).toEqual(validUser);
        expect(disabledResult.data).toEqual(validUser);
      }
    });

    it('should handle safe parse errors correctly', () => {
      const validator = createValidator(userSchema, true);
      
      const requestResult = validator.safeParseRequest(invalidUser);
      const responseResult = validator.safeParseResponse(invalidUser);
      
      expect(requestResult.success).toBe(false);
      expect(responseResult.success).toBe(false);
      
      if (!requestResult.success) {
        expect(requestResult.error.type).toBe('request');
      }
      if (!responseResult.success) {
        expect(responseResult.error.type).toBe('response');
      }
    });
  });

  describe('Edge Cases', () => {
    it('should handle undefined data', () => {
      const result = safeParseRequest(userSchema, undefined);
      expect(result.success).toBe(false);
    });

    it('should handle null data', () => {
      const result = safeParseResponse(userSchema, null);
      expect(result.success).toBe(false);
    });

    it('should handle empty object', () => {
      const result = safeParseRequest(userSchema, {});
      expect(result.success).toBe(false);
    });

    it('should work with simple schemas', () => {
      const stringSchema = z.string();
      const result = validateRequest(stringSchema, 'hello');
      expect(result).toBe('hello');
    });
  });
});
