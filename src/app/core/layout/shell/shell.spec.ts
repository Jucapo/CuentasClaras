import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { AuthService } from '../../auth/auth.service';
import { ExchangeRateFlow } from '../../exchange-rates/exchange-rate-flow';
import { PeriodService } from '../../periods/period.service';
import { SpaceService } from '../../spaces/space.service';
import { TotalsService } from '../../totals/totals.service';
import { Shell } from './shell';

describe('Shell', () => {
  const isAuthenticated = signal(true);
  let fixture: ComponentFixture<Shell>;

  beforeEach(async () => {
    isAuthenticated.set(true);
    await TestBed.configureTestingModule({
      imports: [Shell],
      providers: [
        provideRouter([]),
        { provide: AuthService, useValue: { isAuthenticated } },
        { provide: SpaceService, useValue: { canEdit: signal(false) } },
        {
          provide: TotalsService,
          useValue: { accountsTotal: signal(null), missingRateCurrencies: signal([]) },
        },
        {
          provide: PeriodService,
          useValue: {
            title: signal('Noviembre'),
            rangeText: signal('1 nov – 30 nov'),
            canShift: signal(true),
          },
        },
        { provide: ExchangeRateFlow, useValue: { open: vi.fn() } },
      ],
    }).compileComponents();
    fixture = TestBed.createComponent(Shell);
    await fixture.whenStable();
  });

  it('renders the five bottom tabs in order', () => {
    const links = Array.from(
      (fixture.nativeElement as HTMLElement).querySelectorAll<HTMLAnchorElement>('.nav-item'),
    );

    expect(links.map((link) => link.querySelector('.nav-label')?.textContent?.trim())).toEqual([
      'Cuentas',
      'Categorías',
      'Transacciones',
      'Presupuesto',
      'Resumen',
    ]);
    expect(links.map((link) => link.getAttribute('href'))).toEqual([
      '/cuentas',
      '/categorias',
      '/transacciones',
      '/presupuesto',
      '/resumen',
    ]);
  });

  it('links to settings from the header', () => {
    const settings = (fixture.nativeElement as HTMLElement).querySelector(
      'a[aria-label="Configuración"]',
    );
    expect(settings?.getAttribute('href')).toBe('/configuracion');
  });

  it('sends the user to the login page when the session ends', async () => {
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);

    isAuthenticated.set(false);
    await fixture.whenStable();

    expect(navigate).toHaveBeenCalledWith(['/', 'iniciar-sesion']);
  });
});
