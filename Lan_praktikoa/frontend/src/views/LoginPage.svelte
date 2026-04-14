<script lang="ts">
  import { onMount } from 'svelte';
  import { getStoredAuthToken, login } from '../services/apiService';
  import { navigate } from '../services/router';
  import { createFormErrorStore, applyApiErrorsToForm } from '../store/formErrors';
  import ErrorAlert from '../components/ErrorAlert.svelte';
  import FormField from '../components/FormField.svelte';

  let email = '';
  let password = '';
  let loading = false;
  let error = '';
  let affectedFields: string[] = [];

  // Form-specific error store
  const formErrors = createFormErrorStore();

  onMount(() => {
    if (getStoredAuthToken()) {
      navigate('/games', true);
    }
  });

  async function submitLogin(): Promise<void> {
    loading = true;
    error = '';
    formErrors.clearAll();

    try {
      await login(email.trim(), password);
      navigate('/games', true);
    } catch (err) {
      // Extract error details from enhanced error object
      const statusCode = (err as any)?.statusCode || 0;
      const errorFields = (err as any)?.affectedFields || [];
      const fieldMessages = (err as any)?.fieldMessages || {};

      // Set form field errors
      if (errorFields.length > 0) {
        applyApiErrorsToForm(formErrors, errorFields, fieldMessages);
        affectedFields = errorFields;
      }

      // Set main error message
      error = err instanceof Error ? err.message : 'Saio-hasiera huts egin du';
    } finally {
      loading = false;
    }
  }

  function handleDismiss() {
    error = '';
    affectedFields = [];
    formErrors.clearAll();
  }

  function handleInputChange() {
    // Clear error on any input change
    if (error) {
      error = '';
      affectedFields = [];
      formErrors.clearAll();
    }
  }
</script>

<svelte:head>
  <title>SimHiri - Saio-hasiera</title>
</svelte:head>

<section class="auth-shell">
  <div class="card">
    <p class="eyebrow">Kontura sarbidea</p>
    <h1>Sartu zure hiri-zorroan</h1>
    <p class="lede">Erabili zure SimHiri kontua gordetako partidak, eszenatokiak eta hiri-shell bizia irekitzeko.</p>

    <ErrorAlert
      {error}
      {affectedFields}
      onDismiss={handleDismiss}
      level="warning"
      dismissible={true}
    />

    <form on:submit|preventDefault={submitLogin} class="form">
      <FormField
        name="email"
        label="Emaila"
        error={$formErrors.email || ''}
        required={true}
      >
        <input
          bind:value={email}
          name="email"
          type="email"
          autocomplete="email"
          required
          disabled={loading}
          on:input={handleInputChange}
        />
      </FormField>

      <FormField
        name="password"
        label="Pasahitza"
        error={$formErrors.password || ''}
        required={true}
      >
        <input
          bind:value={password}
          name="password"
          type="password"
          autocomplete="current-password"
          required
          minlength="8"
          disabled={loading}
          on:input={handleInputChange}
        />
      </FormField>

      <button class="primary" type="submit" disabled={loading}>
        {loading ? 'Saioa irekitzen...' : 'Sartu'}
      </button>
    </form>

    <div class="links">
      <button class="link" type="button" on:click={() => navigate('/')}>Itzuli hasierara</button>
      <button class="link" type="button" on:click={() => navigate('/register')}>Kontua sortu</button>
    </div>
  </div>

  <aside class="aside">
    <h2>Prest dagoen egoera</h2>
    <p>Autentikazioak JWT localStorage-n gordetzen du eta backend eskaera guztietan berrerabiltzen du.</p>
    <ul>
      <li>POST /api/auth/login</li>
      <li>GET /api/auth/profile</li>
      <li>Partida-zerrendara automatikoki igarotzea</li>
    </ul>
  </aside>
</section>

<style>
  .auth-shell {
    min-height: 100vh;
    padding: 32px;
    display: grid;
    grid-template-columns: minmax(320px, 520px) minmax(260px, 1fr);
    gap: 24px;
    align-items: center;
    background: linear-gradient(150deg, #0f1b2f 0%, #13233c 45%, #1d3559 100%);
    color: #f4f8ff;
  }

  .card,
  .aside {
    border-radius: 24px;
    background: rgba(9, 19, 34, 0.66);
    border: 1px solid rgba(255, 255, 255, 0.12);
    backdrop-filter: blur(18px);
    box-shadow: 0 28px 60px rgba(0, 0, 0, 0.24);
  }

  .card {
    padding: 28px;
    display: grid;
    gap: 18px;
  }

  .eyebrow {
    margin: 0;
    text-transform: uppercase;
    letter-spacing: 0.18em;
    font-size: 0.72rem;
    color: rgba(233, 241, 252, 0.65);
  }

  h1 {
    margin: 0;
    font-size: clamp(2rem, 4vw, 3.4rem);
    line-height: 1;
    letter-spacing: -0.04em;
  }

  .lede,
  .aside p {
    margin: 0;
    color: rgba(233, 241, 252, 0.78);
    line-height: 1.6;
  }

  .form {
    display: grid;
    gap: 14px;
  }

  label {
    display: grid;
    gap: 8px;
    color: rgba(233, 241, 252, 0.88);
  }

  input {
    width: 100%;
    border: 1px solid rgba(255, 255, 255, 0.14);
    border-radius: 14px;
    background: rgba(255, 255, 255, 0.06);
    color: #f4f8ff;
    padding: 13px 14px;
    font: inherit;
  }

  input:focus {
    outline: 2px solid rgba(168, 213, 186, 0.7);
    outline-offset: 2px;
  }

  .primary {
    border: 0;
    border-radius: 14px;
    padding: 13px 16px;
    background: linear-gradient(135deg, #a8d5ba, #87ceeb);
    color: #0f1b2f;
    font-weight: 700;
    cursor: pointer;
  }

  .alert {
    padding: 12px 14px;
    border-radius: 14px;
    background: rgba(252, 165, 165, 0.16);
    border: 1px solid rgba(252, 165, 165, 0.35);
    color: #ffd5d5;
  }

  .links {
    display: flex;
    flex-wrap: wrap;
    gap: 10px;
  }

  .link {
    border: 0;
    background: transparent;
    color: rgba(233, 241, 252, 0.82);
    padding: 0;
    cursor: pointer;
    text-decoration: underline;
    text-underline-offset: 0.22em;
  }

  .aside {
    padding: 28px;
    display: grid;
    gap: 12px;
  }

  .aside h2 {
    margin: 0;
    font-size: 1.1rem;
  }

  ul {
    margin: 0;
    padding-left: 18px;
    color: rgba(233, 241, 252, 0.86);
    line-height: 1.7;
  }

  @media (max-width: 980px) {
    .auth-shell {
      grid-template-columns: 1fr;
      padding: 18px;
    }
  }
</style>
