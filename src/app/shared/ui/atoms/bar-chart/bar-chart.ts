import {
  Component,
  computed,
  DestroyRef,
  DOCUMENT,
  ElementRef,
  inject,
  input,
  signal,
  viewChild,
} from '@angular/core';
import type { EChartsCoreOption } from 'echarts/core';
import { NgxEchartsDirective, provideEchartsCore } from 'ngx-echarts';
import { formatMoney } from '../../../../domain/money/money';
import { colorOrFallback, paletteColor } from '../../colors/color-palette';
import { MONEY_FORMAT } from '../../money/money-format';
import { BAR_CHART_LAYOUT, UI_TEXT } from '../../ui.constants';

/** A stack of the bars: a category (or the rest) with its palette color. */
export interface BarChartSeries {
  readonly label: string;
  /** Palette key; unknown keys show the fallback color. */
  readonly color: string | null;
}

/** One bar: its date on the axis and in the tooltip, and one value per series. */
export interface BarChartBucket {
  /** Under the bar when it has a tick, e.g. "27 may". */
  readonly label: string;
  /** Heading of its tooltip, e.g. "Jueves 26 nov". */
  readonly title: string;
  /** Minor units, in the order of the series. */
  readonly values: readonly number[];
}

const HTML_ESCAPES: Readonly<Record<string, string>> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
};

