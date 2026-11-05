import { ValidationError } from '../errors';

function serializeQueryValue(value: unknown): string {
  if (value === null || value === undefined) {
    return '';
  }
  if (typeof value === 'string') {
    return value;
  }
  if (typeof value === 'number' || typeof value === 'bigint') {
    return value.toString();
  }
  if (typeof value === 'boolean') {
    return value ? 'true' : 'false';
  }
  if (typeof value === 'symbol') {
    return value.description ?? '';
  }
  if (typeof value === 'function') {
    return value.name;
  }
  if (value instanceof Date) {
    return value.toISOString();
  }
  return JSON.stringify(value) ?? '';
}

// A colon right after an identifier character is literal, as in AIP-136 custom methods
// (`/users:batchGet`, `/models/:name:generate`).
const PATH_PARAM = /(?<![\w$]):([A-Za-z_$][\w$]*)/g;

export function extractPathParamNames(path: string): string[] {
  return Array.from(path.matchAll(PATH_PARAM), (match) => match[1]);
}

// Empty and dot segments are rejected because they move the request to a different endpoint:
// URL parsing resolves dot segments (encoded or not), and `/users/` is not `/users/:id`.
export function replacePath(path: string, params: Record<string, unknown>): string {
  return path
    .split('/')
    .map((segment) => {
      const replaced = segment.replace(PATH_PARAM, (_, name: string) => {
        const value = Object.prototype.hasOwnProperty.call(params, name) ? params[name] : undefined;
        if (value === undefined || value === null) {
          throw new ValidationError(`Missing path parameter "${name}" for ${path}`, [], 'request');
        }
        if (
          typeof value !== 'string' &&
          typeof value !== 'number' &&
          typeof value !== 'boolean' &&
          typeof value !== 'bigint'
        ) {
          throw new ValidationError(
            `Path parameter "${name}" must be a string, number, boolean or bigint`,
            [],
            'request'
          );
        }
        return encodeURIComponent(String(value));
      });
      if (replaced !== segment && (replaced === '' || replaced === '.' || replaced === '..')) {
        throw new ValidationError(
          `Path parameter resolves to segment "${replaced}" in ${path}`,
          [],
          'request'
        );
      }
      return replaced;
    })
    .join('/');
}

// Bodies axios sends as-is and sets its own Content-Type for (multipart boundary included).
export function isNativeBody(value: unknown): boolean {
  if (typeof value !== 'object' || value === null) {
    return false;
  }
  return (
    (typeof FormData !== 'undefined' && value instanceof FormData) ||
    (typeof Blob !== 'undefined' && value instanceof Blob) ||
    (typeof URLSearchParams !== 'undefined' && value instanceof URLSearchParams) ||
    (typeof ReadableStream !== 'undefined' && value instanceof ReadableStream) ||
    value instanceof ArrayBuffer ||
    ArrayBuffer.isView(value) ||
    typeof (value as { pipe?: unknown }).pipe === 'function'
  );
}

// Build query string
export function buildQueryString(params: Record<string, unknown>): string {
  const searchParams = new URLSearchParams();

  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null) {
      if (Array.isArray(value)) {
        value.forEach((item) => searchParams.append(key, serializeQueryValue(item)));
      } else {
        searchParams.append(key, serializeQueryValue(value));
      }
    }
  }

  const queryString = searchParams.toString();
  return queryString ? `?${queryString}` : '';
}

// Build path with optional query string
export function buildUrl(path: string, query?: Record<string, unknown>): string {
  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  const queryString = query ? buildQueryString(query) : '';
  return `${cleanPath}${queryString}`;
}

// Separate path params and query params
export function separateParams(
  path: string,
  data: Record<string, unknown> | null | undefined
): { pathParams: Record<string, unknown>; queryParams: Record<string, unknown> } {
  const pathParamNames = extractPathParamNames(path);
  const pathParams: Record<string, unknown> = {};
  const queryParams: Record<string, unknown> = {};

  // Handle null/undefined data
  if (!data) {
    return { pathParams, queryParams };
  }

  for (const [key, value] of Object.entries(data)) {
    if (pathParamNames.includes(key)) {
      pathParams[key] = value;
    } else {
      queryParams[key] = value;
    }
  }

  return { pathParams, queryParams };
}

// Check if request body is needed
export function shouldHaveBody(method: string): boolean {
  return ['POST', 'PUT', 'PATCH'].includes(method.toUpperCase());
}
