import type { GameState, Position, Tile } from '../types/game';

export type ReplaySpeed = 'normal' | 'fast' | 'instant';

export type ReplaySummary = {
  totalActions: number;
  focus: string;
  populationChange: number;
};

export type ReplayTileChange = {
  x: number;
  y: number;
  kind: 'zone' | 'building' | 'infrastructure' | 'utility' | 'terrain';
  before: unknown;
  after: unknown;
};

export type ReplaySnapshot = {
  gameState: GameState;
};

export type ReplayAction = {
  index: number;
  id: string;
  type: string;
  label: string;
  detail?: string;
  position?: Position;
  budgetDelta?: number;
  disasterAttack?: { type: string; target?: 'player' | 'ai' } | null;
  stateBefore: ReplaySnapshot;
  stateAfter: ReplaySnapshot;
  mapChanges: ReplayTileChange[];
};

export type AIReplayScript = {
  summary: ReplaySummary;
  actions: ReplayAction[];
};

export type AITurnSummaryPayload = {
  total_actions?: number;
  focus?: string;
  population_change?: number;
};

export type AIActionSequencePayload = {
  action_type?: string;
  description?: string;
  label?: string;
  detail?: string;
  id?: string;
  position?: Position;
  budget_delta?: number;
  disaster_attack?: { type?: string; target?: 'player' | 'ai' } | null;
  state_snapshot_before?: { game_state?: GameState } | GameState;
  state_snapshot_after?: { game_state?: GameState } | GameState;
};

export type ReplayPayload = {
  ai_turn_summary?: AITurnSummaryPayload;
  ai_actions_sequence?: AIActionSequencePayload[];
  ai_turn?: {
    actions?: Array<{
      action_type?: string;
      description?: string;
      position?: Position;
      disaster_type?: string;
      target?: 'player' | 'ai';
    }>;
    reasoning?: string;
    simulation?: {
      population_change?: number;
    };
  };
};

function cloneState(state: GameState): GameState {
  return JSON.parse(JSON.stringify(state)) as GameState;
}

function normalizeStateSnapshot(snapshot: AIActionSequencePayload['state_snapshot_before'] | AIActionSequencePayload['state_snapshot_after'] | undefined): GameState | null {
  if (!snapshot) return null;
  if ('game_state' in (snapshot as { game_state?: GameState })) {
    const wrapped = snapshot as { game_state?: GameState };
    return wrapped.game_state ? cloneState(wrapped.game_state) : null;
  }
  return cloneState(snapshot as GameState);
}

function tileSignature(tile: Tile | null): string {
  if (!tile) return 'null';
  const zoneType = tile.zone?.type ?? 'none';
  const zoneLevel = tile.zone?.development_level ?? 0;
  const buildingType = tile.building?.type ?? 'none';
  const infra = [...(tile.infrastructure ?? [])].sort().join('|');
  return [
    tile.terrain_type,
    zoneType,
    zoneLevel,
    buildingType,
    infra,
    Number(Boolean(tile.powered)),
    Number(Boolean(tile.watered)),
    Number(Boolean(tile.road_access))
  ].join('::');
}

function tileChangeKind(before: Tile | null, after: Tile | null): ReplayTileChange['kind'] {
  if ((before?.building?.type ?? null) !== (after?.building?.type ?? null)) return 'building';
  if ((before?.zone?.type ?? null) !== (after?.zone?.type ?? null) || (before?.zone?.development_level ?? 0) !== (after?.zone?.development_level ?? 0)) return 'zone';
  const beforeInfra = [...(before?.infrastructure ?? [])].sort().join('|');
  const afterInfra = [...(after?.infrastructure ?? [])].sort().join('|');
  if (beforeInfra !== afterInfra) return 'infrastructure';
  if ((before?.powered ?? false) !== (after?.powered ?? false) || (before?.watered ?? false) !== (after?.watered ?? false) || (before?.road_access ?? false) !== (after?.road_access ?? false)) return 'utility';
  return 'terrain';
}

