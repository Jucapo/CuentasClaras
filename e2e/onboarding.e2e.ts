import { expect, Page, test } from '@playwright/test';
import { HOUSEHOLD } from './support/catalog-fixture';
import { capture, captureViewport } from './support/screenshots';
import { blockSupabase, mockDataApi, seedSession, SUPABASE_URL } from './support/supabase';

test.beforeEach(async ({ page }) => {
  await blockSupabase(page);
  await seedSession(page);
});

/** The open sheet (phones) or dialog (wider screens). */
function overlay(page: Page, isMobile: boolean) {
  return page.locator(isMobile ? '.mat-bottom-sheet-container' : 'mat-dialog-container');
}

/** The step is open: its heading, and the progress (phones) or the side column (desktop). */
async function expectStep(page: Page, isMobile: boolean, title: string, position: number) {
  await expect(page.getByRole('heading', { name: title, level: 1 })).toBeVisible();
  if (isMobile) {
    await expect(page.getByText(new RegExp(`^Paso ${position} de 7`))).toBeVisible();
  } else {
    await expect(
      page.getByRole('navigation', { name: 'Pasos de la configuración' }).getByRole('link', {
        name: new RegExp(`^Paso ${position}: ${title}`),
      }),
    ).toHaveAttribute('aria-current', 'step');
  }
}

