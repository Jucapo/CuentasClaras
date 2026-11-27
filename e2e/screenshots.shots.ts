import { expect, Locator, Page, test } from '@playwright/test';
import {
  HOUSEHOLD,
  HOUSEHOLD_FOR_SUMMARY,
  HOUSEHOLD_WITH_BUDGETS,
  HOUSEHOLD_WITH_MOVEMENTS,
} from './support/catalog-fixture';
import { capture, captureElement, captureViewport } from './support/screenshots';
import {
  blockSupabase,
  MemberFixture,
  mockDataApi,
  mockInviteeAuth,
  seedSession,
} from './support/supabase';

// The key screens on mobile and desktop, in light and dark (spec §13.4), for the review of a UI
// change: `npm run e2e:screenshots`, or `-- --grep <name>` for the screens that changed. They land in
// e2e/screenshots/<project>/<name>.png; nothing is compared. Behavior lives in the *.e2e.ts tests.

/** Thursday 26 November 2026, inside the period of the fixtures' movements. */
const TODAY = new Date('2026-11-26T12:00:00');

type ApiOptions = NonNullable<Parameters<typeof mockDataApi>[1]>;

interface Screen {
  /** File name of the screenshot. */
  readonly name: string;
  /** What the mocked API answers; without it, every request to Supabase fails. */
  readonly api?: ApiOptions;
  /** Without a session, as on the public pages. */
  readonly signedOut?: true;
  /** Opens the screen and waits until it shows what the screenshot is for. */
  readonly show: (page: Page, isMobile: boolean) => Promise<void>;
  /**
   * `page`: the whole page; `viewport`: what is on screen, e.g. an open sheet or dialog; a function:
   * one element.
   */
  readonly shot: 'page' | 'viewport' | ((page: Page) => Locator);
}

/** The open sheet (phones) or dialog (wider screens). */
function overlay(page: Page, isMobile: boolean): Locator {
  return page.locator(isMobile ? '.mat-bottom-sheet-container' : 'mat-dialog-container');
}

async function heading(page: Page, name: string): Promise<void> {
  await expect(page.getByRole('heading', { name, level: 1 })).toBeVisible();
}

const LAURA: MemberFixture = {
  userId: '00000000-0000-4000-8000-0000000000a1',
  name: 'Laura',
  email: 'laura@example.com',
  role: 'editor',
};

const INVITATION_PREVIEW = {
  invitation_id: '00000000-0000-4000-8000-0000000001a1',
  space_name: 'Hogar',
  space_icon: 'home',
  space_color: 'green',
  inviter_name: 'Juan',
  role: 'editor',
  email: LAURA.email,
  expires_at: '2026-12-03T12:00:00Z',
  status: 'pending',
};

/** A step of the setup wizard, with the ones before it done. */
function wizardStep(name: string, path: string, title: string, done: number): Screen {
  return {
    name,
    api: { withSpace: true, catalog: HOUSEHOLD, onboarding: { step: done } },
    show: async (page) => {
      await page.goto(path);
      await heading(page, title);
    },
    shot: 'page',
  };
}

/** A level of the /ui catalog, with every component in light and dark. */
function uiLevel(id: string, title: string): Screen {
  return {
    name: `ui-${id}`,
    signedOut: true,
    show: async (page) => {
      await page.goto('/ui');
      await expect(
        page.locator(`#${id}`).getByRole('heading', { name: title, exact: true }),
      ).toBeVisible();
    },
    shot: (page) => page.locator(`#${id}`),
  };
}

