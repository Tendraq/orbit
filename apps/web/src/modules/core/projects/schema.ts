import { z } from "zod";

export const statusEnum = z.enum(["ACTIVE", "ON_HOLD", "COMPLETED", "CANCELLED"]);
export const healthEnum = z.enum(["GREEN", "AMBER", "RED"]);

export const createProjectInput = z.object({
  workspaceSlug: z.string(),
  name: z.string().min(2).max(120),
  code: z.string().max(20).optional(),
  description: z.string().max(4000).optional(),
  currency: z.string().length(3).default("USD"),
  startDate: z.date().nullish(),
  endDate: z.date().nullish(),
});

export const updateProjectInput = z.object({
  projectId: z.string(),
  name: z.string().min(2).max(120).optional(),
  code: z.string().max(20).nullish(),
  description: z.string().max(4000).nullish(),
  currency: z.string().length(3).optional(),
  startDate: z.date().nullish(),
  endDate: z.date().nullish(),
  status: statusEnum.optional(),
  health: healthEnum.optional(),
  customFields: z.record(z.any()).optional(),
});
