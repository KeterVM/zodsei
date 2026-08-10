/**
 * Request handling utility functions
 *
 * Note: This file contains utility functions that were originally designed
 * for general HTTP request handling, but are now handled by individual adapters.
 * These functions are kept for backward compatibility and potential future use.
 */

/** @deprecated Merge headers directly with object spread syntax. */
export function mergeHeaders(
  defaultHeaders: Record<string, string>,
  requestHeaders?: Record<string, string>
): Record<string, string> {
  return {
    ...defaultHeaders,
    ...requestHeaders,
  };
}
