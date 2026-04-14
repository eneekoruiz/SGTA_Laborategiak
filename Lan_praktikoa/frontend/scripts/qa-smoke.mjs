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
    if (/CheatConsole\.svelte$/i.test(file)) {
      continue;
    }
    if (/✕|×/.test(text)) {
      offenders.push(file.replace(root + '\\', '').replaceAll('\\', '/'));
    }
  }

  return offenders;
}

function run() {
  const app = read('src/App.svelte');
  const router = read('src/AppRouter.svelte');
  const shell = read('src/components/GameShellView.svelte');
  const apiLegacy = read('src/services/api/legacy.ts');
  const storeGame = read('src/store/game.ts');
  const notifications = read('src/components/ApiErrorNotifications.svelte');
  const hud = read('src/components/GameHUD.svelte');

  const results = [];

  assertCheck(
    results,
    'Game route shell is mounted from App',
    /<GameShell\s*\/>/.test(app),
    'Checks root app delegates orchestration to GameShell component.'
  );

  assertCheck(
    results,
    'Router auth guard protects game routes',
    /targetRoute\.name === 'games'/.test(router) &&
      /targetRoute\.name === 'new-game'/.test(router) &&
      /targetRoute\.name === 'game'/.test(router) &&
      /navigate\('\/login',\s*true\)/.test(router),
    'Checks protected routes are redirected to login when unauthenticated.'
  );

  assertCheck(
    results,
    'Top HUD + status bar are present in game shell',
    /<GameHUD/.test(shell) && /class="top-status-bar"/.test(shell),
    'Checks current HUD composition is rendered from GameShellView.'
  );

  assertCheck(
    results,
    'End-month flow delegates to API service',
    /const result = await apiService\.endMonth\(gameId\)/.test(shell),
    'Checks monthly simulation is requested via API boundary.'
  );

  assertCheck(
    results,
    'Frontend does not apply local treasury buffering mutations',
    !/deductTreasury\(/.test(apiLegacy),
    'Checks write actions do not mutate treasury locally before server state sync.'
  );

  assertCheck(
    results,
    'Provider switch supports both LIVE_MODE and USE_MOCKS flags',
    /VITE_LIVE_MODE/.test(apiLegacy) && /VITE_USE_MOCKS/.test(apiLegacy),
    'Checks env-based provider switching stays easy to rewire.'
  );

  assertCheck(
    results,
    'Optional backend-to-mock fallback is explicit and toggleable',
    /VITE_BACKEND_FALLBACK_TO_MOCK/.test(apiLegacy) && /BACKEND_FALLBACK_TO_MOCK/.test(apiLegacy),
    'Checks unplug behavior is controlled by one env flag.'
  );

  assertCheck(
    results,
    'Store simulation helpers are disabled in frontend layer',
    /applyMonthlySimulation\(\)/.test(storeGame) &&
      /is disabled\. Simulation belongs to backend\/mock provider/.test(storeGame) &&
      /applyAutoGrowth\(\)/.test(storeGame),
    'Checks simulation ownership is delegated away from UI store logic.'
  );

  assertCheck(
    results,
    'UI components include icon-based controls',
    /<svg viewBox="0 0 24 24"/.test(notifications) && /corner-btn/.test(hud),
    'Checks control surfaces are present in current components.'
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