test('the setup wizard goes from creating the space to the summary', async ({ page, isMobile }) => {
  test.slow();
  const api = await mockDataApi(page);
  await page.goto('/');

  // 1 · Tu espacio
  await expect(page).toHaveURL(/\/bienvenida\/espacio$/);
  await expectStep(page, isMobile, 'Tu espacio', 1);
  await expect(page.getByLabel('Moneda principal')).toContainText('Peso colombiano (COP)');
  await expect(page.getByRole('button', { name: 'Cerrar sesión' })).toBeVisible();
  await capture(page, 'bienvenida-espacio');

  await page.getByRole('button', { name: 'Continuar' }).click();
  await expect(page.getByText('Ponle un nombre al espacio.')).toBeVisible();
  await page.getByLabel('Nombre del espacio').fill('Hogar');
  await page.getByRole('button', { name: 'Continuar' }).click();

  // 2 · Tu situación actual
  await expect(page).toHaveURL(/\/bienvenida\/cuentas$/);
  expect(api.createdSpace()).toEqual({
    space_name: 'Hogar',
    main_currency: 'COP',
    month_start_day: 1,
    week_start: 'monday',
  });
  await expectStep(page, isMobile, 'Tu situación actual', 2);
  await expect(page.getByRole('button', { name: 'Terminar más tarde' })).toBeVisible();
  await capture(page, 'bienvenida-cuentas-vacia');

  await page.getByRole('button', { name: 'Agregar' }).click();
  const chooser = overlay(page, isMobile);
  await expect(chooser.getByRole('heading', { name: '¿Qué vas a crear?' })).toBeVisible();
  await chooser.getByRole('button', { name: /^Cuenta/ }).click();
  await expect(page).toHaveURL(/\/bienvenida\/cuentas\/nueva\?grupo=cuenta$/);
  await expect(page.getByRole('heading', { name: 'Nueva cuenta', level: 1 })).toBeVisible();
  await page.getByLabel('Nombre', { exact: true }).fill('Bancolombia');
  await page.getByRole('textbox', { name: 'Saldo' }).fill('2,543,000');
  await capture(page, 'bienvenida-cuenta-nueva');
  await page.getByRole('button', { name: 'Guardar' }).click();

  await expect(page).toHaveURL(/\/bienvenida\/cuentas$/);
  await expect(page.getByRole('link', { name: /Bancolombia/ })).toContainText('$ 2,543,000.00');
  await page.getByRole('button', { name: /^Cuenta predeterminada/ }).click();
  const defaults = overlay(page, isMobile);
  await defaults.getByRole('radio', { name: 'Bancolombia' }).click();
  await expect(defaults).toBeHidden();
  await expect(page.getByRole('button', { name: /^Cuenta predeterminada/ })).toContainText(
    'Bancolombia',
  );
  expect(api.writes().find((write) => write.table === 'accounts')?.body).toMatchObject({
    name: 'Bancolombia',
    kind: 'bank',
    initial_balance: 254300000,
  });
  expect(api.rpcCalls('set_default_account')).toEqual([
    expect.objectContaining({ target_account_id: expect.stringMatching(/^accounts-\d+$/) }),
  ]);
  await capture(page, 'bienvenida-cuentas');
  await page.getByRole('button', { name: 'Continuar' }).click();

  // 3 · Ingresos: the suggested ones, minus one, and an expected amount
  await expect(page).toHaveURL(/\/bienvenida\/ingresos$/);
  expect(api.settings()['onboarding_step']).toBe(2);
  await expectStep(page, isMobile, 'Ingresos', 3);
  await capture(page, 'bienvenida-ingresos-inicio');
  await page.getByRole('link', { name: /^Usar las sugeridas/ }).click();

  await expect(page).toHaveURL(/\/bienvenida\/ingresos\/plantilla$/);
  await expect(page.getByRole('heading', { name: 'Ingresos sugeridos', level: 1 })).toBeVisible();
  await page.getByRole('checkbox', { name: 'Intereses' }).uncheck();
  await capture(page, 'bienvenida-ingresos-plantilla');
  await page.getByRole('button', { name: 'Crear (3)' }).click();

  await expect(page).toHaveURL(/\/bienvenida\/ingresos$/);
  expect(api.rpcCalls('create_category_tree')[0]).toMatchObject({
    category_kind: 'income',
    tree: [
      { name: 'Salario', children: [] },
      { name: 'Trabajo independiente', children: [] },
      { name: 'Otros', children: [] },
    ],
  });
  await expect(
    page.getByRole('list', { name: 'Categorías de ingreso' }).getByRole('listitem'),
  ).toHaveText([/Salario/, /Trabajo independiente/, /Otros/, /Nueva/]);

  // Spec §13.5: each amount is typed in its row, and Enter moves to the next one.
  const expected = page.getByRole('list', { name: 'Ingreso mensual esperado por categoría' });
  const salary = expected.getByRole('textbox', { name: 'Salario' });
  await salary.click();
  await expect(salary).toHaveAttribute('inputmode', 'decimal');
  await expect(
    expected.getByRole('button', { name: 'Moneda: Peso colombiano (COP)' }).first(),
  ).toBeVisible();
  await salary.fill('6,000,000');
  await captureViewport(page, 'bienvenida-ingreso-esperado');
  await salary.press('Enter');
  await expect(expected.getByRole('textbox', { name: 'Trabajo independiente' })).toBeFocused();
  await expect
    .poll(() => api.writes().find((write) => write.table === 'budgets')?.body)
    .toMatchObject({ amount: 600000000, currency: 'COP', effective_from: expect.any(String) });
  await expect(salary).toHaveValue('6,000,000');
  await capture(page, 'bienvenida-ingresos');
  await page.getByRole('button', { name: 'Continuar' }).click();

  // 4 · Gastos: the template without a category and a subcategory, then the grid to adjust it
  await expect(page).toHaveURL(/\/bienvenida\/gastos$/);
  await expectStep(page, isMobile, 'Categorías de gasto', 4);
  await page.getByRole('link', { name: /^Partir de la plantilla sugerida/ }).click();
  await expect(page.getByRole('heading', { name: 'Categorías sugeridas', level: 1 })).toBeVisible();
  await page.getByRole('checkbox', { name: 'Mascotas' }).uncheck();
  await expect(page.getByRole('checkbox', { name: 'Veterinario' })).not.toBeChecked();
  await page.getByRole('checkbox', { name: 'Peajes' }).uncheck();
  await capture(page, 'bienvenida-gastos-plantilla');
  await page.getByRole('button', { name: /^Crear/ }).click();

  await expect(page).toHaveURL(/\/bienvenida\/gastos$/);
  const tree = (
    api.rpcCalls('create_category_tree')[1] as {
      category_kind: string;
      tree: { name: string; children: { name: string }[] }[];
    }
  ).tree;
  expect(tree).toHaveLength(12);
  expect(tree.map((category) => category.name)).not.toContain('Mascotas');
  expect(tree.find((category) => category.name === 'Transporte')?.children).not.toContainEqual(
    expect.objectContaining({ name: 'Peajes' }),
  );
  await expect(page.getByText('Se crearon 46 categorías.')).toBeVisible();
  const grid = page.getByRole('list', { name: 'Categorías de gasto' });
  await expect(grid.getByRole('listitem').first()).toContainText('Hogar');
  await capture(page, 'bienvenida-gastos');

  await grid.getByRole('button', { name: 'Hogar', exact: true }).click();
  await expect(page).toHaveURL(/\/bienvenida\/gastos\/categories-\d+\?clase=gasto$/);
  await expect(
    page.getByRole('heading', { name: 'Editar categoría', exact: true, level: 1 }),
  ).toBeVisible();
  await expect(page.getByLabel('Nombre', { exact: true })).toHaveValue('Hogar');
  await expect(
    page.getByRole('list', { name: 'Subcategorías', exact: true }).getByRole('listitem'),
  ).toHaveCount(5);
  await page.getByRole('button', { name: 'Volver' }).click();
  await expect(page).toHaveURL(/\/bienvenida\/gastos\?clase=gasto$/);
  await page.getByRole('button', { name: 'Continuar' }).click();

  // 5 · Etiquetas (optional): the suggested one, applied by default to a subcategory
  await expect(page).toHaveURL(/\/bienvenida\/etiquetas$/);
  await expectStep(page, isMobile, 'Etiquetas', 5);
  await expect(page.getByRole('button', { name: 'Saltar' })).toBeVisible();
  await page.getByRole('button', { name: /^Fijos/ }).click();
  const tagSheet = overlay(page, isMobile);
  await expect(tagSheet.getByLabel('Nombre')).toHaveValue('Fijos');
  await tagSheet.getByRole('button', { name: '¿En qué categorías se pone sola?' }).click();
  await tagSheet.getByRole('checkbox', { name: 'Arriendo o hipoteca' }).check();
  await captureViewport(page, 'bienvenida-etiqueta');
  await tagSheet.getByRole('button', { name: 'Listo' }).click();
  await expect(tagSheet).toBeHidden();

  const createdTag = api.writes().find((write) => write.table === 'tags');
  expect(createdTag?.body).toMatchObject({ name: 'Fijos', color: 'indigo' });
  await expect
    .poll(() => api.writes().find((write) => write.table === 'category_default_tags')?.body)
    .toEqual([expect.objectContaining({ tag_id: expect.stringMatching(/^tags-\d+$/) })]);
  await expect(page.getByRole('button', { name: /^Fijos/ })).toContainText(
    'Por defecto en 1 categoría',
  );
  await capture(page, 'bienvenida-etiquetas');
  await page.getByRole('button', { name: 'Continuar' }).click();

  // 6 · Presupuesto (optional)
  await expect(page).toHaveURL(/\/bienvenida\/presupuesto$/);
  await expectStep(page, isMobile, 'Presupuesto', 6);
  await expect(page.getByRole('button', { name: 'Saltar' })).toBeVisible();
  const budget = page.getByRole('list', { name: 'Presupuesto mensual por categoría' });
  await budget.getByRole('textbox', { name: 'Hogar' }).fill('1,500,000');
  // A typed amount is enough for "Continuar", before it is saved.
  await expect(page.getByRole('button', { name: 'Continuar' })).toBeVisible();
  await capture(page, 'bienvenida-presupuesto');
  // Straight to the main button, without Enter: leaving the row saves it and the step waits.
  await page.getByRole('button', { name: 'Continuar' }).click();

  // 7 · Resumen
  await expect(page).toHaveURL(/\/bienvenida\/resumen$/);
  await expectStep(page, isMobile, 'Resumen', 7);
  const summary = page.getByRole('list', { name: 'Lo que configuraste' });
  await expect(summary.getByRole('link')).toHaveText([
    /Tu espacio.*Hogar · COP · el mes empieza el día 1/,
    /Tu situación actual.*1 cuenta · Predeterminada: Bancolombia/,
    /Ingresos.*3 fuentes · \$ 6,000,000\.00 esperados al mes/,
    /Categorías de gasto.*12 categorías y 34 subcategorías/,
    /Etiquetas.*1 etiqueta, por defecto en 1 categoría/,
    /Presupuesto.*\$ 1,500,000\.00 al mes en 1 categoría/,
  ]);
  await capture(page, 'bienvenida-resumen');
  await page.getByRole('button', { name: 'Terminar', exact: true }).click();

  await expect(page).toHaveURL(/\/categorias$/);
  await expect(page.getByText('Tu espacio está listo.')).toBeVisible();
  expect(api.settings()).toMatchObject({
    onboarding_step: 7,
    onboarding_completed_at: expect.any(String),
  });
  await expect(page.getByRole('region', { name: 'Completa tu configuración' })).toBeHidden();
});

