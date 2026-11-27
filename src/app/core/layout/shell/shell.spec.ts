import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { AuthService } from '../../auth/auth.service';
import { ExchangeRateFlow } from '../../exchange-rates/exchange-rate-flow';
import { InvitationsService } from '../../invitations/invitations.service';
import { PeriodService } from '../../periods/period.service';
import { ProfileService } from '../../profiles/profile.service';
import { SpaceMembersService } from '../../spaces/space-members.service';
import { SpaceService } from '../../spaces/space.service';
import { ThemeService } from '../../theme/theme.service';
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
        {
          provide: SpaceService,
          useValue: { canEdit: signal(false), memberships: signal([]), activeSpace: signal(null) },
        },
        { provide: InvitationsService, useValue: { mine: signal([]) } },
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
        { provide: ProfileService, useValue: { profile: signal(null) } },
        { provide: SpaceMembersService, useValue: { members: signal([]) } },
        { provide: ThemeService, useValue: { preference: signal('system'), set: vi.fn() } },
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

  // Spec §7: Configuración is in the menu, which the avatar of the header opens.
  it('has the menu instead of settings in the header', () => {
    const element = fixture.nativeElement as HTMLElement;
    expect(element.querySelector('a[aria-label="Configuración"]')).toBeNull();
    expect(element.querySelector('header button[aria-label="Abrir el menú"]')).not.toBeNull();
  });

  it('sends the user to the login page when the session ends', async () => {
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);

    isAuthenticated.set(false);
    await fixture.whenStable();

    expect(navigate).toHaveBeenCalledWith(['/', 'iniciar-sesion']);
  });
});
