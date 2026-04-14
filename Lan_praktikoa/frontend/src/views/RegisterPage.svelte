<script lang="ts">
  import { register } from '../services/apiService';
  import { navigate } from '../services/router';
  import { createFormErrorStore, applyApiErrorsToForm } from '../store/formErrors';
  import ErrorAlert from '../components/ErrorAlert.svelte';
  import FormField from '../components/FormField.svelte';

  let username = '';
  let email = '';
  let password = '';
  let confirmPassword = '';
  let loading = false;
  let error = '';
  let affectedFields: string[] = [];

  // Form-specific error store
  const formErrors = createFormErrorStore();

  function validateLocalForm(): string {
    if (!/^[A-Za-z0-9_]{3,30}$/.test(username.trim())) {
      return 'Erabiltzaile-izenak 3-30 karaktere izan behar ditu eta letrak, zenbakiak edo azpimarrak soilik eduki.';
    }

    if (!/^\S+@\S+\.\S+$/.test(email.trim())) {
      return 'Sartu baliozko posta elektroniko bat.';
    }

    if (password.length < 8) {
      return 'Pasahitzak gutxienez 8 karaktere izan behar ditu.';
    }

    if (password !== confirmPassword) {
      return 'Pasahitzak ez datoz bat.';
    }

    return '';
  }

  async function submitRegister(): Promise<void> {
    error = '';
    affectedFields = [];
    formErrors.clearAll();

    // Client-side validation first
    const validationError = validateLocalForm();
    if (validationError) {
      error = validationError;
      return;
    }

    loading = true;

    try {
      await register(username.trim(), email.trim(), password);
      // After successful registration, redirect to login to require explicit authentication
      navigate('/login', true);
    } catch (err) {
      // Extract error details from enhanced error object
      const errorFields = (err as any)?.affectedFields || [];
      const fieldMessages = (err as any)?.fieldMessages || {};

      // Set form field errors
      if (errorFields.length > 0) {
        applyApiErrorsToForm(formErrors, errorFields, fieldMessages);
        affectedFields = errorFields;
      }

      // Set main error message
      error = err instanceof Error ? err.message : 'Erregistroak huts egin du';
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
  <title>SimHiri - Erregistroa</title>
</svelte:head>

<section class="auth-shell">
  <div class="card">
    <p class="eyebrow">Kontu berria</p>
    <h1>Sortu zure SimHiri profila</h1>
    <p class="lede">Erregistratu behin, eta gero hasi edo berrabiarazi zure hiri-simulazioak partida-zerrendatik.</p>

    <ErrorAlert
      {error}
      {affectedFields}
      onDismiss={handleDismiss}
      level={affectedFields.length > 0 ? 'warning' : 'error'}
      dismissible={true}
    />

    <form on:submit|preventDefault={submitRegister} class="form">
      <FormField
        name="username"
        label="Erabiltzaile-izena"
        error={$formErrors.username || ''}
        required={true}
        hint="3-30 karaktere, letrak/zenbakiak/azpimarra"
      >
        <input
          bind:value={username}
          name="username"
          type="text"
          autocomplete="username"
          required
          minlength="3"
          maxlength="30"
          disabled={loading}
          on:input={handleInputChange}
        />
      </FormField>

      <FormField
        name="email"
        label="Posta Elektroniko-a"
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
        hint="Gutxienez 8 karaktere, letra + zenbakia"
      >
        <input
          bind:value={password}
          name="password"
          type="password"
          autocomplete="new-password"
          required
          minlength="8"
          disabled={loading}
          on:input={handleInputChange}
        />
      </FormField>

      <FormField
        name="confirmPassword"
        label="Berretsi Pasahitza"
        error={$formErrors.confirm_password || $formErrors.confirmPassword || ''}
        required={true}
      >
        <input
          bind:value={confirmPassword}
          name="confirmPassword"
          type="password"
          autocomplete="new-password"
          required
          minlength="8"
          disabled={loading}
          on:input={handleInputChange}
        />
      </FormField>

      <button class="primary" type="submit" disabled={loading}>
        {loading ? 'Kontua sortzen...' : 'Erregistratu'}
      </button>
    </form>

    <div class="links">
      <button class="link" type="button" on:click={() => navigate('/')}>Itzuli hasierara</button>
      <button class="link" type="button" on:click={() => navigate('/login')}>Dagoeneko kontu bat daukat</button>
    </div>
  </div>

  <aside class="aside">
    <h2>Balidazio-arauak</h2>
    <ul>
      <li>Erabiltzaile-izena bakarra izan behar da eta espezifikazioko formatua bete.</li>
      <li>Posta elektronikoa bezeroaren aldean egiaztatzen da eskaera bidali aurretik.</li>
      <li>Pasahitzak eta berrespenak bat etorri behar dute API deia egin aurretik.</li>
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

  .lede {
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
