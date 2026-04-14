/**
 * Form-specific error store
 * Tracks validation errors for individual form fields
 */

import { writable, derived, get } from 'svelte/store';

export interface FormFieldError {
  field: string;
  message: string;
  timestamp: Date;
}

export interface FormErrors {
  [fieldName: string]: string;
}

/**
 * Create a form error store for a specific form
 * Usage:
 *   const loginFormErrors = createFormErrorStore();
 *   // Clear errors on retry
 *   loginFormErrors.clearAll();
 *   // Set field error
 *   loginFormErrors.setError('email', 'Invalid email format');
 *   // Get field error
 *   $: emailError = $loginFormErrors.email;
 */
export function createFormErrorStore() {
  const { subscribe, set, update } = writable<FormErrors>({});

  return {
    subscribe,

    /**
     * Set error for a specific field
     */
    setError(field: string, message: string): void {
      update((errors) => ({
        ...errors,
        [field]: message
      }));
    },

    /**
     * Set multiple errors at once
     */
    setErrors(errors: Record<string, string>): void {
      set(errors);
    },

    /**
     * Clear error for a specific field
     */
    clearError(field: string): void {
      update((errors) => {
        const copy = { ...errors };
        delete copy[field];
        return copy;
      });
    },

    /**
     * Clear all errors
     */
    clearAll(): void {
      set({});
    },

    /**
     * Check if a field has an error
     */
    hasError(field: string): boolean {
      const errors = get(writable(get({ subscribe })));
      return !!errors[field];
    },

    /**
     * Get error message for a field
     */
    getError(field: string): string | null {
      const errors = get({ subscribe });
      return errors[field] || null;
    }
  };
}

/**
 * Global form errors store
 * Can be used for any form in the app
 */
export const formErrors = createFormErrorStore();

/**
 * Derived store: Check if any field has errors
 */
export const hasAnyError = derived(
  writable(get(formErrors)),
  ($errors) => Object.keys($errors).length > 0
);

/**
 * Derived store: Get all field names with errors
 */
export const errorFields = derived(
  writable(get(formErrors)),
  ($errors) => Object.keys($errors)
);

/**
 * Helper to apply API validation errors to form
 */
export function applyApiErrorsToForm(
  formErrorStore: ReturnType<typeof createFormErrorStore>,
  affectedFields: string[],
  fieldMessages: Record<string, string>
): void {
  // Clear previous errors
  formErrorStore.clearAll();

  // Apply new errors
  for (const field of affectedFields) {
    if (fieldMessages[field]) {
      formErrorStore.setError(field, fieldMessages[field]);
    }
  }
}
