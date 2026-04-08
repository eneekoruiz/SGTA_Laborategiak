<script lang="ts">
  import { navigate } from '../services/router';

  const highlights = [
    {
      title: 'Isometric city engine',
      text: 'Zoomable map, overlay heatmaps, and layered infrastructure rendering.'
    },
    {
      title: 'Scenario-driven starts',
      text: 'Choose a scenario, set a difficulty, and launch a new city in one flow.'
    },
    {
      title: 'Live management HUD',
      text: 'Budget, ordinances, rival city metrics, and monthly simulation controls.'
    }
  ];
</script>

<svelte:head>
  <title>SimHiri</title>
</svelte:head>

<section class="landing">
  <div class="backdrop"></div>
  <div class="orb orb-a"></div>
  <div class="orb orb-b"></div>

  <div class="hero">
    <p class="eyebrow">SimHiri / City Strategy Engine</p>
    <h1>Build a living city with a serious simulation core.</h1>
    <p class="lede">
      Manage zones, infrastructure, budgets, rival cities, and monthly AI turns in a single
      polished Svelte frontend.
    </p>

    <div class="actions">
      <button class="primary" on:click={() => navigate('/login')}>Log in</button>
      <button class="secondary" on:click={() => navigate('/register')}>Create account</button>
      <button class="ghost" on:click={() => navigate('/games')}>Open game list</button>
    </div>
  </div>

  <aside class="panel">
    <header>
      <span>Current stack</span>
      <strong>Frontend / Svelte / TypeScript</strong>
    </header>

    <div class="cards">
      {#each highlights as item}
        <article>
          <h2>{item.title}</h2>
          <p>{item.text}</p>
        </article>
      {/each}
    </div>

    <div class="footer-strip">
      <span>Isometric renderer</span>
      <span>Heatmap overlays</span>
      <span>Auth + game shell</span>
    </div>
  </aside>
</section>

<style>
  .landing {
    position: relative;
    min-height: 100vh;
    overflow: hidden;
    display: grid;
    grid-template-columns: minmax(0, 1.15fr) minmax(320px, 0.85fr);
    gap: 24px;
    align-items: center;
    padding: clamp(24px, 4vw, 48px);
    background:
      radial-gradient(circle at top left, rgba(123, 174, 140, 0.3), transparent 26%),
      radial-gradient(circle at 80% 25%, rgba(136, 160, 184, 0.22), transparent 28%),
      linear-gradient(160deg, #f5f7fb 0%, #e8eef5 45%, #d9e5f0 100%);
    color: #13233c;
  }

  .backdrop {
    position: absolute;
    inset: 0;
    background-image:
      linear-gradient(rgba(255, 255, 255, 0.25) 1px, transparent 1px),
      linear-gradient(90deg, rgba(255, 255, 255, 0.18) 1px, transparent 1px);
    background-size: 80px 80px;
    opacity: 0.35;
    mask-image: linear-gradient(180deg, rgba(0, 0, 0, 0.8), transparent 85%);
    pointer-events: none;
  }

  .orb {
    position: absolute;
    border-radius: 999px;
    filter: blur(12px);
    opacity: 0.6;
    pointer-events: none;
  }

  .orb-a {
    width: 340px;
    height: 340px;
    background: rgba(168, 213, 186, 0.55);
    top: -100px;
    right: 12%;
  }

  .orb-b {
    width: 240px;
    height: 240px;
    background: rgba(135, 206, 235, 0.5);
    bottom: 6%;
    left: 6%;
  }

  .hero,
  .panel {
    position: relative;
    z-index: 1;
  }

  .hero {
    display: grid;
    gap: 18px;
    max-width: 740px;
  }

  .eyebrow {
    margin: 0;
    text-transform: uppercase;
    letter-spacing: 0.24em;
    font-size: 0.72rem;
    font-weight: 700;
    color: rgba(19, 35, 60, 0.62);
  }

  h1 {
    margin: 0;
    font-size: clamp(2.8rem, 6vw, 5.6rem);
    line-height: 0.95;
    letter-spacing: -0.05em;
    max-width: 10ch;
  }

  .lede {
    margin: 0;
    max-width: 58ch;
    font-size: clamp(1rem, 1.35vw, 1.18rem);
    line-height: 1.6;
    color: rgba(19, 35, 60, 0.78);
  }

  .actions {
    display: flex;
    flex-wrap: wrap;
    gap: 12px;
    margin-top: 10px;
  }

  button {
    border: 0;
    border-radius: 999px;
    padding: 12px 18px;
    font: inherit;
    font-weight: 600;
    cursor: pointer;
    transition: transform 160ms ease, box-shadow 160ms ease, background-color 160ms ease;
  }

  button:hover {
    transform: translateY(-1px);
  }

  .primary {
    background: #13233c;
    color: #f4f8ff;
    box-shadow: 0 14px 32px rgba(19, 35, 60, 0.28);
  }

  .secondary {
    background: rgba(255, 255, 255, 0.7);
    color: #13233c;
    border: 1px solid rgba(19, 35, 60, 0.12);
  }

  .ghost {
    background: transparent;
    color: #13233c;
    border: 1px solid rgba(19, 35, 60, 0.16);
  }

  .panel {
    padding: 22px;
    border-radius: 24px;
    background: rgba(255, 255, 255, 0.66);
    border: 1px solid rgba(19, 35, 60, 0.12);
    box-shadow: 0 28px 72px rgba(19, 35, 60, 0.16);
    backdrop-filter: blur(22px) saturate(108%);
    display: grid;
    gap: 18px;
  }

  .panel header {
    display: grid;
    gap: 4px;
    color: rgba(19, 35, 60, 0.82);
  }

  .panel header span {
    font-size: 0.78rem;
    text-transform: uppercase;
    letter-spacing: 0.18em;
  }

  .panel header strong {
    font-size: 1.05rem;
  }

  .cards {
    display: grid;
    gap: 12px;
  }

  article {
    padding: 16px;
    border-radius: 18px;
    background: rgba(19, 35, 60, 0.05);
    border: 1px solid rgba(19, 35, 60, 0.08);
  }

  article h2 {
    margin: 0 0 8px;
    font-size: 1rem;
    color: #13233c;
  }

  article p {
    margin: 0;
    color: rgba(19, 35, 60, 0.72);
    line-height: 1.55;
  }

  .footer-strip {
    display: flex;
    flex-wrap: wrap;
    gap: 10px;
    font-size: 0.82rem;
    color: rgba(19, 35, 60, 0.72);
  }

  .footer-strip span {
    padding: 6px 10px;
    border-radius: 999px;
    background: rgba(19, 35, 60, 0.06);
  }

  @media (max-width: 980px) {
    .landing {
      grid-template-columns: 1fr;
      align-items: start;
    }

    h1 {
      max-width: none;
    }
  }
</style>
