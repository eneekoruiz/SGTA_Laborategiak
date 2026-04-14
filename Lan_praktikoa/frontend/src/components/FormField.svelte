<script lang="ts">
  /**
   * FormField Component
   * Wrapper for form inputs that shows field-specific error messages and styling
   *
   * Usage:
   *   <FormField {label} {error} {required}>
   *     <input bind:value={email} type="email" />
   *   </FormField>
   */

  export let label: string = '';
  export let error: string = '';
  export let required: boolean = false;
  export let hint: string = '';
  export let name: string = '';

  $: hasError = error && error.length > 0;
</script>

<div class="form-field" class:has-error={hasError}>
  {#if label}
    <label for={name} class="label">
      <span>
        {label}
        {#if required}
          <span class="required" aria-label="derrigorrezkoa">*</span>
        {/if}
      </span>
    </label>
  {/if}

  <div class="input-wrapper">
    <slot />
  </div>

  {#if error}
    <p class="error-message" role="alert">
      {error}
    </p>
  {/if}

  {#if hint && !error}
    <p class="hint">
      {hint}
    </p>
  {/if}
</div>

<style>
  .form-field {
    margin-bottom: 1.5rem;
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .label {
    display: flex;
    align-items: center;
    gap: 0.25rem;
    font-weight: 500;
    font-size: 0.95rem;
    color: #333;
  }

  .required {
    color: #c33;
    font-weight: bold;
  }

  .input-wrapper {
    position: relative;
  }

  .input-wrapper :global(input),
  .input-wrapper :global(textarea),
  .input-wrapper :global(select) {
    width: 100%;
    padding: 0.75rem;
    border: 2px solid #ddd;
    border-radius: 6px;
    font-size: 1rem;
    font-family: inherit;
    transition: border-color 0.2s, box-shadow 0.2s;
  }

  .input-wrapper :global(input:focus),
  .input-wrapper :global(textarea:focus),
  .input-wrapper :global(select:focus) {
    outline: none;
    border-color: #4caf50;
    box-shadow: 0 0 0 3px rgba(76, 175, 80, 0.1);
  }

  /* Error state */
  .has-error .input-wrapper :global(input),
  .has-error .input-wrapper :global(textarea),
  .has-error .input-wrapper :global(select) {
    border-color: #c33;
    background-color: #fef5f5;
  }

  .has-error .input-wrapper :global(input:focus),
  .has-error .input-wrapper :global(textarea:focus),
  .has-error .input-wrapper :global(select:focus) {
    border-color: #c33;
    box-shadow: 0 0 0 3px rgba(204, 51, 51, 0.1);
  }

  .error-message {
    margin: 0;
    font-size: 0.85rem;
    color: #c33;
    font-weight: 500;
    display: flex;
    align-items: center;
    gap: 0.25rem;
  }

  .error-message::before {
    content: '⚠️';
    font-size: 0.9rem;
  }

  .hint {
    margin: 0;
    font-size: 0.8rem;
    color: #666;
    font-style: italic;
  }

  @media (prefers-color-scheme: dark) {
    .label {
      color: #e0e0e0;
    }

    .input-wrapper :global(input),
    .input-wrapper :global(textarea),
    .input-wrapper :global(select) {
      background-color: #2a2a2a;
      color: #e0e0e0;
      border-color: #444;
    }

    .input-wrapper :global(input:focus),
    .input-wrapper :global(textarea:focus),
    .input-wrapper :global(select:focus) {
      border-color: #66bb6a;
    }

    .has-error .input-wrapper :global(input),
    .has-error .input-wrapper :global(textarea),
    .has-error .input-wrapper :global(select) {
      border-color: #ff6b6b;
      background-color: #3a1e1e;
    }

    .hint {
      color: #999;
    }
  }
</style>