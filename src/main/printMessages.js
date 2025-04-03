/**
 * Print status action types
 * @readonly
 * @enum {string}
 */
const PRINT_ACTIONS = {
  PRINT_START: 'PRINT_START',
  PRINT_COMPLETE: 'PRINT_COMPLETE',
  PDF_SAVE: 'PDF_SAVE',
  PRINT_ERROR: 'PRINT_ERROR'
}

/**
 * Print status types
 * @readonly
 * @enum {string}
 */
const PRINT_STATUS = {
  SUCCESS: 'SUCCESS',
  ERROR: 'ERROR',
  INFO: 'INFO'
}

/**
 * Creates a standardized print status message
 * @param {string} printId - The ID of the print job
 * @param {PRINT_ACTIONS} action - The action being performed
 * @param {PRINT_STATUS} status - The status of the action
 * @param {Object} [details={}] - Additional details
 * @returns {Object} Formatted status message
 */
function createPrintStatusMessage(printId, action, status, details = {}) {
  return {
    id: printId,
    timestamp: Date.now(),
    action,
    status,
    ...details
  }
}

module.exports = {
  PRINT_ACTIONS,
  PRINT_STATUS,
  createPrintStatusMessage
}
