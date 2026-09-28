import {TestBed} from '@angular/core/testing';
import type {Scale} from 'chart.js';
import {firstValueFrom, of, throwError} from 'rxjs';
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';

import {TranslocoService} from '@jsverse/transloco';
import {nextChartEmission} from '../../../../../../core/testing/chart-testing';
import {UserStatsService, type PagesPerDayResponse} from '../../../../../settings/user-management/user-stats.service';
import {PagesPerDayChartComponent} from './pages-per-day-chart.component';

interface FakeTooltipItem {
  datasetIndex: number;
  label: string;
  parsed: {y: number};
}

describe('PagesPerDayChartComponent', () => {
  let getPagesPerDay: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    getPagesPerDay = vi.fn(() => of([]));

    TestBed.configureTestingModule({
      providers: [
        {provide: UserStatsService, useValue: {getPagesPerDay}},
        {provide: TranslocoService, useValue: {translate: (key: string) => key}},
      ],
    });
  });

  afterEach(() => {
    TestBed.resetTestingModule();
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  async function loadYear(year: number, days: PagesPerDayResponse[]) {
    getPagesPerDay.mockReturnValue(of(days));
    const component = TestBed.runInInjectionContext(() => new PagesPerDayChartComponent());
    component.initialYear = year;

    const nextEmission = nextChartEmission(component.chartData$);
    component.ngOnInit();
    return {component, chartData: await nextEmission};
  }

  function getTickCallback(component: PagesPerDayChartComponent) {
    const scale = component.chartOptions?.scales?.['x'] as {
      ticks?: {callback?: (this: Scale, value: string | number, index: number, ticks: {value: number}[]) => string};
    } | undefined;
    return scale?.ticks?.callback;
  }

  function getTooltipCallbacks(component: PagesPerDayChartComponent) {
    return component.chartOptions?.plugins?.tooltip?.callbacks as unknown as {
      title: (items: FakeTooltipItem[]) => string;
      label: (item: FakeTooltipItem) => string | string[];
    };
  }

  it('zero-fills every day of a past year and places pages on the matching date', async () => {
    const {chartData} = await loadYear(2024, [{date: '2024-03-01', pagesRead: 42, bookCount: 2}]);

    expect(getPagesPerDay).toHaveBeenCalledWith(2024);
    expect(chartData.labels).toHaveLength(366);
    expect(chartData.labels?.[0]).toBe('2024-01-01');
    expect(chartData.labels?.[365]).toBe('2024-12-31');

    const pages = chartData.datasets[0]?.data as number[];
    expect(pages[chartData.labels!.indexOf('2024-03-01')]).toBe(42);
    expect(pages.reduce((sum, value) => sum + value, 0)).toBe(42);
  });

  it('computes a trailing seven-day average over the zero-filled series', async () => {
    const {chartData} = await loadYear(2023, [
      {date: '2023-01-01', pagesRead: 14, bookCount: 1},
      {date: '2023-01-08', pagesRead: 7, bookCount: 1},
    ]);

    expect(chartData.datasets[1]?.data.slice(0, 8)).toEqual([14, 7, 4.7, 3.5, 2.8, 2.3, 2, 1]);
  });

  it('stops at today for the current year and shows nothing for future years', async () => {
    vi.useFakeTimers({toFake: ['Date']});
    vi.setSystemTime(new Date(2026, 2, 10, 15, 0));

    const current = await loadYear(2026, []);
    expect(current.chartData.labels).toHaveLength(69);
    expect(current.chartData.labels?.at(-1)).toBe('2026-03-10');

    const future = await loadYear(2027, []);
    expect(future.chartData.labels).toEqual([]);
  });

  it('labels only the first day of each month on the x-axis', async () => {
    const {component} = await loadYear(2023, []);
    const tickCallback = getTickCallback(component);

    expect(tickCallback?.call({} as Scale, 0, 0, [])).toBe('Jan');
    expect(tickCallback?.call({} as Scale, 1, 1, [])).toBe('');
    expect(tickCallback?.call({} as Scale, 31, 31, [])).toBe('Feb');
  });

  it('formats tooltips with the date, pages, book count, and average', async () => {
    const {component} = await loadYear(2024, [{date: '2024-03-01', pagesRead: 42, bookCount: 2}]);
    const callbacks = getTooltipCallbacks(component);

    expect(callbacks.title([{datasetIndex: 0, label: '2024-03-01', parsed: {y: 42}}])).toBe('Fri, Mar 1, 2024');
    expect(callbacks.label({datasetIndex: 0, label: '2024-03-01', parsed: {y: 42}})).toEqual([
      'statsUser.pagesPerDay.tooltipPages',
      'statsUser.pagesPerDay.tooltipBooks',
    ]);
    expect(callbacks.label({datasetIndex: 0, label: '2024-03-02', parsed: {y: 0}})).toEqual([
      'statsUser.pagesPerDay.tooltipPages',
    ]);
    expect(callbacks.label({datasetIndex: 1, label: '2024-03-01', parsed: {y: 6}})).toBe('statsUser.pagesPerDay.tooltipAverage');
  });

  it('logs and keeps the empty chart state when the request fails', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    getPagesPerDay.mockReturnValue(throwError(() => new Error('boom')));

    const component = TestBed.runInInjectionContext(() => new PagesPerDayChartComponent());
    component.ngOnInit();

    expect(errorSpy).toHaveBeenCalled();
    expect((await firstValueFrom(component.chartData$)).labels).toEqual([]);
  });
});