test('the budget step waits for its rows and stays when one fails to save', async ({
  page,
  isMobile,
}) => {
  const api = await mockDataApi(page, {
    withSpace: true,
    catalog: HOUSEHOLD,
    onboarding: { step: 5 },
  });
  // The first budget insert fails; the rest reach the mocked API.
  let failNext = true;
  await page.route(`${SUPABASE_URL}/rest/v1/budgets*`, (route) => {
    if (route.request().method() === 'POST' && failNext) {
      failNext = false;
      return route.fulfill({ status: 500, json: { message: 'boom' } });
    }
    return route.fallback();
  });
  await page.goto('/bienvenida/presupuesto');

  const budget = page.getByRole('list', { name: 'Presupuesto mensual por categoría' });
  const home = budget.getByRole('textbox', { name: 'Hogar' });
  await expect(page.getByRole('button', { name: 'Saltar' })).toBeVisible();
  await home.fill('1,500,000');
  await page.getByRole('button', { name: 'Continuar' }).click();

  // The save failed: the step stays, says why and the row goes back to what it had.
  await expect(page.getByText('No se pudo guardar. Inténtalo de nuevo.').first()).toBeVisible();
  await expect(page).toHaveURL(/\/bienvenida\/presupuesto$/);
  await expect(home).toHaveValue('');
  expect(api.settings()['onboarding_step']).toBe(5);
  // With no amount left, the step can be skipped again.
  await expect(page.getByRole('button', { name: 'Saltar' })).toBeVisible();

  // The symbol picks the currency of a row, and Enter moves to the next one.
  await budget
    .getByRole('listitem')
    .filter({ hasText: 'Mercado' })
    .getByRole('button', { name: /^Moneda/ })
    .click();
  await overlay(page, isMobile).getByRole('radio', { name: /USD/ }).click();
  const market = budget.getByRole('textbox', { name: 'Mercado' });
  await market.fill('300');
  await market.press('Enter');
  await expect(budget.getByRole('textbox', { name: 'Transporte' })).toBeFocused();
  await expect
    .poll(
      () =>
        api
          .writes()
          .filter((write) => write.table === 'budgets')
          .at(-1)?.body,
    )
    .toMatchObject({ category_id: 'cat-market', amount: 30000, currency: 'USD' });
  await expect(market).toHaveValue('300');
  await expect(
    budget.getByRole('button', { name: 'Moneda: Dólar estadounidense (USD)' }),
  ).toContainText('US$');
  await captureViewport(page, 'bienvenida-presupuesto-filas');

  await page.getByRole('button', { name: 'Continuar' }).click();
  await expect(page).toHaveURL(/\/bienvenida\/resumen$/);
});

