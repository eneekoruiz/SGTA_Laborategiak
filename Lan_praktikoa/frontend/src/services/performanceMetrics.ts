/**
 * PERFORMANCE METRICS SERVICE
 * Tracks frame time, stroke throughput, and FPS in real-time
 */

export interface FrameSample {
  timestamp: number;
  deltaMs: number;
  fps: number;
}

export interface StrokeSample {
  startTime: number;
  endTime: number;
  tilesCompleted: number;
  durationMs: number;
  tilesPerSecond: number;
}

export interface PerformanceSnapshot {
  currentFps: number;
  avgFps: number;
  frameTimeMs: number;
  lastStroke: StrokeSample | null;
  strokeThroughputAvg: number; // tiles/sec over last 5 strokes
}

class PerformanceMetrics {
  private frameSamples: FrameSample[] = [];
  private strokeSamples: StrokeSample[] = [];
  private lastFrameTime = performance.now();
  private maxSamples = 120; // ~2 seconds @ 60fps

  recordFrame(): void {
    const now = performance.now();
    const deltaMs = now - this.lastFrameTime;
    const fps = 1000 / Math.max(1, deltaMs);

    this.frameSamples.push({
      timestamp: now,
      deltaMs,
      fps
    });

    if (this.frameSamples.length > this.maxSamples) {
      this.frameSamples.shift();
    }

    this.lastFrameTime = now;
  }

  recordStroke(tilesCompleted: number, durationMs: number): void {
    const sample: StrokeSample = {
      startTime: performance.now() - durationMs,
      endTime: performance.now(),
      tilesCompleted,
      durationMs,
      tilesPerSecond: (tilesCompleted / Math.max(1, durationMs)) * 1000
    };

    this.strokeSamples.push(sample);

    if (this.strokeSamples.length > 10) {
      this.strokeSamples.shift();
    }
  }

  getSnapshot(): PerformanceSnapshot {
    const lastFrame = this.frameSamples[this.frameSamples.length - 1];
    const currentFps = lastFrame?.fps ?? 60;
    const avgFps = this.frameSamples.length > 0 
      ? this.frameSamples.reduce((sum, s) => sum + s.fps, 0) / this.frameSamples.length
      : 60;
    const frameTimeMs = lastFrame?.deltaMs ?? 16.67;
    const lastStroke = this.strokeSamples[this.strokeSamples.length - 1] ?? null;
    const strokeThroughputAvg = this.strokeSamples.length > 0
      ? this.strokeSamples.reduce((sum, s) => sum + s.tilesPerSecond, 0) / this.strokeSamples.length
      : 0;

    return {
      currentFps: Math.round(currentFps),
      avgFps: Math.round(avgFps),
      frameTimeMs: Math.round(frameTimeMs * 10) / 10,
      lastStroke,
      strokeThroughputAvg: Math.round(strokeThroughputAvg)
    };
  }

  reset(): void {
    this.frameSamples = [];
    this.strokeSamples = [];
    this.lastFrameTime = performance.now();
  }
}

export const performanceMetrics = new PerformanceMetrics();
