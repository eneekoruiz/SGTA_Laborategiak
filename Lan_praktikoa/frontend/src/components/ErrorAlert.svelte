<script lang="ts">
  /**
   * ErrorAlert Component
   * Display error messages with field-specific highlighting
   *
   * Usage:
   *   <ErrorAlert {error} onDismiss={() => error = ''} />
   *   <ErrorAlert message="Custom error" affectedFields={['email']} />
   */

  export let error: string = '';
  export let affectedFields: string[] = [];
  export let onDismiss: (() => void) | null = null;
  export let message: string = '';
  export let level: 'warning' | 'error' | 'critical' = 'error';
  export let dismissible: boolean = true;
  export let animated: boolean = true;

  $: displayMessage = error || message;
  $: isVisible = displayMessage.length > 0;

  function handleDismiss() {
    if (onDismiss) {
      onDismiss();
    }
  }

  function getAlertClass() {
    const baseClass = 'alert';
    return `${baseClass} alert--${level}`;
  }

  function getIconType() {
    switch (level) {
      case 'warning':
        return '⚠️';
      case 'critical':
        return '🚨';
      case 'error':
      default:
        return '❌';
    }
  }
</script>

{#if isVisible}
  <div class={getAlertClass()} class:animated role="alert" aria-live="polite">
    <div class="alert__content">
      <span class="alert__icon" aria-hidden="true">{getIconType()}</span>
      <div class="alert__message-wrapper">
        <p class="alert__message">{displayMessage}</p>
        {#if affectedFields.length > 0}
          <p class="alert__fields">
            Eragengo eremuak: <strong>{affectedFields.join(', ')}</strong>
          </p>
        {/if}
      </div>
    </div>

    {#if dismissible}
      <button
        class="alert__close"
        type="button"
        aria-label="Itxi alerta"
        on:click={handleDismiss}
      >
        ✕
      </button>
    {/if}
  </div>
{/if}

<style>
  .alert {
    padding: 1rem;
    border-radius: 8px;
    margin-bottom: 1rem;
    display: flex;
    align-items: flex-start;
    gap: 1rem;
    border-left: 4px solid;
    animation: slideDown 0.3s ease-out;
  }

  @keyframes slideDown {
    from {
      opacity: 0;
      transform: translateY(-10px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }

  .alert.animated {
    animation: slideDown 0.3s ease-out;
  }

  /* Error level styles */
  .alert--error {
    background-color: #fee;
    border-left-color: #c33;
    color: #a00;
  }

  .alert--warning {
    background-color: #fef3cd;
    border-left-color: #ff9800;
    color: #664d03;
  }

  .alert--critical {
    background-color: #f8d7da;
    border-left-color: #721c24;
    color: #721c24;
  }

  .alert__content {
    display: flex;
    align-items: flex-start;
    gap: 0.75rem;
    flex: 1;
  }

  .alert__icon {
    flex-shrink: 0;
    font-size: 1.25rem;
    line-height: 1;
  }

  .alert__message-wrapper {
    flex: 1;
  }

  .alert__message {
    margin: 0;
    font-size: 0.95rem;
    font-weight: 500;
    line-height: 1.4;
  }

  .alert__fields {
    margin: 0.5rem 0 0 0;
    font-size: 0.85rem;
    opacity: 0.8;
    line-height: 1.3;
  }

  .alert__close {
    flex-shrink: 0;
    background: none;
    border: none;
    font-size: 1.25rem;
    cursor: pointer;
    color: inherit;
    opacity: 0.6;
    padding: 0;
    width: 24px;
    height: 24px;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: opacity 0.2s;
  }

  .alert__close:hover {
    opacity: 1;
  }

  .alert__close:active {
    transform: scale(0.95);
  }

  /* Dark mode support */
  @media (prefers-color-scheme: dark) {
    .alert--error {
      background-color: #3a1e1e;
      border-left-color: #ff6b6b;
      color: #ff8787;
    }

    .alert--warning {
      background-color: #3a3208;
      border-left-color: #ffa500;
      color: #ffc107;
    }

    .alert--critical {
      background-color: #3a1820;
      border-left-color: #ff4757;
      color: #ff6b7a;
    }
  }
</style>
