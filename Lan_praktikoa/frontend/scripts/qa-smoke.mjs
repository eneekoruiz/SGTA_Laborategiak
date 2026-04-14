import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, extname } from 'node:path';

const root = process.cwd();

function read(relPath) {
  return readFileSync(join(root, relPath), 'utf8');
}

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    const st = statSync(full);
    if (st.isDirectory()) {
      walk(full, out);
    } else {
      out.push(full);
    }
  }
  return out;
}

function assertCheck(results, name, ok, details) {
  results.push({ name, ok, details });
}

function scanForCloseGlyphs(dirPath) {
  const files = walk(join(root, dirPath)).filter((f) => extname(f) === '.svelte');
  const offenders = [];

  for (const file of files) {
    const text = readFileSync(file, 'utf8');
    if (/✕|×/.test(text)) {
      offenders.push(file.replace(root + '\\', '').replaceAll('\\', '/'));
    }
  }

  return offenders;
}

function run() {
  const app = read('src/App.svelte');
  const api = read('src/services/apiService.ts');
  const modal = read('src/components/FloatingModal.svelte');
  const drawer = read('src/components/SlidingDrawer.svelte');
  const notifications = read('src/components/ApiErrorNotifications.svelte');

  const results = [];

  assertCheck(
    results,
    'Exit button and leave confirmation exist',
    /Back to Menu/.test(app) &&
      /Do you want to save before leaving\?/.test(app) &&
      /Save and Leave/.test(app) &&
      /Leave without Saving/.test(app),
    'Checks App UI copy and confirmation actions.'
  );

  assertCheck(
    results,
    'Exit routing uses router navigation',
    /navigate\(getExitPath\(\),\s*true\)/.test(app),
    'Ensures explicit route transition on exit flow.'
  );

  assertCheck(
    results,
    'Save gives explicit success feedback',
    /pushToast\('Game Saved',\s*'success'\)/.test(app),
    'Checks save success toast copy.'
  );

  const simBlockChecks = [
    /\{#if endMonthPending\}\s*<div class="sim-blocker"/.test(app),
    /if \(endMonthPending\) return;/.test(app),
    /if \(endMonthPending\) \{\s*event\.preventDefault\(\);\s*return;\s*\}/.test(app)
  ];
  assertCheck(
    results,
    'Simulation blocking prevents interaction',
    simBlockChecks.every(Boolean),
    'Checks blocker overlay and event/tool guards during simulation.'
  );

  assertCheck(
    results,
    'RCI reacts to tile/store population-job dynamics',
    /function updateStatsFromTiles\(\)/.test(app) &&
      /rci_demand:\s*\{\s*r:\s*rDemand,\s*c:\s*cDemand,\s*i:\s*iDemand\s*\}/s.test(app) &&
      /rci=\{\$stats\.player\.rci_demand\}/.test(app),
    'Checks RCI recompute and HUD binding.'
  );

  assertCheck(
    results,
    'Population milestone notifications are implemented',
    /populationMilestones/.test(app) && /maybeNotifyPopulationMilestone/.test(app),
    'Checks milestone map + notifier hook.'
  );

  assertCheck(
    results,
    '401 handling redirects to login',
    /response\.status\s*===\s*401/.test(api) && /navigate\('\/login',\s*true\)/.test(api),
    'Checks auth expiration redirect path.'
  );

  assertCheck(
    results,
    'Underground mode keeps HUD rendered',
    /<GameHUD/.test(app) && !/\{#if\s*!?\$?undergroundMode\}[\s\S]*<GameHUD/.test(app),
    'Checks HUD is not gated behind underground mode.'
  );

  assertCheck(
    results,
    'Close controls use icon buttons (no text X)',
    /<svg viewBox="0 0 24 24"/.test(modal) &&
      /<svg viewBox="0 0 24 24"/.test(drawer) &&
      /<svg viewBox="0 0 24 24"/.test(notifications),
    'Checks close buttons were migrated to SVG icon controls.'
  );

  const glyphOffenders = scanForCloseGlyphs('src');
  assertCheck(
    results,
    'No close-glyph X marks left in Svelte UI files',
    glyphOffenders.length === 0,
    glyphOffenders.length ? `Found in: ${glyphOffenders.join(', ')}` : 'No offending glyphs detected.'
  );

  const failed = results.filter((r) => !r.ok);

  console.log('SimHiri Frontend QA Smoke Checks');
  console.log('================================');
  for (const r of results) {
    console.log(`${r.ok ? 'PASS' : 'FAIL'}: ${r.name}`);
    console.log(`  -> ${r.details}`);
  }

  if (failed.length > 0) {
    console.error(`\nResult: ${failed.length} check(s) failed.`);
    process.exit(1);
  }

  console.log(`\nResult: ${results.length}/${results.length} checks passed.`);
}

run();
