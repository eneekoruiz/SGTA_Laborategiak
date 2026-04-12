import type { EducationResponse, HealthResponse } from '../../types/game';

type ChartPoint = { x: number; y: number };
type TickMark = { value: number; y: number };

export interface EducationHealthViewModel {
  eqHistory: number[];
  hqHistory: number[];
  eqSparklinePoints: string;
  hqSparklinePoints: string;
  eqPoints: ChartPoint[];
  hqPoints: ChartPoint[];
  eqPath: string;
  hqPath: string;
  eqArea: string;
  hqArea: string;
  eqStatus: string;
  hqStatus: string;
  tickerItems: string[];
  tickY: TickMark[];
  overallEducationCoverage: number;
}

const SPARKLINE_WIDTH = 84;
const SPARKLINE_HEIGHT = 18;
const SPARKLINE_PADDING = 1;

const CHART_WIDTH = 760;
const CHART_HEIGHT = 220;
const CHART_PADDING_X = 26;
const CHART_PADDING_Y = 24;

function mapHistoryToSparkline(values: number[], maxValue = 200): string {
  if (values.length === 0) return '';

  const innerW = SPARKLINE_WIDTH - SPARKLINE_PADDING * 2;
  const innerH = SPARKLINE_HEIGHT - SPARKLINE_PADDING * 2;

  return values
    .map((value, index) => {
      const x = SPARKLINE_PADDING + (index / Math.max(values.length - 1, 1)) * innerW;
      const y =
        SPARKLINE_HEIGHT -
        SPARKLINE_PADDING -
        (Math.max(0, Math.min(maxValue, value)) / maxValue) * innerH;
      return `${x.toFixed(2)},${y.toFixed(2)}`;
    })
    .join(' ');
}

function toPoints(values: number[]): ChartPoint[] {
  if (values.length === 0) return [];

  const innerW = CHART_WIDTH - CHART_PADDING_X * 2;
  const innerH = CHART_HEIGHT - CHART_PADDING_Y * 2;

  return values.map((value, index) => ({
    x: CHART_PADDING_X + (index / Math.max(values.length - 1, 1)) * innerW,
    y: CHART_HEIGHT - CHART_PADDING_Y - (Math.max(0, Math.min(200, value)) / 200) * innerH
  }));
}

function splinePath(points: ChartPoint[], tension = 0.22): string {
  if (points.length === 0) return '';
  if (points.length === 1) return `M${points[0].x},${points[0].y}`;

  let d = `M${points[0].x},${points[0].y}`;

  for (let i = 0; i < points.length - 1; i += 1) {
    const p0 = points[Math.max(0, i - 1)];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = points[Math.min(points.length - 1, i + 2)];

    const cp1x = p1.x + ((p2.x - p0.x) / 6) * (1 + tension);
    const cp1y = p1.y + ((p2.y - p0.y) / 6) * (1 + tension);
    const cp2x = p2.x - ((p3.x - p1.x) / 6) * (1 + tension);
    const cp2y = p2.y - ((p3.y - p1.y) / 6) * (1 + tension);

    d += ` C${cp1x},${cp1y} ${cp2x},${cp2y} ${p2.x},${p2.y}`;
  }

  return d;
}

function areaPath(points: ChartPoint[], line: string): string {
  if (points.length === 0 || !line) return '';
  const first = points[0];
  const last = points[points.length - 1];
  return `${line} L${last.x},${CHART_HEIGHT - CHART_PADDING_Y} L${first.x},${CHART_HEIGHT - CHART_PADDING_Y} Z`;
}

export function formatFacilityType(type: EducationResponse['facilities'][number]['type']): string {
  if (type === 'school') return 'Eskola';
  if (type === 'college') return 'Unibertsitatea';
  if (type === 'library') return 'Liburutegia';
  return 'Museoa';
}

export function deriveEducationHealthViewModel(params: {
  education: EducationResponse;
  health: HealthResponse;
  eqSeries: number[];
  hqSeries: number[];
}): EducationHealthViewModel {
  const { education, health, eqSeries, hqSeries } = params;

  const eqHistory = eqSeries.slice(-24);
  const hqHistory = hqSeries.slice(-24);

  const eqPoints = toPoints(eqSeries);
  const hqPoints = toPoints(hqSeries);
  const eqPath = splinePath(eqPoints);
  const hqPath = splinePath(hqPoints);

  const eqStatus = education.eq >= 120 ? 'Altua' : education.eq >= 95 ? 'Egonkorra' : 'Hauskorra';
  const hqStatus = health.hq >= 110 ? 'Indartsua' : health.hq >= 90 ? 'Egonkorra' : 'Ahula';

  const overallEducationCoverage =
    education.facilities.length > 0
      ? Math.round(
          education.facilities.reduce((sum, facility) => sum + facility.coverage, 0) /
            education.facilities.length
        )
      : 0;

  return {
    eqHistory,
    hqHistory,
    eqSparklinePoints: mapHistoryToSparkline(eqHistory, 200),
    hqSparklinePoints: mapHistoryToSparkline(hqHistory, 200),
    eqPoints,
    hqPoints,
    eqPath,
    hqPath,
    eqArea: areaPath(eqPoints, eqPath),
    hqArea: areaPath(hqPoints, hqPath),
    eqStatus,
    hqStatus,
    tickerItems: [
      `EDU // EQ ${education.eq} (${eqStatus})`,
      `OSASUNA // HQ ${health.hq} (${hqStatus})`,
      `BIZI-ITXAROPENA // ${health.average_lifespan.toFixed(1)} urte`,
      `INDUSTRIA // Goi-teknologia ${(education.effects.high_tech_industry_pct * 100).toFixed(0)}%`,
      `ESTALDURA // Hezkuntza ${overallEducationCoverage}%`,
      `ARRISKUA // Kutsaduraren eragina ${health.pollution_health_impact}`,
      `HERRITAR // Krimen murrizketa ${education.effects.crime_reduction.toFixed(1)}`
    ],
    tickY: [0, 50, 100, 150, 200].map((value) => {
      const innerH = CHART_HEIGHT - CHART_PADDING_Y * 2;
      return {
        value,
        y: CHART_HEIGHT - CHART_PADDING_Y - (value / 200) * innerH
      };
    }),
    overallEducationCoverage
  };
}
