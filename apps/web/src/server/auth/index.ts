import { auth, currentUser } from "@clerk/nextjs/server";
import { db } from "@orbit/db";

/**
 * Returns the logged-in user from OUR database.
 * On first visit, creates the row from the Clerk account.
 */
export async function getCurrentUser() {
  const { userId: clerkId } = await auth();
  if (!clerkId) return null;

  const existing = await db.user.findUnique({ where: { clerkId } });
  if (existing) return existing;

  const clerkUser = await currentUser();
  return db.user.create({
    data: {
      clerkId,
      email: clerkUser?.emailAddresses[0]?.emailAddress ?? `${clerkId}@unknown.local`,
      name: clerkUser?.fullName ?? null,
      imageUrl: clerkUser?.imageUrl ?? null,
    },
  });
}
