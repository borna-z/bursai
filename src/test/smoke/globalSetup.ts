import { createAdminClient, purgeStaleTestUsers, shouldRunSmoke } from "./harness";

export default async function globalSetup() {
  if (!shouldRunSmoke) return;
  const admin = createAdminClient();
  await purgeStaleTestUsers(admin);
}
