"use client";

import { createTRPCReact } from "@trpc/react-query";
import type { inferRouterOutputs } from "@trpc/server";
import type { AppRouter } from "@/server/api/root";

// Use trpc.workspace.list.useQuery() etc. in client components
export const trpc = createTRPCReact<AppRouter>();

// Types of what each endpoint returns, e.g. Out["task"]["listAll"]
export type Out = inferRouterOutputs<AppRouter>;