// Names come from the user and the tooltip is HTML.
function escapeHtml(text: string): string {
  return text.replace(/[&<>"']/g, (character) => HTML_ESCAPES[character]);
}

// Computed styles keep `light-dark(a, b)` as written, and the canvas cannot read it: this picks the
// side of the scheme in use.
function resolveLightDark(value: string, dark: boolean): string {
  const match = /^light-dark\((.*)\)$/.exec(value.trim());
  if (!match) {
    return value;
  }
  const inner = match[1];
  let depth = 0;
  for (let index = 0; index < inner.length; index++) {
    const character = inner[index];
    if (character === '(') {
      depth++;
    } else if (character === ')') {
      depth--;
    } else if (character === ',' && depth === 0) {
      return (dark ? inner.slice(index + 1) : inner.slice(0, index)).trim();
    }
  }
  return value;
}

/**
 * Stacked bars per day or month (spec §6), drawn with ECharts, which loads on demand. The amounts
 * go on the right; touching or hovering a bar shows its date, its total and its breakdown. It is an
 * image whose accessible name sums it up: the screen lists the same figures, so the tooltip is
 * never the only way to read them. Colors follow the theme and the system scheme.
 */
@Component({
  selector: 'cc-bar-chart',
  imports: [NgxEchartsDirective],
  providers: [
    provideEchartsCore({ echarts: () => import('./echarts-setup').then((m) => m.echarts) }),
  ],
  templateUrl: './bar-chart.html',
  styleUrl: './bar-chart.scss',
  host: { role: 'img', '[attr.aria-label]': 'label()' },
})
export class BarChart {
  readonly buckets = input.required<readonly BarChartBucket[]>();
  readonly series = input.required<readonly BarChartSeries[]>();
  /** Indexes of the bars that show their date under them. */
  readonly ticks = input<readonly number[]>([]);
  readonly currency = input.required<string>();
  /** Accessible summary, e.g. "Gastos de Diciembre: $ 4.100.000; la mayor es Mercado". */
  readonly label = input.required<string>();

  private readonly document = inject(DOCUMENT);
  private readonly format = inject(MONEY_FORMAT);
  private readonly probe = viewChild<ElementRef<HTMLElement>>('probe');
  /** Changes with the theme, so the colors are read again. */
  private readonly scheme = signal(0);

  protected readonly options = computed<EChartsCoreOption | null>(() => {
    this.scheme();
    const probe = this.probe()?.nativeElement;
    if (!probe) {
      return null;
    }
    // "light dark" follows the system; the theme or a catalog frame may force one of them.
    const scheme = getComputedStyle(probe).colorScheme.split(' ');
    const dark =
      scheme.length === 1
        ? scheme[0] === 'dark'
        : (this.document.defaultView?.matchMedia('(prefers-color-scheme: dark)').matches ?? false);
    const color = (value: string): string => {
      probe.style.color = value;
      return resolveLightDark(getComputedStyle(probe).color, dark);
    };
    const text = color('var(--mat-sys-on-surface-variant)');
    const line = color('var(--mat-sys-outline-variant)');
    const tooltipText = color('var(--mat-sys-on-surface)');
    const tooltipSurface = color('var(--mat-sys-surface-container-high)');
    const fontFamily = getComputedStyle(probe).fontFamily;
    const series = this.series();
    const colors = series.map((item) => color(paletteColor(colorOrFallback(item.color))));
    const buckets = this.buckets();
    const ticks = new Set(this.ticks());
    const currency = this.currency();
    const format = this.format();
    const axisFormat = { ...format, showDecimals: false };
    const reducedMotion =
      this.document.defaultView?.matchMedia('(prefers-reduced-motion: reduce)').matches ?? false;

    const tooltip = (params: unknown): string => {
      const index = (params as readonly { dataIndex: number }[])[0]?.dataIndex ?? 0;
      const bucket = buckets[index];
      if (!bucket) {
        return '';
      }
      const total = bucket.values.reduce((sum, value) => sum + value, 0);
      const lines = series
        .map((item, position) => ({ item, position, value: bucket.values[position] ?? 0 }))
        .filter((entry) => entry.value > 0)
        .map(
          (entry) =>
            `<span style="color:${colors[entry.position]}">●</span> ${escapeHtml(entry.item.label)}` +
            ` <b>${escapeHtml(formatMoney(entry.value, currency, format))}</b>`,
        );
      return [
        `<b>${escapeHtml(bucket.title)}</b>`,
        `${escapeHtml(UI_TEXT.total)}: <b>${escapeHtml(formatMoney(total, currency, format))}</b>`,
        ...lines,
      ].join('<br>');
    };

    return {
      animation: !reducedMotion,
      textStyle: { fontFamily },
      grid: { ...BAR_CHART_LAYOUT.grid },
      tooltip: {
        trigger: 'axis',
        triggerOn: 'mousemove|click',
        confine: true,
        axisPointer: { type: 'shadow' },
        backgroundColor: tooltipSurface,
        borderColor: line,
        textStyle: { color: tooltipText, fontFamily },
        formatter: tooltip,
      },
      xAxis: {
        type: 'category',
        data: buckets.map((bucket) => bucket.label),
        axisTick: { show: false },
        axisLine: { lineStyle: { color: line } },
        axisLabel: {
          color: text,
          interval: (index: number) => ticks.has(index),
          hideOverlap: true,
        },
      },
      yAxis: {
        type: 'value',
        position: 'right',
        splitNumber: BAR_CHART_LAYOUT.splitNumber,
        splitLine: { lineStyle: { type: 'dashed', color: line } },
        axisLabel: {
          color: text,
          formatter: (value: number) => formatMoney(value, currency, axisFormat),
        },
      },
      series: series.map((item, position) => ({
        type: 'bar',
        name: item.label,
        stack: 'total',
        barMaxWidth: BAR_CHART_LAYOUT.barMaxWidth,
        data: buckets.map((bucket) => bucket.values[position] ?? 0),
        itemStyle: { color: colors[position] },
        emphasis: { disabled: true },
      })),
    };
  });

  constructor() {
    const view = this.document.defaultView;
    const refresh = () => this.scheme.update((value) => value + 1);
    const scheme = view?.matchMedia('(prefers-color-scheme: dark)');
    scheme?.addEventListener('change', refresh);
    // ThemeService switches the theme through html[data-theme].
    const observer = view ? new view.MutationObserver(refresh) : null;
    observer?.observe(this.document.documentElement, { attributeFilter: ['data-theme'] });
    inject(DestroyRef).onDestroy(() => {
      scheme?.removeEventListener('change', refresh);
      observer?.disconnect();
    });
  }
}
