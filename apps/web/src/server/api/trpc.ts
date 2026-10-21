import { initTRPC, TRPCError } from "@trpc/server";
import superjson from "superjson";
import { db } from "@orbit/db";
import { getCurrentUser } from "@/server/auth";

// Runs for every API call: who is the user, and the database
export async function createContext() {
  const user = await getCurrentUser();
  return { db, user };
}

const t = initTRPC.context<Awaited<ReturnType<typeof createContext>>>().create({
  transformer: superjson,
});

export const router = t.router;
export const publicProcedure = t.procedure;

// Only logged-in users can call these
export const protectedProcedure = t.procedure.use(({ ctx, next }) => {
  if (!ctx.user) throw new TRPCError({ code: "UNAUTHORIZED" });
  return next({ ctx: { ...ctx, user: ctx.user } });
});
