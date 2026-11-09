/**
 * Utility for parsing URL paths consistently across functions
 */

export interface ParsedPath {
  resource: string;
  id?: string;
  action?: string;
}

/**
 * Parses a URL pathname into resource, id, and action components
 * 
 * Examples:
 * - "/groups" -> { resource: "groups" }
 * - "/groups/123" -> { resource: "groups", id: "123" }
 * - "/invitations/123/accept" -> { resource: "invitations", id: "123", action: "accept" }
 */
export function parsePath(pathname: string): ParsedPath {
  const parts = pathname.split('/').filter(Boolean);
  
  if (parts.length === 0) {
    return { resource: '' };
  }

  const resource = parts[0];
  const id = parts.length > 1 ? parts[1] : undefined;
  const action = parts.length > 2 ? parts[2] : undefined;

  return { resource, id, action };
}
