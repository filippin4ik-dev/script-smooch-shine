/**
 * Safely parse a string to integer, checking PostgreSQL int4 range
 * Returns null if the number is out of range or invalid
 */
export const safeParseInt = (value: string): number | null => {
  const parsed = parseInt(value, 10);
  // PostgreSQL int4 range: -2,147,483,648 to 2,147,483,647
  if (isNaN(parsed) || parsed <= 0 || parsed > 2147483647) {
    return null;
  }
  return parsed;
};

/**
 * Check if a string is a valid PostgreSQL int4 positive integer
 */
export const isValidInt4 = (value: string): boolean => {
  return safeParseInt(value) !== null;
};
