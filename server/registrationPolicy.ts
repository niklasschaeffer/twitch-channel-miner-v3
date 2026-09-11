export function isRegistrationOpen(
  allowRegistrationEnv: string | undefined,
  existingUserCount: number,
): boolean {
  return allowRegistrationEnv === "true" || existingUserCount === 0;
}