export function detectMapChanges(beforeState: GameState, afterState: GameState): ReplayTileChange[] {
  const beforeTiles = beforeState.map?.tiles ?? [];
  const afterTiles = afterState.map?.tiles ?? [];
  const maxY = Math.max(beforeTiles.length, afterTiles.length);
  const changes: ReplayTileChange[] = [];

  for (let y = 0; y < maxY; y += 1) {
    const beforeRow = beforeTiles[y] ?? [];
    const afterRow = afterTiles[y] ?? [];
    const maxX = Math.max(beforeRow.length, afterRow.length);

    for (let x = 0; x < maxX; x += 1) {
      const beforeTile = beforeRow[x] ?? null;
      const afterTile = afterRow[x] ?? null;
      if (tileSignature(beforeTile) === tileSignature(afterTile)) continue;

      changes.push({
        x,
        y,
        kind: tileChangeKind(beforeTile, afterTile),
        before: beforeTile,
        after: afterTile
      });
    }
  }

  return changes;
}

export function getReplaySpeedDelay(speed: ReplaySpeed): number {
  if (speed === 'fast') return 200;
  if (speed === 'instant') return 0;
  return 1000;
}

export function buildReplayScript(payload: ReplayPayload, fallbackBefore: GameState, fallbackAfter: GameState): AIReplayScript {
  const rawActions = payload.ai_actions_sequence && payload.ai_actions_sequence.length > 0
    ? payload.ai_actions_sequence
    : (payload.ai_turn?.actions ?? []).map((action, index) => ({
        action_type: action.action_type,
        description: action.description,
        position: action.position,
        disaster_attack: action.disaster_type ? { type: action.disaster_type, target: action.target } : null,
        // Fallback stream has no snapshots; keep full turn boundary snapshots.
        state_snapshot_before: index === 0 ? fallbackBefore : fallbackAfter,
        state_snapshot_after: fallbackAfter
      }));

  const actions: ReplayAction[] = [];

  rawActions.forEach((raw, index) => {
    const stateBefore = normalizeStateSnapshot(raw.state_snapshot_before) ?? (index === 0 ? cloneState(fallbackBefore) : cloneState(actions[index - 1].stateAfter.gameState));
    const stateAfter = normalizeStateSnapshot(raw.state_snapshot_after) ?? cloneState(fallbackAfter);

    const label = raw.label || raw.description || raw.action_type || `Action ${index + 1}`;
    const detail = raw.detail || raw.description;
    const mapChanges = detectMapChanges(stateBefore, stateAfter);

    actions.push({
      index,
      id: raw.id ?? `ai-action-${index}`,
      type: raw.action_type ?? 'unknown',
      label,
      detail,
      position: raw.position,
      budgetDelta: raw.budget_delta,
      disasterAttack: raw.disaster_attack
        ? {
            type: raw.disaster_attack.type ?? 'unknown',
            target: raw.disaster_attack.target
          }
        : null,
      stateBefore: { gameState: stateBefore },
      stateAfter: { gameState: stateAfter },
      mapChanges
    });
  });

  const fallbackPopulationDelta = (fallbackAfter.player_city.population ?? 0) - (fallbackBefore.player_city.population ?? 0);

  const summary: ReplaySummary = {
    totalActions: payload.ai_turn_summary?.total_actions ?? actions.length,
    focus: payload.ai_turn_summary?.focus ?? payload.ai_turn?.reasoning ?? 'Balanced city management',
    populationChange: payload.ai_turn_summary?.population_change ?? payload.ai_turn?.simulation?.population_change ?? fallbackPopulationDelta
  };

  return { summary, actions };
}

export function getReplayStateAt(script: AIReplayScript, currentActionIndex: number): GameState | null {
  if (script.actions.length === 0) return null;
  if (currentActionIndex <= 0) return cloneState(script.actions[0].stateBefore.gameState);
  const index = Math.min(currentActionIndex, script.actions.length - 1);
  return cloneState(script.actions[index].stateAfter.gameState);
}

export function getReplayActionAt(script: AIReplayScript, currentActionIndex: number): ReplayAction | null {
  if (script.actions.length === 0) return null;
  const index = Math.max(0, Math.min(currentActionIndex, script.actions.length - 1));
  return script.actions[index] ?? null;
}

export function getRivalTiles(state: GameState): Tile[][] {
  const aiTiles = state.ai_city?.map?.tiles;
  if (Array.isArray(aiTiles) && aiTiles.length > 0) {
    return JSON.parse(JSON.stringify(aiTiles)) as Tile[][];
  }
  return JSON.parse(JSON.stringify(state.map.tiles)) as Tile[][];
}
