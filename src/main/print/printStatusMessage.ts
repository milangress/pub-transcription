import type { PrintAction, PrintStatus, PrintStatusMessage } from '../../types';

/**
 * Print status action types
 * @readonly
 */
export const PRINT_ACTIONS = {
  PRINT_START: 'PRINT_START',
  PRINT_COMPLETE: 'PRINT_COMPLETE',
  PDF_SAVE: 'PDF_SAVE',
  PRINT_ERROR: 'PRINT_ERROR',
} as const;

/**
 * Print status types
 * @readonly
 */
export const PRINT_STATUS = {
  SUCCESS: 'SUCCESS',
  ERROR: 'ERROR',
  INFO: 'INFO',
} as const;

interface PrintStatusDetails {
  message?: string;
  error?: string;
  path?: string;
  details?: Record<string, unknown>;
}

/**
 * Creates a standardized print status message
 * @param printId - The ID of the print job
 * @param action - The action being performed
 * @param status - The status of the action
 * @param details - Additional details about the print status
 * @returns Formatted status message
 */
export function createPrintStatusMessage(
  printId: string,
  action: PrintAction,
  status: PrintStatus,
  details: PrintStatusDetails = {},
): PrintStatusMessage {
  return {
    id: printId,
    timestamp: Date.now(),
    action,
    status,
    ...details,
  };
}
