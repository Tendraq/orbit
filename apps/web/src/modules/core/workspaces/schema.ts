import { z } from "zod";

export const sectorEnum = z.enum(["GENERAL", "NGO", "AGENCY", "CONSTRUCTION", "IT_SERVICES"]);
export const roleEnum = z.enum(["OWNER", "ADMIN", "MEMBER", "GUEST"]);

export const createWorkspaceInput = z.object({
  name: z.string().min(2).max(80),
  slug: z
    .string()
    .min(2)
    .max(40)
    .regex(/^[a-z0-9-]+$/, "Use lowercase letters, numbers and dashes only"),
  sector: sectorEnum.default("GENERAL"),
});

export const updateSettingsInput = z.object({
  slug: z.string(),
  name: z.string().min(2).max(80).optional(),
  sector: sectorEnum.optional(),
  enabledModules: z.array(z.string()).optional(),
  terminology: z.record(z.string()).optional(),
});
