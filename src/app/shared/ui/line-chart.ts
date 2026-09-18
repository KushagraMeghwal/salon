import { Component, computed, input } from '@angular/core';

export interface ChartSeries {
  values: number[];
  color: string;
  dashed?: boolean;
  area?: boolean;
  width?: number;
  marker?: boolean;
}

let uid = 0;

@Component({
  selector: 'app-line-chart',
  template: `
    <svg class="w-full h-full overflow-visible" preserveAspectRatio="none" [attr.viewBox]="'0 0 ' + W + ' ' + H">
      <defs>
        @for (p of paths(); track $index) {
          <linearGradient [attr.id]="id + $index" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" [attr.stop-color]="p.color" stop-opacity="0.28"></stop>
            <stop offset="100%" [attr.stop-color]="p.color" stop-opacity="0"></stop>
          </linearGradient>
        }
      </defs>
      @for (p of paths(); track $index) {
        @if (p.area) {
          <path [attr.d]="p.areaD" [attr.fill]="'url(#' + id + $index + ')'"></path>
        }
        <path [attr.d]="p.d" fill="none" [attr.stroke]="p.color" [attr.stroke-width]="p.width" stroke-linecap="round" [attr.stroke-dasharray]="p.dashed ? '4,4' : null"></path>
        @if (p.marker && p.last) {
          <circle [attr.cx]="p.last.x" [attr.cy]="p.last.y" r="5.5" [attr.fill]="p.color" stroke="#ffffff" stroke-width="2.5"></circle>
        }
      }
    </svg>
  `,
})
export class LineChart {
  readonly series = input.required<ChartSeries[]>();
  readonly yMax = input<number | null>(null);
  protected readonly W = 700;
  protected readonly H = 200;
  protected readonly id = 'lc' + ++uid + '-';

  protected readonly paths = computed(() => {
    const all = this.series();
    const max = this.yMax() ?? Math.max(1, ...all.flatMap((s) => s.values)) * 1.1;
    const pad = 10;
    return all.map((s) => {
      const n = s.values.length;
      const pts = s.values.map((v, i) => ({
        x: n === 1 ? this.W / 2 : pad + (i * (this.W - pad * 2)) / (n - 1),
        y: this.H - (v / max) * (this.H - 10) - 4,
      }));
      const d = this.smooth(pts);
      const last = pts[pts.length - 1];
      const first = pts[0];
      const areaD = pts.length ? `${d} L ${last.x} ${this.H} L ${first.x} ${this.H} Z` : '';
      return { d, areaD, color: s.color, dashed: s.dashed, area: s.area, width: s.width ?? 3.2, marker: s.marker, last };
    });
  });

  private smooth(p: { x: number; y: number }[]): string {
    if (!p.length) return '';
    let d = `M ${p[0].x} ${p[0].y}`;
    for (let i = 0; i < p.length - 1; i++) {
      const p0 = p[i - 1] ?? p[i];
      const p1 = p[i];
      const p2 = p[i + 1];
      const p3 = p[i + 2] ?? p2;
      const c1x = p1.x + (p2.x - p0.x) / 6;
      const c1y = p1.y + (p2.y - p0.y) / 6;
      const c2x = p2.x - (p3.x - p1.x) / 6;
      const c2y = p2.y - (p3.y - p1.y) / 6;
      d += ` C ${c1x} ${c1y}, ${c2x} ${c2y}, ${p2.x} ${p2.y}`;
    }
    return d;
  }
}
