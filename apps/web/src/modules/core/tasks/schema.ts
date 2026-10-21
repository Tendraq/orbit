import { z } from "zod";

export const taskStatus = z.enum(["BACKLOG", "TODO", "IN_PROGRESS", "IN_REVIEW", "DONE"]);
export const priorityEnum = z.enum(["LOW", "MEDIUM", "HIGH", "URGENT"]);
export const dependencyType = z.enum([
  "FINISH_TO_START",
  "START_TO_START",
  "FINISH_TO_FINISH",
  "START_TO_FINISH",
]);

export const createTaskInput = z.object({
  projectId: z.string(),
  parentId: z.string().optional(), // set to make it a subtask
  title: z.string().min(1).max(200),
  status: taskStatus.optional(),
  priority: priorityEnum.optional(),
  assigneeId: z.string().nullish(),
  dueDate: z.date().nullish(),
});

export const updateTaskInput = z.object({
  taskId: z.string(),
  title: z.string().min(1).max(200).optional(),
  description: z.string().max(10000).nullish(),
  status: taskStatus.optional(),
  priority: priorityEnum.optional(),
  assigneeId: z.string().nullish(),
  startDate: z.date().nullish(),
  dueDate: z.date().nullish(),
  estimateHours: z.number().min(0).max(10000).nullish(),
  customFields: z.record(z.any()).optional(),
});
