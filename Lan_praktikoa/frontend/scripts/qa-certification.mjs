import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { mockApiService, mockGameState } from '../src/services/mockApiService.ts';

const GAME_ID = 'game-qa-cert';
const START_SNAPSHOT = deepClone(mockGameState);

function deepClone(value) {
  return JSON.parse(JSON.stringify(value));
}

function restoreObject(target, source) {
  for (const key of Object.keys(target)) {
    delete target[key];
  }
  Object.assign(target, deepClone(source));
}

function resetState() {
  restoreObject(mockGameState, START_SNAPSHOT);
  mockGameState._id = GAME_ID;
}

function tilesFlat() {
  return mockGameState.map.tiles.flat();
}

function findFreeGrassTile() {
  const tile = tilesFlat().find((t) => t.terrain_type === 'grass' && !t.zone && !t.building && t.infrastructure.length === 0);
  if (!tile) {
    throw new Error('No free grass tile found for test placement.');
  }
  return { x: tile.x, y: tile.y };
}

function findRuinTile() {
  const tile = tilesFlat().find((t) => t.building?.type === 'ruin');
  return tile ? { x: tile.x, y: tile.y } : null;
}

function clearWorldForControlledScenario() {
  for (const tile of tilesFlat()) {
    tile.zone = null;
    tile.building = null;
    tile.infrastructure = [];
    tile.road_access = false;
    tile.powered = false;
    tile.watered = false;
    tile.pollution_air = 0;
    tile.pollution_water = 0;
    tile.crime = 0;
    tile.land_value = 130;
  }
  mockGameState.player_city.zones = [];
  mockGameState.player_city.buildings = [];
}

function seedUrbanStressProfile(count) {
  const candidates = tilesFlat().filter((t) => t.terrain_type === 'grass');
  for (let i = 0; i < Math.min(count, candidates.length); i += 1) {
    const tile = candidates[i];
    const industrial = i % 2 === 0;
    tile.zone = {
      id: `qa-stress-zone-${tile.x}-${tile.y}-${i}`,
      type: industrial ? 'industrial_dense' : 'residential_dense',
      position: { x: tile.x, y: tile.y },
      size: { w: 1, h: 1 },
      development_level: 3,
      powered: true,
      watered: true,
      road_access: true,
      abandoned: false,
      population: industrial ? 480 : 600,
      built_year: mockGameState.current_date.year,
      built_month: mockGameState.current_date.month
    };
    tile.road_access = true;
    tile.powered = true;
    tile.watered = true;
  }
}

function seedPolicyDemandProfile() {
  mockGameState.player_city.metrics.eq = 20;
  mockGameState.player_city.metrics.hq = 20;
  mockGameState.player_city.metrics.crime_rate = 10;
  mockGameState.player_city.metrics.pollution_air = 10;
  mockGameState.player_city.metrics.pollution_water = 5;
  mockGameState.player_city.population = 500;
}

async function buildManyStructures(count) {
  const candidates = tilesFlat().filter((t) => t.terrain_type === 'grass' && !t.zone && !t.building);
  for (let i = 0; i < Math.min(count, candidates.length); i += 1) {
    const tile = candidates[i];
    await mockApiService.buildStructure(GAME_ID, 'school', { x: tile.x, y: tile.y });
  }
}

async function endMonths(count) {
  for (let i = 0; i < count; i += 1) {
    await mockApiService.endMonth(GAME_ID);
  }
}

function monthIndex(date) {
  return date.year * 12 + date.month;
}

function avg(list) {
  if (!list.length) return 0;
  return list.reduce((sum, n) => sum + n, 0) / list.length;
}

function avgTileMetric(metricKey) {
  const activeTiles = tilesFlat().filter((t) => t.zone || t.building);
  if (!activeTiles.length) return 0;
  return avg(activeTiles.map((t) => Number(t[metricKey] ?? 0)));
}

async function collectAverages(months) {
  const crime = [];
  const pollution = [];
  const tileCrime = [];
  const tilePollution = [];
  const r = [];
  const c = [];
  const i = [];

  for (let m = 0; m < months; m += 1) {
    await mockApiService.endMonth(GAME_ID);
    const metrics = mockGameState.player_city.metrics;
    crime.push(metrics.crime_rate);
    pollution.push(metrics.pollution_air);
    tileCrime.push(avgTileMetric('crime'));
    tilePollution.push(avgTileMetric('pollution_air'));
    r.push(metrics.rci_demand.r);
    c.push(metrics.rci_demand.c);
    i.push(metrics.rci_demand.i);
  }

  return {
    crime: avg(crime),
    pollution: avg(pollution),
    tileCrime: avg(tileCrime),
    tilePollution: avg(tilePollution),
    r: avg(r),
    c: avg(c),
    i: avg(i)
  };
}

async function enactAll(ids) {
  for (const id of ids) {
    await mockApiService.toggleOrdinance(GAME_ID, id, 'enact');
  }
}

