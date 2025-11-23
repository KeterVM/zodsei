/**
 * Path handling utility functions
 */

// Extract path parameter names
export function extractPathParamNames(path: string): string[] {
  const matches = path.match(/:([^/]+)/g);
  return matches ? matches.map((match) => match.slice(1)) : [];
}

// Replace path parameters
export function replacePath(path: string, params: Record<string, string>): string {
  let result = path;

  for (const [key, value] of Object.entries(params)) {
    result = result.replace(`:${key}`, encodeURIComponent(value));
  }

  return result;
}

// Build query string
export function buildQueryString(params: Record<string, unknown>): string {
  const searchParams = new URLSearchParams();

  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null) {
      if (Array.isArray(value)) {
        value.forEach((item) => searchParams.append(key, String(item)));
      } else {
        searchParams.append(key, String(value));
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
): { pathParams: Record<string, string>; queryParams: Record<string, unknown> } {
  const pathParamNames = extractPathParamNames(path);
  const pathParams: Record<string, string> = {};
  const queryParams: Record<string, unknown> = {};

  // Handle null/undefined data
  if (!data) {
    return { pathParams, queryParams };
  }

  for (const [key, value] of Object.entries(data)) {
    if (pathParamNames.includes(key)) {
      pathParams[key] = String(value);
    } else {
      queryParams[key] = value;
    }
  }

  return { pathParams, queryParams };
}

// Check if request body is needed
export function shouldHaveBody(method: string): boolean {
  return !['GET', 'HEAD', 'DELETE'].includes(method.toUpperCase());
}
