<script lang="ts">
  import { fade, scale } from 'svelte/transition';
  import { sessionStatus } from '../store/ui';
  import { navigate } from '../services/router';
  import { clearAuthToken } from '../services/api/auth';

  /**
   * SessionExpiredOverlay — Professional Session Recovery
   * 
   * Displays a high-fidelity, unskippable overlay when the JWT token expires.
   * Prevents "broken" app look by blocking interactions and providing a clear path back.
   */

  function handleReturnToLogin() {
    clearAuthToken();
    sessionStatus.set('logged_out');
    navigate('/login', true);
  }
</script>

{#if $sessionStatus === 'expired'}
  <div class="overlay-backdrop" transition:fade={{ duration: 400 }}>
    <div class="modal-card" transition:scale={{ duration: 500, start: 0.9, opacity: 0 }}>
      <div class="icon-ring">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
      </div>
      
      <h2>Saioa amaitu da</h2>
      <p>Segurtasun arrazoiengatik eta zure datuak babesteko, zure konexio-saioa iraungi da.</p>
      
      <div class="info-box">
        <p>Gordetako datuak seguru daude. Sartu berriro zure kontuan jokoarekin jarraitzeko.</p>
      </div>

      <button class="primary-btn" on:click={handleReturnToLogin}>
        Saioa hasi berriro
      </button>
    </div>
  </div>
{/if}

<style>
  .overlay-backdrop {
    position: fixed;
    inset: 0;
    background: rgba(8, 14, 26, 0.92);
    backdrop-filter: blur(12px);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 100000; /* Above everything */
    padding: 2rem;
  }

  .modal-card {
    background: linear-gradient(180deg, #1e293b 0%, #0f172a 100%);
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 24px;
    padding: 3rem;
    max-width: 480px;
    width: 100%;
    text-align: center;
    box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5),
                0 0 40px rgba(59, 130, 246, 0.15);
  }

  .icon-ring {
    width: 80px;
    height: 80px;
    border-radius: 50%;
    background: rgba(239, 68, 68, 0.15);
    color: #ef4444;
    display: flex;
    align-items: center;
    justify-content: center;
    margin: 0 auto 2rem;
  }

  .icon-ring svg {
    width: 40px;
    height: 40px;
  }

  h2 {
    color: #f8fafc;
    font-size: 2rem;
    margin-bottom: 1rem;
    font-weight: 700;
  }

  p {
    color: #94a3b8;
    font-size: 1.1rem;
    line-height: 1.6;
    margin-bottom: 2rem;
  }

  .info-box {
    background: rgba(59, 130, 246, 0.1);
    border-radius: 12px;
    padding: 1rem;
    margin-bottom: 2.5rem;
  }

  .info-box p {
    margin-bottom: 0;
    font-size: 0.95rem;
    color: #60a5fa;
  }

  .primary-btn {
    background: #3b82f6;
    color: white;
    border: none;
    padding: 1rem 2.5rem;
    border-radius: 12px;
    font-weight: 600;
    font-size: 1.1rem;
    cursor: pointer;
    transition: all 0.2s;
    width: 100%;
    box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
  }

  .primary-btn:hover {
    background: #2563eb;
    transform: translateY(-2px);
    box-shadow: 0 10px 15px -3px rgba(59, 130, 246, 0.3);
  }

  .primary-btn:active {
    transform: translateY(0);
  }
</style>
