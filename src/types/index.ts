import { z } from 'zod';

/**
 * Print action types
 */
export const printActionSchema = z.enum([
  'PRINT_START',
  'PRINT_COMPLETE',
  'PDF_SAVE',
  'PRINT_ERROR',
]);
export type PrintAction = z.infer<typeof printActionSchema>;

/**
 * Print status types
 */
export const printStatusSchema = z.enum(['SUCCESS', 'ERROR', 'INFO']);
export type PrintStatus = z.infer<typeof printStatusSchema>;

export const printTaskSchema = z.object({
  yes: z.boolean(),
  deviceName: z.string(),
  silent: z.boolean().optional(),
});
export type PrintTask = z.infer<typeof printTaskSchema>;

export const printTasksSchema = z.object({
  print: printTaskSchema,
  pdfSave: z
    .object({
      yes: z.boolean().optional(),
    })
    .optional(),
  pngSave: z
    .object({
      yes: z.boolean().optional(),
    })
    .optional(),
});
export type PrintTasks = z.infer<typeof printTasksSchema>;

/**
 * Base print settings schema
 */
export const printRequestSchema = z.object({
  printId: z.string(),
  pageNumber: z.number(),
  do: printTasksSchema,
  pageContent: z.object({
    editorCss: z.string(),
    svgFilters: z.string(),
    html: z.string(),
  }),
});
export type PrintRequest = z.infer<typeof printRequestSchema>;

/**
 * Print status message schema
 */
export const printStatusMessageSchema = z.object({
  id: z.string(),
  timestamp: z.number(),
  action: printActionSchema,
  status: printStatusSchema,
  message: z.string().optional(),
  error: z.string().optional(),
  path: z.string().optional(),
  details: z.record(z.unknown()).optional(),
});
export type PrintStatusMessage = z.infer<typeof printStatusMessageSchema>;

/**
 * Print job schema
 */
export const printJobSchema = printRequestSchema.extend({
  attempt: z.number().default(1),
  maxRetries: z.number().default(1),
});
export type PrintJob = z.infer<typeof printJobSchema>;

/**
 * Queue status update schema
 */
export const queueStatusSchema = z.object({
  queueLength: z.number(),
  isProcessing: z.boolean(),
});
export type QueueStatus = z.infer<typeof queueStatusSchema>;

/**
 * Print job completion event schema
 */
export const printCompletionEventSchema = z.object({
  printId: z.string(),
  success: z.boolean(),
  error: z.string().optional(),
});
export type PrintCompletionEvent = z.infer<typeof printCompletionEventSchema>;

/**
 * Settings snapshot schema
 */
export const settingsSnapshotSchema = z.object({
  id: z.string(),
  name: z.string(),
  timestamp: z.number(),
  editorCss: z.string(),
  svgFilters: z.string(),
  controllerValues: z.record(z.number()),
});
export type SettingsSnapshot = z.infer<typeof settingsSnapshotSchema>;

/**
 * Settings snapshot list response schema
 */
export const settingsSnapshotListResponseSchema = z.object({
  snapshots: z.array(settingsSnapshotSchema),
  success: z.boolean(),
  error: z.string().optional(),
});
export type SettingsSnapshotListResponse = z.infer<typeof settingsSnapshotListResponseSchema>;