test('the wizard resumes where it was left until it is postponed', async ({ page }) => {
  const api = await mockDataApi(page, {
    withSpace: true,
    catalog: HOUSEHOLD,
    onboarding: { step: 3 },
  });
  await page.goto('/');

  // Three steps done: entering the app opens the fourth one.
  await expect(page).toHaveURL(/\/bienvenida\/gastos$/);
  await expect(page.getByRole('list', { name: 'Categorías de gasto' })).toContainText('Hogar');
  await capture(page, 'bienvenida-retomar');

  // Steps after the pending one stay out of reach.
  await page.goto('/bienvenida/presupuesto');
  await expect(page).toHaveURL(/\/bienvenida\/gastos$/);

  await page.getByRole('button', { name: 'Terminar más tarde' }).click();
  await expect(page).toHaveURL(/\/categorias$/);
  expect(api.settings()['onboarding_postponed_at']).toEqual(expect.any(String));
  const reminder = page.getByRole('region', { name: 'Completa tu configuración' });
  await expect(reminder).toContainText('Faltan 4 pasos');
  await capture(page, 'inicio-completar-configuracion');

  // Postponed: opening the app again stays in the app.
  await page.reload();
  await expect(page).toHaveURL(/\/categorias$/);
  await expect(reminder).toBeVisible();

  await page.goto('/configuracion');
  await expect(page.getByRole('link', { name: /^Completar configuración inicial/ })).toContainText(
    'Faltan 4 pasos',
  );

  await page.goto('/categorias');
  await reminder.getByRole('link', { name: 'Continuar' }).click();
  await expect(page).toHaveURL(/\/bienvenida\/gastos$/);
});

test('a complete wizard can be reviewed from Configuración', async ({ page }) => {
  await mockDataApi(page, { withSpace: true, catalog: HOUSEHOLD });
  await page.goto('/configuracion');

  await page.getByRole('link', { name: /^Revisar configuración inicial/ }).click();
  await expect(page).toHaveURL(/\/bienvenida\/resumen$/);
  await expect(page.getByRole('button', { name: 'Volver a la app' })).toBeVisible();

  await page
    .getByRole('list', { name: 'Lo que configuraste' })
    .getByRole('link', { name: /^Categorías de gasto/ })
    .click();
  await expect(page).toHaveURL(/\/bienvenida\/gastos$/);
  await expect(page.getByRole('list', { name: 'Categorías de gasto' })).toContainText('Hogar');
});

test('settings show the space; the theme and the session are in the menu', async ({ page }) => {
  await mockDataApi(page, { withSpace: true });
  await page.goto('/configuracion');

  await expect(page.getByRole('heading', { name: 'Configuración', exact: true })).toBeVisible();
  await expect(page.getByLabel('Nombre del espacio')).toHaveValue('Hogar');
  const main = page.getByRole('main');
  await expect(main.getByRole('button', { name: 'Cerrar sesión' })).toHaveCount(0);
  await expect(main.getByLabel('Tema')).toHaveCount(0);
  await capture(page, 'configuracion');
});
