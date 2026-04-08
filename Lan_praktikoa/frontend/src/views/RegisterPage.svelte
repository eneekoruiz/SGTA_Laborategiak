<script lang="ts">
  import { register } from '../services/apiService';
  import { navigate } from '../services/router';

  let username = '';
  let email = '';
  let password = '';
  let confirmPassword = '';
  let loading = false;
  let error = '';

  function validate(): string {
    if (!/^[A-Za-z0-9_]{3,30}$/.test(username.trim())) {
      return 'Username must be 3-30 characters and contain only letters, numbers, or underscores.';
    }

    if (!/^\S+@\S+\.\S+$/.test(email.trim())) {
      return 'Enter a valid email address.';
    }

    if (password.length < 8) {
      return 'Password must be at least 8 characters long.';
    }

    if (password !== confirmPassword) {
      return 'Passwords do not match.';
    }

    return '';
  }

  async function submitRegister(): Promise<void> {
    error = validate();
    if (error) return;

    loading = true;

    try {
      await register(username.trim(), email.trim(), password);
      navigate('/games', true);
    } catch (err) {
      error = err instanceof Error ? err.message : 'Registration failed';
    } finally {
      loading = false;
    }
  }
</script>

<svelte:head>
  <title>SimHiri - Register</title>
</svelte:head>

<section class="auth-shell">
  <div class="card">
    <p class="eyebrow">New account</p>
    <h1>Create your SimHiri profile</h1>
    <p class="lede">Register once, then start or resume your city simulations from the game list.</p>

    {#if error}
      <div class="alert">{error}</div>
    {/if}

    <form on:submit|preventDefault={submitRegister} class="form">
      <label>
        <span>Username</span>
        <input bind:value={username} name="username" autocomplete="username" required minlength="3" maxlength="30" />
      </label>

      <label>
        <span>Email</span>
        <input bind:value={email} name="email" type="email" autocomplete="email" required />
      </label>

      <label>
        <span>Password</span>
        <input bind:value={password} name="password" type="password" autocomplete="new-password" required minlength="8" />
      </label>

      <label>
        <span>Confirm password</span>
        <input bind:value={confirmPassword} name="confirmPassword" type="password" autocomplete="new-password" required minlength="8" />
      </label>

      <button class="primary" type="submit" disabled={loading}>{loading ? 'Creating account...' : 'Register'}</button>
    </form>

    <div class="links">
      <button class="link" type="button" on:click={() => navigate('/')}>Back to landing</button>
      <button class="link" type="button" on:click={() => navigate('/login')}>I already have an account</button>
    </div>
  </div>

  <aside class="aside">
    <h2>Validation rules</h2>
    <ul>
      <li>Username must be unique and fit the spec format.</li>
      <li>Email is checked client-side before request submission.</li>
      <li>Password and confirmation must match before the API call runs.</li>
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
