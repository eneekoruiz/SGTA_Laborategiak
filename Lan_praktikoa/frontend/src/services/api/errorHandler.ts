/**
 * Error handling types and utilities for Frontend
 */

export interface ApiError {
  success: false;
  message: string; // Human-readable message
  error_type: string; // ValidationError, AuthError, NotFoundError, ServerError
  fields: string[]; // Field names with errors
  details?: Record<string, string>; // Field-specific error messages
  data: null;
}

export interface ParsedApiError {
  message: string;
  errorType: string;
  affectedFields: string[];
  fieldMessages: Record<string, string>;
  statusCode: number;
}

export interface ErrorContext {
  path: string;
  statusCode: number;
  timestamp: Date;
}

/**
 * Parse API error response from backend
 */
export function parseApiError(response: any, statusCode: number): ParsedApiError {
  // If response has our standard error structure
  if (response && response.success === false && response.error_type) {
    return {
      message: response.message || 'Errore ezezaguna',
      errorType: response.error_type,
      affectedFields: response.fields || [],
      fieldMessages: response.details || {},
      statusCode,
    };
  }

  // Fallback: try to extract message from standard API response
  if (response && response.message) {
    return {
      message: response.message,
      errorType: 'APIError',
      affectedFields: [],
      fieldMessages: {},
      statusCode,
    };
  }

  // Last resort: generic message
  return {
    message: getHttpErrorMessage(statusCode),
    errorType: 'HTTPError',
    affectedFields: [],
    fieldMessages: {},
    statusCode,
  };
}

/**
 * Get human-readable HTTP error message in Basque
 */
function getHttpErrorMessage(statusCode: number): string {
  const messages: Record<number, string> = {
    400: 'Eskaeraren formatua okerra da',
    401: 'Autentikazio-saioa iraungi da. Sartu berriro.',
    403: 'Ez duzu baimena baliabide hau atzitzeko',
    404: 'Ez da aurkitu baliabidea',
    408: 'Eskararen denbora amaitu da',
    422: 'Balioaren errore bat dago',
    500: 'Zerbitzarian errore bat gertatu da',
    502: 'Zerbitzaria ez dago erabilgarri',
    503: 'Zerbitzaria gaur ez dago erabilgarri',
  };

  return messages[statusCode] || `Errorea (${statusCode})`;
}

/**
 * Get network error message in Basque
 */
export function getNetworkErrorMessage(error: Error): string {
  if (error.message.includes('abort')) {
    return 'Eskararen denbora amaitu da. Konexioa apur bat geldoa dago.';
  }

  if (error.message.includes('Failed to fetch') || error.message.includes('NetworkError')) {
    return 'Zerbitzariarekin konexio errorea. Egiaztatu zure Internet konexioa.';
  }

  if (error.message.includes('CORS')) {
    return 'Baliabide eta korronte gurutzatuen policy errorea. Jarri administratzailearekin kontaktuan.';
  }

  return 'Zerbitzariarekin konexio errorea';
}

/**
 * Determine if a field has an error
 */
export function hasFieldError(fieldName: string, affectedFields: string[]): boolean {
  return affectedFields.includes(fieldName);
}

/**
 * Get error message for a specific field
 */
export function getFieldErrorMessage(
  fieldName: string,
  fieldMessages: Record<string, string>
): string | null {
  return fieldMessages[fieldName] || null;
}

/**
 * Format error message for display
 * Combines general message with field-specific details
 */
export function formatErrorMessage(parsed: ParsedApiError): string {
  if (parsed.affectedFields.length === 0) {
    return parsed.message;
  }

  // If we have specific field messages, show them
  const fieldMsgs = Object.values(parsed.fieldMessages).filter(m => m);
  if (fieldMsgs.length > 0) {
    return `${parsed.message}\n${fieldMsgs.join('\n')}`;
  }

  return parsed.message;
}

/**
 * Log error for debugging
 */
export function logError(context: ErrorContext, parsed: ParsedApiError): void {
  if (typeof console !== 'undefined') {
    console.error('[API_ERROR]', {
      timestamp: context.timestamp.toISOString(),
      path: context.path,
      statusCode: context.statusCode,
      errorType: parsed.errorType,
      message: parsed.message,
      affectedFields: parsed.affectedFields,
    });
  }
}

/**
 * Check if error is authentication-related
 */
export function isAuthError(parsed: ParsedApiError): boolean {
  return parsed.errorType === 'AuthError' || parsed.statusCode === 401;
}

/**
 * Check if error is validation-related
 */
export function isValidationError(parsed: ParsedApiError): boolean {
  return parsed.errorType === 'ValidationError' || parsed.statusCode === 422;
}

/**
 * Check if error is server error
 */
export function isServerError(parsed: ParsedApiError): boolean {
  return parsed.statusCode >= 500;
}
