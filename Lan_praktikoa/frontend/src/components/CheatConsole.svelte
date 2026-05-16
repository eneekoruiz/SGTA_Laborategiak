<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import { fade, slide } from 'svelte/transition';
  import { cheatConsoleOpen, cheatHistory, addCheatToHistory } from '../store/ui';
  import { SimHiriAPI as apiService } from '../services/apiService';

  export let gameId: string = '';

  const dispatch = createEventDispatcher();
  
  let inputValue = '';
  let showHelp = false;
  let historyIndex = -1;
  let logs: Array<{ type: 'input' | 'output' | 'error'; text: string; ts: number }> = [];

  // Money injection
  let moneyAmount = '50000';
  let moneyInjecting = false;

  function formatTime(ts: number): string {
    const d = new Date(ts);
    return d.toLocaleTimeString();
  }

  function addLog(type: 'input' | 'output' | 'error', text: string): void {
    logs = [...logs, { type, text, ts: Date.now() }];
    scrollToBottom();
  }

  function scrollToBottom(): void {
    setTimeout(() => {
      const container = document.querySelector('.cheat-logs');
      if (container) container.scrollTop = container.scrollHeight;
    }, 0);
  }

  async function submitCheat(): Promise<void> {
    const code = inputValue.trim();
    if (!code) return;

    addLog('input', code);
    addCheatToHistory(code);
    inputValue = '';
    historyIndex = -1;

    try {
      const result = await apiService.submitCheat(gameId, code);
      if (result.success) {
        addLog('output', result.message || 'Cheat applied');
        dispatch('cheatSubmitted', result);
      } else {
        addLog('error', result.message || 'Cheat failed');
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      addLog('error', msg);
    }
  }

  async function injectMoney(): Promise<void> {
    const amount = parseInt(moneyAmount, 10);
    if (isNaN(amount) || amount <= 0) return;

    moneyInjecting = true;
    addLog('input', `diru_injektatu ${amount}`);

    try {
      const result = await apiService.submitCheat(gameId, `diru_injektatu:${amount}`);
      if (result.success) {
        addLog('output', result.message || `§${amount} gehitu dira`);
        dispatch('cheatSubmitted', result);
      } else {
        addLog('error', result.message || 'Diru injezioak huts egin du');
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      addLog('error', msg);
    } finally {
      moneyInjecting = false;
    }
  }

  function onKeyDown(event: KeyboardEvent): void {
    if (event.key === 'Enter') {
      event.preventDefault();
      submitCheat();
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      const history = $cheatHistory;
      if (historyIndex < history.length - 1) {
        historyIndex++;
        inputValue = history[historyIndex];
      }
    } else if (event.key === 'ArrowDown') {
      event.preventDefault();
      if (historyIndex > 0) {
        historyIndex--;
        inputValue = $cheatHistory[historyIndex];
      } else if (historyIndex === 0) {
        historyIndex = -1;
        inputValue = '';
      }
    }
  }

  function close(): void {
    cheatConsoleOpen.set(false);
  }

  function clearLogs(): void {
    logs = [];
  }
</script>

{#if $cheatConsoleOpen}
  <div class="cheat-console-overlay" transition:fade={{ duration: 200 }} on:click={close} role="button" tabindex="0" on:keydown={(e) => e.key === 'Escape' && close()}>
    <div class="cheat-console" on:click|stopPropagation on:keydown|stopPropagation transition:slide={{ duration: 250, axis: 'y' }} role="dialog" aria-label="Trikimailu kontsola" tabindex="-1">
      <div class="cheat-header">
        <h3>🎮 Trikimailu kontsola</h3>
        <div class="cheat-controls">
          <button class="cheat-btn-small" on:click={() => showHelp = !showHelp} title="Laguntza">
            ❓
          </button>
          <button class="cheat-btn-small" on:click={clearLogs} title="Erregistroak garbitu">
            📋
          </button>
          <button class="cheat-btn-small" on:click={close} title="Itxi (Alt+K)">
            ✕
          </button>
        </div>
      </div>

      {#if showHelp}
        <div class="cheat-help" transition:slide>
          <div class="help-grid">
            <div class="help-item"><code>diru_injektatu X</code><span>X diru gehitzen du</span></div>
            <div class="help-item"><code>biztanleak_gehitu X</code><span>X biztanle gehitzen ditu</span></div>
            <div class="help-item"><code>teknologia_desblokeatu</code><span>Eduki guztiak desblokeatzen ditu</span></div>
            <div class="help-item"><code>zoriontasuna_max</code><span>Hiriaren zoriontasuna %100ean jarri</span></div>
            <div class="help-item"><code>kutsadura_garbitu</code><span>Aire eta ur kutsadura ezabatu</span></div>
          </div>
        </div>
      {/if}

      <div class="cheat-logs">
        {#each logs as log}
          <div class="log-line" class:error={log.type === 'error'} class:input={log.type === 'input'}>
            <span class="log-time">[{formatTime(log.ts)}]</span>
            <span class="log-type">{log.type === 'input' ? '>' : log.type === 'error' ? '❌' : '✓'}</span>
            <span class="log-text">{log.text}</span>
          </div>
        {/each}
      </div>

      <div class="cheat-input-wrapper">
        <!-- Money injection section -->
        <div class="money-inject">
          <span class="money-label">💰 Dirua gehitu:</span>
          <input
            type="number"
            class="money-input"
            placeholder="50000"
            min="1000"
            step="1000"
            bind:value={moneyAmount}
            disabled={moneyInjecting}
          />
          <button class="money-submit" on:click={injectMoney} disabled={moneyInjecting || !parseInt(moneyAmount) || parseInt(moneyAmount) <= 0}>
            {moneyInjecting ? '⏳' : 'Injektatu'}
          </button>
        </div>
      </div>

      <div class="cheat-input-wrapper">
        <input
          type="text"
          class="cheat-input"
          placeholder="Sartu trikimailu-kodea... (↑↓ historiarako, Alt+K ixteko)"
          bind:value={inputValue}
          on:keydown={onKeyDown}
        />
        <button class="cheat-submit" on:click={submitCheat} disabled={!inputValue.trim()}>
          Bidali
        </button>
      </div>
    </div>
  </div>
{/if}

<style>
  .cheat-console-overlay {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.5);
    backdrop-filter: blur(4px);
    display: flex;
    align-items: flex-end;
    justify-content: center;
    z-index: 9999;
  }

  .cheat-console {
    position: relative;
    width: 90%;
    max-width: 800px;
    height: 400px;
    background: linear-gradient(135deg, rgba(10, 11, 14, 0.95) 0%, rgba(20, 22, 30, 0.95) 100%);
    border: 1px solid rgba(100, 200, 255, 0.3);
    border-radius: 12px;
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3), inset 0 1px 1px rgba(255, 255, 255, 0.1);
    display: flex;
    flex-direction: column;
    margin-bottom: 20px;
    font-family: 'Courier New', monospace;
    color: #00ff00;
  }

  .cheat-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 12px 16px;
    border-bottom: 1px solid rgba(100, 200, 255, 0.2);
    background: rgba(0, 0, 0, 0.3);
  }

  .cheat-header h3 {
    margin: 0;
    font-size: 16px;
    font-weight: 600;
    color: #64c8ff;
  }

  .cheat-help {
    background: rgba(100, 200, 255, 0.1);
    border-bottom: 1px solid rgba(100, 200, 255, 0.2);
    padding: 12px 16px;
  }

  .help-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 8px;
  }

  .help-item {
    display: flex;
    flex-direction: column;
    font-size: 11px;
    color: rgba(100, 200, 255, 0.8);
  }

  .help-item code {
    color: #ffd700;
    font-weight: 600;
    margin-bottom: 2px;
  }

  .cheat-controls {
    display: flex;
    gap: 8px;
  }

  .cheat-btn-small {
    background: rgba(100, 200, 255, 0.15);
    border: 1px solid rgba(100, 200, 255, 0.3);
    color: #64c8ff;
    padding: 6px 10px;
    border-radius: 6px;
    cursor: pointer;
    font-size: 14px;
    transition: all 150ms ease;
  }

  .cheat-btn-small:hover {
    background: rgba(100, 200, 255, 0.25);
    box-shadow: 0 0 12px rgba(100, 200, 255, 0.3);
  }

  .cheat-logs {
    flex: 1;
    overflow-y: auto;
    padding: 12px 16px;
    background: rgba(0, 0, 0, 0.5);
    scrollbar-width: thin;
    scrollbar-color: rgba(100, 200, 255, 0.3) transparent;
  }

  .cheat-logs::-webkit-scrollbar {
    width: 8px;
  }

  .cheat-logs::-webkit-scrollbar-track {
    background: transparent;
  }

  .cheat-logs::-webkit-scrollbar-thumb {
    background: rgba(100, 200, 255, 0.3);
    border-radius: 4px;
  }

  .log-line {
    display: flex;
    gap: 8px;
    padding: 4px 0;
    font-size: 13px;
    line-height: 1.4;
    color: #00ff00;
  }

  .log-line.input {
    color: #64c8ff;
  }

  .log-line.error {
    color: #ff4444;
  }

  .log-time {
    color: rgba(100, 200, 255, 0.5);
    min-width: 100px;
    font-size: 12px;
  }

  .log-type {
    min-width: 20px;
    text-align: center;
  }

  .log-text {
    flex: 1;
    word-break: break-word;
  }

  .cheat-input-wrapper {
    display: flex;
    gap: 8px;
    padding: 12px 16px;
    border-top: 1px solid rgba(100, 200, 255, 0.2);
    background: rgba(0, 0, 0, 0.3);
  }

  .money-inject {
    display: flex;
    align-items: center;
    gap: 8px;
    flex: 1;
  }

  .money-label {
    color: #ffd700;
    font-size: 13px;
    font-weight: 500;
    white-space: nowrap;
  }

  .money-input {
    flex: 1;
    max-width: 140px;
    background: rgba(0, 0, 0, 0.4);
    border: 1px solid rgba(255, 215, 0, 0.3);
    color: #ffd700;
    padding: 8px 12px;
    border-radius: 6px;
    font-family: 'Courier New', monospace;
    font-size: 13px;
    transition: all 150ms ease;
  }

  .money-input:focus {
    outline: none;
    border-color: rgba(255, 215, 0, 0.7);
    box-shadow: 0 0 12px rgba(255, 215, 0, 0.2);
  }

  .money-input:disabled {
    opacity: 0.5;
  }

  .money-input::placeholder {
    color: rgba(255, 215, 0, 0.4);
  }

  .money-submit {
    background: linear-gradient(135deg, rgba(255, 215, 0, 0.3) 0%, rgba(255, 215, 0, 0.15) 100%);
    border: 1px solid rgba(255, 215, 0, 0.4);
    color: #ffd700;
    padding: 8px 16px;
    border-radius: 6px;
    cursor: pointer;
    font-weight: 500;
    font-size: 13px;
    transition: all 150ms ease;
  }

  .money-submit:hover:not(:disabled) {
    background: linear-gradient(135deg, rgba(255, 215, 0, 0.5) 0%, rgba(255, 215, 0, 0.3) 100%);
    box-shadow: 0 0 12px rgba(255, 215, 0, 0.3);
  }

  .money-submit:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .cheat-input {
    flex: 1;
    background: rgba(0, 0, 0, 0.4);
    border: 1px solid rgba(100, 200, 255, 0.3);
    color: #00ff00;
    padding: 8px 12px;
    border-radius: 6px;
    font-family: 'Courier New', monospace;
    font-size: 13px;
    transition: all 150ms ease;
  }

  .cheat-input:focus {
    outline: none;
    border-color: rgba(100, 200, 255, 0.7);
    box-shadow: 0 0 12px rgba(100, 200, 255, 0.2);
    background: rgba(0, 0, 0, 0.6);
  }

  .cheat-input::placeholder {
    color: rgba(100, 200, 255, 0.4);
  }

  .cheat-submit {
    background: linear-gradient(135deg, rgba(100, 200, 255, 0.3) 0%, rgba(100, 200, 255, 0.15) 100%);
    border: 1px solid rgba(100, 200, 255, 0.4);
    color: #64c8ff;
    padding: 8px 16px;
    border-radius: 6px;
    cursor: pointer;
    font-weight: 500;
    font-size: 13px;
    transition: all 150ms ease;
  }

  .cheat-submit:hover:not(:disabled) {
    background: linear-gradient(135deg, rgba(100, 200, 255, 0.5) 0%, rgba(100, 200, 255, 0.3) 100%);
    box-shadow: 0 0 12px rgba(100, 200, 255, 0.3);
  }

  .cheat-submit:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
</style>
