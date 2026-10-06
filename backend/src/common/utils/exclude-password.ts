/**
 * Copy a Prisma result and drop every `password` field, including nested users.
 * Dates and class instances are left intact. The input object is not mutated.
 */
export function excludePassword<T>(value: T): T {
  return stripPassword(value) as T;
}

function stripPassword(value: unknown): unknown {
  if (value == null || typeof value !== 'object') {
    return value;
  }
  if (value instanceof Date) {
    return value;
  }
  if (Array.isArray(value)) {
    return value.map((item) => stripPassword(item));
  }
  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) {
    return value;
  }

  const output: Record<string, unknown> = {};
  for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
    if (key === 'password') {
      continue;
    }
    output[key] = stripPassword(child);
  }
  return output;
}
