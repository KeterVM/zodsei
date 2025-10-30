import { z } from 'zod';

// Base error class
export class ZodseiError extends Error {
  constructor(
    message: string,
    public readonly code: string
  ) {
    super(message);
    this.name = 'ZodseiError';
  }
}

// Validation error
export class ValidationError extends ZodseiError {
  constructor(
    message: string,
    public readonly issues: z.core.$ZodIssue[],
    public readonly type: 'request' | 'response' = 'request'
  ) {
    super(message, 'VALIDATION_ERROR');
    this.name = 'ValidationError';
  }

  static fromZodError(
    error: z.ZodError,
    type: 'request' | 'response' = 'request'
  ): ValidationError {
    const message = `${type} validation failed: ${error.issues
      .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
      .join(', ')}`;

    return new ValidationError(message, error.issues, type);
  }
}

// HTTP error
export class HttpError extends ZodseiError {
  constructor(
    message: string,
    public readonly status: number,
    public readonly statusText: string,
    public readonly response?: unknown
  ) {
    super(message, 'HTTP_ERROR');
    this.name = 'HttpError';
  }

  static fromResponse(response: Response, data?: unknown): HttpError {
    const message = `HTTP ${response.status}: ${response.statusText}`;
    return new HttpError(message, response.status, response.statusText, data);
  }
}

// Network error
export class NetworkError extends ZodseiError {
  constructor(
    message: string,
    public readonly originalError: Error
  ) {
    super(message, 'NETWORK_ERROR');
    this.name = 'NetworkError';
  }
}

// Configuration error
export class ConfigError extends ZodseiError {
  constructor(message: string) {
    super(message, 'CONFIG_ERROR');
    this.name = 'ConfigError';
  }
}

// Timeout error
export class TimeoutError extends ZodseiError {
  constructor(timeout: number) {
    super(`Request timeout after ${timeout}ms`, 'TIMEOUT_ERROR');
    this.name = 'TimeoutError';
  }
}
