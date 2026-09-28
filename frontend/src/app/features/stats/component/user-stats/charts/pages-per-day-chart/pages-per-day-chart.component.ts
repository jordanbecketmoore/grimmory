import {Component, DestroyRef, inject, Input, OnInit} from '@angular/core';
import {takeUntilDestroyed} from '@angular/core/rxjs-interop';
import {AsyncPipe} from '@angular/common';
import {BaseChartDirective} from 'ng2-charts';
import {ChartConfiguration, ChartData} from 'chart.js';
import {BehaviorSubject, EMPTY, Observable} from 'rxjs';
import {catchError} from 'rxjs/operators';
import {eachDayOfInterval, format, parseISO, startOfToday} from 'date-fns';
import {TranslocoDirective, TranslocoService} from '@jsverse/transloco';
import {PagesPerDayResponse, UserStatsService} from '../../../../../settings/user-management/user-stats.service';

type PagesChartData = ChartData<'bar', number[], string>;

const MOVING_AVERAGE_DAYS = 7;
const DATE_KEY_FORMAT = 'yyyy-MM-dd';

@Component({
  selector: 'app-pages-per-day-chart',
  standalone: true,
  imports: [AsyncPipe, BaseChartDirective, TranslocoDirective],
  templateUrl: './pages-per-day-chart.component.html',
  styleUrls: ['./pages-per-day-chart.component.scss']
})
export class PagesPerDayChartComponent implements OnInit {
  @Input() initialYear: number = new Date().getFullYear();

  public currentYear: number = new Date().getFullYear();
  public readonly chartType = 'bar' as const;
  public readonly chartData$: Observable<PagesChartData>;
  public readonly chartOptions: ChartConfiguration['options'];

  private readonly userStatsService = inject(UserStatsService);
  private readonly t = inject(TranslocoService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly chartDataSubject: BehaviorSubject<PagesChartData>;
  private bookCountsByDate = new Map<string, number>();

  constructor() {
    this.chartDataSubject = new BehaviorSubject<PagesChartData>({
      labels: [],
      datasets: []
    });
    this.chartData$ = this.chartDataSubject.asObservable();

    this.chartOptions = {
      responsive: true,
      maintainAspectRatio: false,
      interaction: {mode: 'index', intersect: false},
      layout: {
        padding: {top: 10, bottom: 10, left: 10, right: 10}
      },
      plugins: {
        legend: {
          display: true,
          position: 'top',
          labels: {
            font: {family: "'Inter', sans-serif", size: 11},
            boxWidth: 12,
            padding: 10
          }
        },
        tooltip: {
          enabled: true,
          borderWidth: 1,
          cornerRadius: 6,
          displayColors: true,
          padding: 12,
          titleFont: {size: 14, weight: 'bold'},
          bodyFont: {size: 13},
          callbacks: {
            title: (items) => items.length ? format(parseISO(items[0].label), 'EEE, MMM d, yyyy') : '',
            label: (context) => {
              const value = context.parsed.y;
              if (context.datasetIndex === 1) {
                return this.t.translate('statsUser.pagesPerDay.tooltipAverage', {value});
              }
              const lines = [
                this.t.translate(value === 1 ? 'statsUser.pagesPerDay.tooltipPage' : 'statsUser.pagesPerDay.tooltipPages', {value})
              ];
              const books = this.bookCountsByDate.get(context.label) ?? 0;
              if (books > 0) {
                lines.push(this.t.translate(books === 1 ? 'statsUser.pagesPerDay.tooltipBook' : 'statsUser.pagesPerDay.tooltipBooks', {books}));
              }
              return lines;
            }
          }
        }
      },
      scales: {
        x: {
          title: {
            display: true,
            text: this.t.translate('statsUser.pagesPerDay.axisDate'),
            font: {
              family: "'Inter', sans-serif",
              size: 13,
              weight: 'bold'
            }
          },
          ticks: {
            font: {family: "'Inter', sans-serif", size: 11},
            autoSkip: false,
            maxRotation: 0,
            // Only label the first day of each month; 365 daily labels would be unreadable
            callback: (_value, index) => {
              const label = this.chartDataSubject.value.labels?.[index];
              return label?.endsWith('-01') ? format(parseISO(label), 'MMM') : '';
            }
          },
          grid: {display: false},
          border: {display: false}
        },
        y: {
          title: {
            display: true,
            text: this.t.translate('statsUser.pagesPerDay.axisPages'),
            font: {
              family: "'Inter', sans-serif",
              size: 13,
              weight: 'bold'
            }
          },
          beginAtZero: true,
          ticks: {
            font: {family: "'Inter', sans-serif", size: 11},
            precision: 0
          },
          border: {display: false}
        }
      }
    };
  }

  ngOnInit(): void {
    this.currentYear = this.initialYear;
    this.loadPagesPerDay(this.currentYear);
  }

  public changeYear(delta: number): void {
    this.currentYear += delta;
    this.loadPagesPerDay(this.currentYear);
  }

  private loadPagesPerDay(year: number): void {
    this.userStatsService.getPagesPerDay(year)
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        catchError((error) => {
          console.error('Error loading pages per day:', error);
          return EMPTY;
        })
      )
      .subscribe((data) => {
        this.updateChartData(year, data);
      });
  }

  private updateChartData(year: number, pagesPerDay: PagesPerDayResponse[]): void {
    const pagesByDate = new Map(pagesPerDay.map(day => [day.date, day.pagesRead]));
    this.bookCountsByDate = new Map(pagesPerDay.map(day => [day.date, day.bookCount]));

    const labels = this.daysOfYear(year).map(day => format(day, DATE_KEY_FORMAT));
    const pagesRead = labels.map(date => pagesByDate.get(date) ?? 0);

    this.chartDataSubject.next({
      labels,
      datasets: [
        {
          label: this.t.translate('statsUser.pagesPerDay.pagesRead'),
          data: pagesRead,
          backgroundColor: 'rgba(59, 130, 246, 0.7)',
          borderColor: 'rgba(59, 130, 246, 1)',
          borderWidth: 0,
          borderRadius: 2,
          barPercentage: 1,
          categoryPercentage: 0.9,
          order: 2
        },
        {
          label: this.t.translate('statsUser.pagesPerDay.sevenDayAverage'),
          data: this.trailingAverage(pagesRead, MOVING_AVERAGE_DAYS),
          type: 'line' as const,
          borderColor: 'rgba(251, 191, 36, 1)',
          backgroundColor: 'rgba(251, 191, 36, 0.1)',
          borderWidth: 2,
          pointRadius: 0,
          pointHoverRadius: 3,
          fill: false,
          tension: 0.3,
          order: 1
        } as unknown as PagesChartData['datasets'][number]
      ]
    });
  }

  // Every calendar day of the year in local time, stopping at today for the current year
  private daysOfYear(year: number): Date[] {
    const start = new Date(year, 0, 1);
    const endOfYear = new Date(year, 11, 31);
    const today = startOfToday();
    const end = endOfYear < today ? endOfYear : today;
    return end < start ? [] : eachDayOfInterval({start, end});
  }

  private trailingAverage(values: number[], window: number): number[] {
    let sum = 0;
    return values.map((value, index) => {
      sum += value;
      if (index >= window) {
        sum -= values[index - window];
      }
      const count = Math.min(index + 1, window);
      return Math.round((sum / count) * 10) / 10;
    });
  }
}