function status(ok) {
  return ok ? 'Passed' : 'Failed';
}

async function runCertification() {
  const rows = [];
  const notes = [];

  // 24-month sweep and core monthly loop validation.
  resetState();
  const startDate = deepClone(mockGameState.current_date);
  const startPlayer = {
    population: mockGameState.player_city.population,
    treasury: mockGameState.player_city.treasury
  };
  const startAI = {
    population: mockGameState.ai_city.population,
    treasury: mockGameState.ai_city.treasury
  };

  await endMonths(24);

  const endDate = deepClone(mockGameState.current_date);
  const elapsedMonths = monthIndex(endDate) - monthIndex(startDate);
  const changedPlayer =
    mockGameState.player_city.population !== startPlayer.population ||
    mockGameState.player_city.treasury !== startPlayer.treasury;
  const changedAI =
    mockGameState.ai_city.population !== startAI.population ||
    mockGameState.ai_city.treasury !== startAI.treasury;

  rows.push({
    requirement: 'SPECS 3.1 (monthly tick: player + AI simulation)',
    evidence: `Elapsed ${elapsedMonths} months; player pop ${startPlayer.population}->${mockGameState.player_city.population}, treasury ${startPlayer.treasury}->${mockGameState.player_city.treasury}; AI pop ${startAI.population}->${mockGameState.ai_city.population}, treasury ${startAI.treasury}->${mockGameState.ai_city.treasury}.`,
    pass: elapsedMonths === 24 && changedPlayer && changedAI
  });

  // Section 1.7: ordinance demand/crime impact.
  resetState();
  clearWorldForControlledScenario();
  seedUrbanStressProfile(600);
  const baselineCrime = await collectAverages(2);

  resetState();
  clearWorldForControlledScenario();
  seedUrbanStressProfile(600);
  await enactAll(['legalized_gambling']);
  const gambling = await collectAverages(2);

  resetState();
  clearWorldForControlledScenario();
  seedUrbanStressProfile(10);
  await mockApiService.updateBudget(GAME_ID, { residential: 7, commercial: 7, industrial: 20 }, undefined);
  const baselinePollution = await collectAverages(2);

  resetState();
  clearWorldForControlledScenario();
  seedUrbanStressProfile(10);
  await mockApiService.updateBudget(GAME_ID, { residential: 7, commercial: 7, industrial: 20 }, undefined);
  await enactAll(['pollution_controls']);
  const pollutionControls = await collectAverages(2);

  const gamblingCrimeUp = gambling.tileCrime > baselineCrime.tileCrime;
  const pollutionDown = pollutionControls.tilePollution < baselinePollution.tilePollution;
  const industrialDemandDown = pollutionControls.i < baselinePollution.i;

  rows.push({
    requirement: 'SPECS 1.7 (legalized_gambling increases crime)',
    evidence: `Avg active-tile crime baseline ${baselineCrime.tileCrime.toFixed(2)} vs gambling ${gambling.tileCrime.toFixed(2)}.`,
    pass: gamblingCrimeUp
  });

  rows.push({
    requirement: 'SPECS 1.7 (pollution_controls lowers pollution and industrial pressure)',
    evidence: `Avg active-tile pollution baseline ${baselinePollution.tilePollution.toFixed(2)} vs pollution_controls ${pollutionControls.tilePollution.toFixed(2)}; avg I-demand baseline ${baselinePollution.i.toFixed(2)} vs pollution_controls ${pollutionControls.i.toFixed(2)}.`,
    pass: pollutionDown && industrialDemandDown
  });

  // Sections 3.1-3.5: utilities gating growth.
  resetState();
  await mockApiService.updateBudget(GAME_ID, { residential: 0, commercial: 0, industrial: 0 }, undefined);

  const p = findFreeGrassTile();
  await mockApiService.placeZone(GAME_ID, 'residential_light', p, { w: 1, h: 1 });

  await endMonths(1);
  const lvlNoUtility = mockGameState.map.tiles[p.y][p.x].zone?.development_level ?? -1;

  await mockApiService.placeInfrastructure(GAME_ID, 'road', [{ from: p, to: p }]);
  await endMonths(1);
  const lvlRoadOnly = mockGameState.map.tiles[p.y][p.x].zone?.development_level ?? -1;

  await mockApiService.placeInfrastructure(GAME_ID, 'power_line', [{ from: p, to: p }]);
  await endMonths(1);
  const lvlRoadPower = mockGameState.map.tiles[p.y][p.x].zone?.development_level ?? -1;

  await mockApiService.placeInfrastructure(GAME_ID, 'water_pipe', [{ from: p, to: p }]);
  await endMonths(1);
  const lvlAllUtilities = mockGameState.map.tiles[p.y][p.x].zone?.development_level ?? -1;

  const growthGatePass = lvlNoUtility === 0 && lvlRoadOnly === 0 && lvlRoadPower >= 1 && lvlAllUtilities >= 2;

  rows.push({
    requirement: 'SPECS 3.1-3.5 (growth gated by road/power/water utility presence)',
    evidence: `Zone at (${p.x},${p.y}) dev levels: none=${lvlNoUtility}, roadOnly=${lvlRoadOnly}, road+power=${lvlRoadPower}, road+power+water=${lvlAllUtilities}.`,
    pass: growthGatePass
  });

  // Section 6.3: cumulative combined policy effects.
  resetState();
  clearWorldForControlledScenario();
  seedPolicyDemandProfile();
  const baselineCombo = await collectAverages(1);

  resetState();
  clearWorldForControlledScenario();
  seedPolicyDemandProfile();
  await enactAll(['tourist_promotion']);
  const singlePolicy = await collectAverages(1);

  resetState();
  clearWorldForControlledScenario();
  seedPolicyDemandProfile();
  await enactAll(['tourist_promotion', 'business_incentives', 'sales_tax']);
  const multiPolicy = await collectAverages(1);

  const cumulativePass = multiPolicy.c > singlePolicy.c && multiPolicy.c > baselineCombo.c && multiPolicy.i > baselineCombo.i;

  rows.push({
    requirement: 'SPECS 6.3 (ordinance combinations stack cumulatively)',
    evidence: `Avg C-demand baseline ${baselineCombo.c.toFixed(2)}, tourist_only ${singlePolicy.c.toFixed(2)}, combo ${multiPolicy.c.toFixed(2)}; Avg I-demand baseline ${baselineCombo.i.toFixed(2)} vs combo ${multiPolicy.i.toFixed(2)}.`,
    pass: cumulativePass
  });

  // Ruin/Bulldozer loop.
  resetState();
  clearWorldForControlledScenario();
  await buildManyStructures(40);
  let ruinPosition = null;
  let ruinAttempts = 0;
  for (let i = 0; i < 3; i += 1) {
    ruinAttempts += 1;
    await mockApiService.attackRival(GAME_ID, 'fire', 'player');
    ruinPosition = findRuinTile();
    if (ruinPosition) break;
  }

  let blockedBuild = false;
  let clearedThenBuilt = false;

  if (ruinPosition) {
    try {
      await mockApiService.buildStructure(GAME_ID, 'school', ruinPosition);
      blockedBuild = false;
    } catch (error) {
      blockedBuild = String(error?.message ?? '').includes('occupied');
    }

    await mockApiService.demolish(GAME_ID, ruinPosition, 'building');
    const rebuilt = await mockApiService.buildStructure(GAME_ID, 'school', ruinPosition);
    clearedThenBuilt = Boolean(rebuilt?.success);
  }

  rows.push({
    requirement: 'Ruin/Bulldozer loop (ruins block rebuilding until demolished)',
    evidence: ruinPosition
      ? `Ruin found at (${ruinPosition.x},${ruinPosition.y}) after ${ruinAttempts} attack(s); build-on-ruin blocked=${blockedBuild}; post-bulldozer rebuild success=${clearedThenBuilt}.`
      : `No ruin tile spawned after ${ruinAttempts} attack attempts.`,
    pass: Boolean(ruinPosition) && blockedBuild && clearedThenBuilt
  });

  const failedCount = rows.filter((r) => !r.pass).length;
  const passedCount = rows.length - failedCount;

  if (failedCount > 0) {
    notes.push('At least one requirement failed in this run. Review evidence and rerun after fixes.');
  } else {
    notes.push('All targeted requirements passed in this certification run.');
  }

  const now = new Date().toISOString();
  const reportLines = [
    '# Certification Report — SimHiri Targeted Simulation QA',
    '',
    `Generated: ${now}`,
    'Scope: 24-month sweep + targeted compliance checks for SPECS 1.7, 3.1-3.5, 6.3, and ruin/bulldozer loop.',
    '',
    `Summary: ${passedCount}/${rows.length} requirements passed; ${failedCount} failed.`,
    '',
    '## Final Acceptance Table',
    '',
    '| SPECS Requirement | Simulation Evidence | Status |',
    '| --- | --- | --- |'
  ];

  for (const row of rows) {
    reportLines.push(`| ${row.requirement} | ${row.evidence} | ${status(row.pass)} |`);
  }

  reportLines.push('', '## Notes', '');
  for (const note of notes) {
    reportLines.push(`- ${note}`);
  }

  const outPath = resolve(process.cwd(), '..', 'CERTIFICATION_REPORT.md');
  writeFileSync(outPath, `${reportLines.join('\n')}\n`, 'utf8');

  console.log('Certification report written to:', outPath);
  console.log(`Result: ${passedCount}/${rows.length} passed.`);

  if (failedCount > 0) {
    process.exitCode = 1;
  }
}

runCertification().catch((error) => {
  console.error('Certification QA script failed:', error);
  process.exitCode = 1;
});