const SCREENS: readonly Screen[] = [
  // Public pages
  {
    name: 'iniciar-sesion',
    signedOut: true,
    show: async (page) => {
      await page.goto('/iniciar-sesion');
      await expect(page.getByRole('heading', { name: 'Iniciar sesión' })).toBeVisible();
    },
    shot: 'page',
  },
  {
    name: 'invitacion-cuenta-nueva',
    signedOut: true,
    api: { sharing: { preview: INVITATION_PREVIEW } },
    show: async (page) => {
      await mockInviteeAuth(page, LAURA.email);
      await page.goto(`/invitacion?token=${'ab'.repeat(32)}&token_hash=e12afa6d&type=invite`);
      await expect(page.getByText('Juan te invitó a «Hogar»')).toBeVisible();
    },
    shot: 'page',
  },

  // Setup wizard
  {
    name: 'bienvenida-espacio',
    api: {},
    show: async (page) => {
      await page.goto('/');
      await heading(page, 'Tu espacio');
    },
    shot: 'page',
  },
  wizardStep('bienvenida-cuentas', '/bienvenida/cuentas', 'Tu situación actual', 1),
  wizardStep('bienvenida-ingresos', '/bienvenida/ingresos', 'Ingresos', 2),
  wizardStep('bienvenida-gastos', '/bienvenida/gastos', 'Categorías de gasto', 3),
  wizardStep('bienvenida-etiquetas', '/bienvenida/etiquetas', 'Etiquetas', 4),
  wizardStep('bienvenida-presupuesto', '/bienvenida/presupuesto', 'Presupuesto', 5),
  wizardStep('bienvenida-resumen', '/bienvenida/resumen', 'Resumen', 6),

  // Categorías and the quick entry
  {
    name: 'inicio-con-montos',
    api: { withSpace: true, catalog: HOUSEHOLD_WITH_MOVEMENTS },
    show: async (page) => {
      await page.goto('/categorias');
      await expect(page.locator('cc-donut')).toContainText('$ 2,145,500.00');
    },
    shot: 'page',
  },
  {
    name: 'registro-rapido-gasto',
    api: { withSpace: true, catalog: HOUSEHOLD_WITH_MOVEMENTS },
    show: async (page, isMobile) => {
      await page.goto('/categorias');
      await page.getByRole('button', { name: /^Mercado/ }).click();
      await expect(overlay(page, isMobile).getByRole('heading', { name: 'Mercado' })).toBeVisible();
    },
    shot: 'viewport',
  },
  {
    name: 'periodo-opciones',
    api: { withSpace: true, catalog: HOUSEHOLD_WITH_MOVEMENTS },
    show: async (page, isMobile) => {
      await page.goto('/categorias');
      await page.getByRole('button', { name: /^Elegir periodo/ }).click();
      await expect(overlay(page, isMobile).getByRole('heading', { name: 'Periodo' })).toBeVisible();
    },
    shot: 'viewport',
  },
  {
    name: 'categorias-editar',
    api: { withSpace: true, catalog: HOUSEHOLD },
    show: async (page) => {
      await page.goto('/categorias/editar?clase=gasto');
      await heading(page, 'Editar categorías');
    },
    shot: 'page',
  },
  {
    name: 'categoria',
    api: { withSpace: true, catalog: HOUSEHOLD },
    show: async (page) => {
      await page.goto('/categorias/editar/cat-home?clase=gasto');
      await expect(page.getByLabel('Nombre', { exact: true })).toHaveValue('Hogar');
    },
    shot: 'page',
  },
  {
    name: 'categoria-eliminar',
    api: { withSpace: true, catalog: HOUSEHOLD },
    show: async (page, isMobile) => {
      await page.goto('/categorias/editar/cat-home?clase=gasto');
      await page.getByRole('button', { name: 'Eliminar' }).click();
      await expect(
        overlay(page, isMobile).getByRole('heading', { name: '¿Eliminar Hogar?' }),
      ).toBeVisible();
    },
    shot: 'viewport',
  },

  // Cuentas
  {
    name: 'cuentas',
    api: { withSpace: true, catalog: HOUSEHOLD },
    show: async (page) => {
      await page.goto('/cuentas');
      await expect(page.getByRole('link', { name: /Préstamo a Carlos/ })).toBeVisible();
    },
    shot: 'page',
  },
  {
    name: 'cuentas-mis-finanzas',
    api: { withSpace: true, catalog: HOUSEHOLD },
    show: async (page) => {
      await page.goto('/cuentas?vista=mis-finanzas');
      await expect(page.getByRole('group', { name: 'Patrimonio' })).toContainText('$ 6,811,900.50');
    },
    shot: 'page',
  },
  {
    name: 'cuenta-detalle',
    api: { withSpace: true, catalog: HOUSEHOLD_WITH_MOVEMENTS },
    show: async (page) => {
      await page.goto('/cuentas/acc-bank');
      await expect(page.getByRole('list').getByText('Hogar (Arriendo)')).toBeVisible();
    },
    shot: 'page',
  },
  {
    name: 'cuenta-editar',
    api: { withSpace: true, catalog: HOUSEHOLD },
    show: async (page) => {
      await page.goto('/cuentas/acc-cash/editar');
      await expect(page.getByLabel('Nombre', { exact: true })).toHaveValue('Efectivo');
    },
    shot: 'page',
  },
  {
    name: 'cuenta-icono-color',
    api: { withSpace: true, catalog: HOUSEHOLD },
    show: async (page, isMobile) => {
      await page.goto('/cuentas/acc-cash/editar');
      await page.getByRole('button', { name: /^Cambiar ícono y color/ }).click();
      const picker = overlay(page, isMobile);
      await picker.getByRole('tab', { name: 'Color' }).click();
      await picker.getByRole('button', { name: 'Morado', exact: true }).click();
      await expect(picker.getByRole('button', { name: 'Morado', exact: true })).toHaveAttribute(
        'aria-pressed',
        'true',
      );
    },
    shot: 'viewport',
  },
  {
    name: 'registro-rapido-transferencia',
    api: { withSpace: true, catalog: HOUSEHOLD_WITH_MOVEMENTS },
    show: async (page, isMobile) => {
      await page.goto('/cuentas/acc-bank');
      await page.getByRole('button', { name: 'Transferir' }).click();
      await expect(
        overlay(page, isMobile).getByRole('heading', { name: 'Transferencia' }),
      ).toBeVisible();
    },
    shot: 'viewport',
  },

  // Transacciones
  {
    name: 'transacciones',
    api: { withSpace: true, catalog: HOUSEHOLD_WITH_MOVEMENTS },
    show: async (page) => {
      await page.goto('/transacciones');
      await expect(page.getByRole('group', { name: 'Totales de lo que se ve' })).toContainText(
        '+$ 4,354,500.00',
      );
    },
    shot: 'page',
  },
  {
    name: 'transacciones-editar',
    api: { withSpace: true, catalog: HOUSEHOLD_WITH_MOVEMENTS },
    show: async (page, isMobile) => {
      await page.goto('/transacciones');
      await page
        .getByRole('region', { name: 'Movimientos' })
        .getByRole('button', { name: /^Mercado/ })
        .click();
      const entry = isMobile
        ? page.locator('.mat-bottom-sheet-container')
        : page.locator('cc-quick-entry');
      await expect(entry.getByRole('heading', { name: 'Mercado' })).toBeVisible();
    },
    shot: 'viewport',
  },
  {
    name: 'nuevo-movimiento',
    api: { withSpace: true, catalog: HOUSEHOLD_WITH_MOVEMENTS },
    show: async (page, isMobile) => {
      await page.goto('/transacciones');
      await page.getByRole('button', { name: 'Nuevo movimiento' }).first().click();
      await expect(overlay(page, isMobile).getByRole('button', { name: /^Mercado/ })).toBeVisible();
    },
    shot: 'viewport',
  },

  // Presupuesto and Resumen
  {
    name: 'presupuesto',
    api: { withSpace: true, catalog: HOUSEHOLD_WITH_BUDGETS },
    show: async (page) => {
      await page.goto('/presupuesto');
      await expect(page.getByRole('button', { name: /^Hogar/ })).toContainText('$ 150,000.00');
    },
    shot: 'page',
  },
  {
    name: 'presupuesto-detalle',
    api: { withSpace: true, catalog: HOUSEHOLD_WITH_BUDGETS },
    show: async (page, isMobile) => {
      await page.goto('/presupuesto');
      await page.getByRole('button', { name: /^Hogar/ }).click();
      const detail = isMobile
        ? page.locator('.mat-bottom-sheet-container')
        : page.locator('cc-budget-detail');
      await expect(detail.getByRole('textbox', { name: 'General' })).toHaveValue('200,000');
    },
    shot: 'viewport',
  },
  {
    name: 'resumen',
    api: { withSpace: true, catalog: HOUSEHOLD_FOR_SUMMARY },
    show: async (page) => {
      await page.goto('/resumen');
      await expect(page.getByRole('img', { name: 'Tasa de ahorro: 60 %' })).toBeVisible();
      await expect(page.locator('canvas').first()).toBeVisible();
    },
    shot: 'page',
  },

  // Configuración and the menu
  {
    name: 'configuracion',
    api: { withSpace: true, catalog: HOUSEHOLD_WITH_MOVEMENTS },
    show: async (page) => {
      await page.goto('/configuracion');
      await expect(page.getByLabel('Nombre del espacio')).toHaveValue('Hogar');
    },
    shot: 'page',
  },
  {
    name: 'miembros',
    api: {
      withSpace: true,
      catalog: HOUSEHOLD_WITH_MOVEMENTS,
      sharing: {
        members: [LAURA],
        invitations: [
          {
            id: 'invitation-1',
            email: 'mama@example.com',
            role: 'viewer',
            expires_at: '2026-12-01T12:00:00Z',
          },
        ],
      },
    },
    show: async (page) => {
      await page.goto('/configuracion/miembros');
      await expect(page.getByRole('heading', { name: 'Miembros (2)' })).toBeVisible();
    },
    shot: 'page',
  },
  {
    name: 'etiquetas',
    api: { withSpace: true, catalog: HOUSEHOLD },
    show: async (page) => {
      await page.goto('/configuracion/etiquetas');
      await expect(page.getByRole('button', { name: /Fijos/ })).toBeVisible();
    },
    shot: 'page',
  },
  {
    name: 'menu',
    api: { withSpace: true, catalog: HOUSEHOLD_WITH_MOVEMENTS },
    show: async (page) => {
      await page.goto('/categorias');
      await page.getByRole('button', { name: 'Abrir el menú' }).click();
      await expect(
        page.getByRole('dialog', { name: 'Menú' }).getByRole('button', { name: /^Configuración/ }),
      ).toBeVisible();
    },
    shot: 'viewport',
  },

  // Design system
  uiLevel('atomos', 'Átomos'),
  uiLevel('moleculas', 'Moléculas'),
  uiLevel('organismos', 'Organismos'),
  uiLevel('plantillas', 'Plantillas'),
];

test.beforeEach(async ({ page }) => {
  await page.clock.setFixedTime(TODAY);
  await blockSupabase(page);
});

for (const screen of SCREENS) {
  test(screen.name, async ({ page, isMobile }) => {
    if (!screen.signedOut) {
      await seedSession(page);
    }
    if (screen.api) {
      await mockDataApi(page, screen.api);
    }
    await screen.show(page, isMobile);

    if (screen.shot === 'page') {
      await capture(page, screen.name);
    } else if (screen.shot === 'viewport') {
      await captureViewport(page, screen.name);
    } else {
      await captureElement(screen.shot(page), screen.name);
    }
  });
}
