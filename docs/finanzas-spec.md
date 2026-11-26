# Cuentas Claras — Especificación funcional y técnica

> Versión 0.5 · 26-nov-2026 · Repo: `Jucapo/CuentasClaras`
> Fuente de verdad del proyecto. Vive en `docs/finanzas-spec.md` del repo y como contexto del proyecto "Finanzas" en Claude. Si algo cambia, se actualiza aquí primero.

---

## 1. Objetivo

App de finanzas personales para reemplazar 1Money. La usarán primero Juan y su esposa; está pensada desde el inicio para más usuarios.

Requisitos clave:

- Usable desde Android, iPhone y PC (PWA instalable).
- Varios usuarios, con espacios compartidos: cada persona puede tener cuentas privadas y aun así llevar un presupuesto conjunto.
- Registrar gastos e ingresos en muy pocos toques, con categorías, subcategorías y etiquetas.
- Saber en todo momento cuánto hay, cuánto se ha gastado y en qué, por periodos configurables.
- Deudas modeladas de verdad: intereses, amortización, capital vs. interés, diferidos de tarjeta.
- Ver el flujo real entre ingresos, gastos y deudas.
- Automatización progresiva (recurrentes, correos del banco, atajos).

La interfaz y el comportamiento de 1Money son la referencia visual (ver §7).

---

## 2. Stack

| Capa | Elección | Notas |
|---|---|---|
| Frontend | Angular (última estable), standalone + signals, TypeScript strict | Angular Material + CDK: bottom sheet, chips, date range picker, dialogs |
| PWA | `@angular/pwa` (service worker de Angular) | Instalable en Android, iOS (Agregar a inicio) y escritorio |
| Gráficas | Donut principal en SVG propio; barras con ECharts (`ngx-echarts`, import modular) | El donut replica el anillo segmentado de 1Money |
| Íconos | Material Symbols Rounded, self-hosted (subset) | Catálogo curado para categorías y cuentas (§13.3) |
| Tipografía | Roboto self-hosted (`@fontsource/roboto`) | La app no hace ninguna petición a Google Fonts |
| UI | Atomic design con prefijo `cc-` | Material solo dentro de átomos y moléculas (§13.1) |
| Backend | Supabase: Postgres, Auth, RLS, Edge Functions, `pg_cron` | |
| Hosting | Vercel (SPA estático), deploy automático desde `main`, previews por PR | |
| Esquema | Migraciones SQL versionadas en `supabase/migrations`; Supabase CLI como devDependency | Tipos TS generados desde el esquema |

---

## 3. Usuarios, espacios y privacidad

### 3.1 Conceptos

- **Usuario:** una persona con cuenta (email + contraseña) y un perfil (nombre visible, avatar).
- **Espacio:** unidad que comparte presupuesto. Tiene sus propias categorías, etiquetas, presupuestos y configuración de periodos.
  - Un espacio con un solo miembro es personal.
  - Un usuario puede pertenecer a varios espacios (p. ej. su espacio personal y el del hogar). Si pertenece a más de uno, cambia de espacio desde el encabezado.
- **Miembro:** relación usuario ↔ espacio, con rol y cuenta predeterminada propia.

| Rol | Puede |
|---|---|
| Propietario | Todo, incluido invitar o quitar miembros, borrar el espacio y cambiar la configuración |
| Editor | Registrar y editar movimientos, cuentas compartidas, categorías, etiquetas y presupuestos |
| Lector | Ver lo compartido |

### 3.2 Cuentas privadas y presupuesto conjunto

Cada cuenta pertenece a un espacio, tiene un **dueño** (usuario) y una **visibilidad**:

- **Compartida:** todos los miembros ven saldo y movimientos.
- **Privada:** solo el dueño ve la cuenta, su saldo y sus movimientos. Excepción: los movimientos marcados **"incluir en el espacio"**.
  - Esos movimientos los ven todos los miembros (monto, fecha, categoría, etiquetas y nota) y cuentan en el presupuesto conjunto.
  - La cuenta aparece como "Cuenta privada de X".
  - Cada cuenta privada define si sus movimientos se incluyen por defecto o no; se puede cambiar movimiento por movimiento.

Resultado: dos personas pueden tener cuentas separadas y llevar un presupuesto conjunto. Lo compartido suma en el espacio; lo personal queda privado.

**Caso inicial (Juan y su esposa):** un espacio "Hogar" con las dos personas y todas las cuentas compartidas, que es el comportamiento actual de 1Money. Las cuentas privadas quedan disponibles cuando las necesiten.

**Fuera de alcance por ahora:** saldar cuentas entre miembros ("quién le debe a quién", estilo Splitwise).

### 3.3 Registro, sesión e invitaciones

- Email + contraseña, con verificación de correo y recuperación de contraseña.
- No usar magic links: en iOS la PWA instalada no comparte sesión con Safari, así que el link abre en el navegador y no inicia sesión en la app.
- Al registrarse se crea el perfil (trigger en `auth.users`).
- **Onboarding** al primer inicio de sesión sin espacio:
  - Crear espacio con el asistente de configuración inicial (§7).
  - Aceptar una invitación pendiente (fase F1f).
- **Invitaciones** (fase F1f, cuando la app esté madura; hasta entonces el espacio tiene un solo miembro):
  - Requieren SMTP propio. Recomendado: SMTP de Gmail con contraseña de aplicación, sin dominio propio.
  - El propietario invita por email con un rol.
  - Una Edge Function envía la invitación y crea al usuario si no existe. Esto permite invitar aunque el registro público esté cerrado.
  - El link lleva un token con vencimiento.
- **Registro público:** cerrado al inicio (solo por invitación). La arquitectura queda lista para abrirlo.
- **Antes de abrir el registro a terceros:**
  - captcha en el registro (Supabase lo soporta);
  - límites de tasa;
  - política de tratamiento de datos (Ley 1581 de 2012);
  - exportación y borrado de los datos de un usuario.
- Login con Google: posible a futuro; probar antes el flujo en la PWA de iOS.

---

## 4. Conceptos financieros

### 4.1 Cuentas

Todo lo que tiene saldo es una cuenta, incluidas las deudas.

| Grupo | Tipos | Ejemplos actuales |
|---|---|---|
| Cuentas | efectivo, banco/débito, billetera | Efectivo, Bancolombia, Nequi, Lulo, Puntos Colombia |
| Ahorros | ahorro | Caja menor, Cadena, DollarApp (USD) |
| Deudas (debo) | tarjeta de crédito, préstamo con interés, deuda simple sin interés | Tarjetas, libre inversión Bancolombia, deudas del lote, deudas con personas |
| Me deben | por cobrar | Préstamos a terceros |
| Bienes (fase 2) | bien con valor manual | Lote, carro |

Atributos:

- nombre, ícono y color;
- tipo; el grupo se deriva del tipo;
- moneda;
- saldo inicial + fecha del saldo inicial;
- dueño y visibilidad (§3.2), e "incluir en el espacio por defecto" (solo aplica a las privadas);
- incluir en el total sí/no;
- orden;
- archivada.

**Convención de signo única:** saldo = saldo inicial + ingresos − gastos + transferencias entrantes − transferencias salientes. Las deudas tienen saldo negativo. Comprar con tarjeta es un gasto desde la cuenta de la tarjeta, así que la deuda crece. Pagarla es una transferencia hacia la tarjeta, así que la deuda baja. Los saldos se calculan; no se guardan.

Reglas de gestión (F1b):

- **Saldo de las deudas:** se escribe en positivo ("lo que debes") y se guarda en negativo. Si se cambia el tipo de una cuenta entre deuda y no deuda, se conserva el monto que ve el usuario y se ajusta el signo guardado.
- **Incluir en el total:** el valor por defecto depende del grupo.
  - Sí solo en **Cuentas** (dinero disponible).
  - No en Ahorros, Deudas, Me deben y Bienes: eso se ve en Mis finanzas.
  - El formulario lo precarga según el tipo mientras el usuario no lo toque, igual que el ícono y el color.
  - En la base de datos lo pone un trigger si no llega.
- **Cuenta predeterminada:** se limpia sola cuando la cuenta se archiva, o cuando se vuelve privada (para todos menos el dueño).
- **Bienes:** el tipo existe en la base de datos desde la F1b, pero la interfaz lo ofrece desde la F2.
- **Tipo y moneda:** se pueden editar mientras no haya movimientos (F1d).
- **Eliminar:** solo si la cuenta no tiene movimientos; si tiene, se archiva. Desde la F1d lo garantiza una FK `on delete restrict`, y la interfaz explica por qué no se puede.

### 4.2 Movimientos

Tipos: `gasto`, `ingreso`, `transferencia`, `ajuste`.

| Campo | Descripción |
|---|---|
| fecha | Fecha local (`date`). Nunca se convierte por zona horaria |
| monto | Positivo, en unidades menores (centavos); el tipo define la dirección |
| cuenta | Origen (o la cuenta afectada en un gasto o ingreso) |
| cuenta destino + monto destino | Solo en transferencias; si las monedas difieren, se guardan ambos montos reales |
| categoría | Categoría o subcategoría (gasto e ingreso) |
| etiquetas | 0..n |
| nota | Texto libre |
| incluir en el espacio | Solo aplica a cuentas privadas (§3.2) |
| operación | Agrupa movimientos que forman una sola operación (p. ej. pago de cuota = capital + interés + seguro) para editarlos juntos |
| financiación | Enlace opcional a un plan de cuotas (diferido de tarjeta o compra financiada con préstamo) |
| origen | `manual`, `recurrente`, `correo`, `atajo`, `importacion` |
| estado | `confirmado` o `pendiente` (bandeja "Por confirmar") |
| id externo | Para evitar duplicados en importaciones y automatizaciones |
| auditoría | `created_by`, `created_at`, `updated_at` |

Los ajustes sirven para conciliar con el saldo real del banco.

### 4.3 Categorías y subcategorías

- Pertenecen al espacio. Dos clases: gasto e ingreso. Máximo dos niveles (categoría → subcategoría).
- Un movimiento puede ir a la categoría directamente o a una subcategoría.
- Ícono, color, orden, archivada.
- Una subcategoría puede no tener color propio: hereda el de su categoría. Una subcategoría no puede tener hijos ni ser de otra clase que su padre, y la clase no cambia después de crearla.
- Eliminar: solo si no tiene movimientos (si tiene, se archiva). Eliminar una categoría elimina sus subcategorías, con una confirmación que las nombra.
- **Etiquetas por defecto:** una categoría o subcategoría puede traer etiquetas que se aplican solas al registrar (editables en el momento). Ej.: Casa › Arriendo → `Fijos`.
- Espacios nuevos: las categorías se crean en el asistente de configuración inicial (§7), desde cero o partiendo de la plantilla sugerida (Anexo A). No se importa nada de 1Money.

### 4.4 Etiquetas

- Pertenecen al espacio. Relación muchos a muchos con movimientos. Nombre y color.
- Se pueden archivar (dejan de ofrecerse al registrar, pero conservan su historial) o eliminar.
- Atraviesan categorías. Ej.: `Fijos` agrupa Casa › Arriendo y Servicios › Internet; `Salud` puede sumar Mis gastos › Salud y Emiliano › Salud.
- Reportes: total por etiqueta en el periodo, desglose de una etiqueta por categoría, y filtro por etiqueta en cualquier reporte o lista.
- Las plantillas recurrentes también llevan etiquetas.
- Presupuesto por etiqueta: después del MVP.

### 4.5 Periodos

Configuración del espacio:

- **Primer día del mes:** 1 a 28. Un "mes" va del día D al día D−1 del mes siguiente. Con D = 28: 28 nov – 27 dic.
- **Nombre del periodo:** mes en que termina (28 nov – 27 dic = "Diciembre"). La UI siempre muestra también el rango.
- **Primer día de la semana:** lunes por defecto.
- **Año:** 12 periodos mensuales alineados con el día de inicio.

Selector global (como el de 1Money):

- Opciones: Hoy, Día específico, Semana, Mes, Año, Siempre, Rango personalizado.
- Flechas anterior/siguiente para moverse entre periodos del mismo tipo.
- La selección es global: aplica a todas las pantallas y se recuerda por dispositivo.
- Periodo por defecto configurable (Mes).

Toda la lógica de rangos vive en una sola función pura con pruebas unitarias.

### 4.6 Monedas y formato

- Cada espacio tiene una moneda principal (COP en el caso inicial). Cada cuenta tiene su moneda (hoy COP y USD).
- Totales consolidados: convierten a la moneda principal con la tasa del día.
  - Fase 1: tasa manual.
  - Fase 2: TRM automática diaria, con opción de sobrescribirla.
- Las transferencias entre monedas guardan los dos montos reales (la tasa efectiva queda implícita).
- Formato configurable **por usuario**: separadores de miles y decimales, mostrar decimales sí/no. Por defecto el actual de 1Money: `-$ 1,234,567.90`.
  - Sin decimales, el monto se redondea a la unidad, alejándose de cero. Solo cambia lo que se muestra; lo guardado no cambia.
  - Al escribir, los separadores siguen el formato del usuario y se valida la agrupación de miles: en `1,234.56`, escribir "1,5" es un error, no 15.
- Cada moneda tiene un exponente ISO 4217 fijo para las unidades menores (COP, USD y EUR: 2) y un símbolo: COP `$`, USD `US$` (para no confundir dólares con pesos), EUR `€`; las demás usan su código.
- Un único pipe o servicio formatea montos en toda la app.

### 4.7 Presupuestos

- Pertenecen al espacio. Un monto por categoría de gasto que se repite cada periodo mensual hasta que se cambia (vigencia desde un periodo).
- Cuentan los movimientos compartidos del espacio: los de cuentas compartidas más los de cuentas privadas marcados "incluir en el espacio".
- Vista: gastado, presupuestado y restante por categoría, más el total. El restante también aparece en las burbujas de la pantalla de inicio.
- Interruptor para mostrar u ocultar presupuestos.
- Sin acumulación de sobrantes entre periodos.

---

## 5. Deudas

El modelo de cuentas ya las soporta desde la fase 1 (saldos, pagos como transferencias). La lógica de intereses, cuotas y prorrateo llega en la fase 2.

### 5.1 Tipos

**a) Préstamo con interés** (libre inversión Bancolombia)

- Datos: monto, fecha de desembolso, tasa (se ingresa EA o MV y se guarda como EA), plazo en meses, día de pago, seguros y cargos fijos mensuales.
- Tasa mensual = (1 + EA)^(1/12) − 1.
- Sistema de cuota fija (francés). Genera la tabla de amortización.
- Cada pago: la app propone interés = saldo × tasa mensual, más seguros, y capital = pago − interés − seguros. Todo es editable con las cifras reales del extracto, porque el banco calcula por días.
- Abono extraordinario: elegir entre reducir el plazo o la cuota; se recalcula la tabla.
- Conciliación: "ajustar al saldo del banco" crea un ajuste por la diferencia.

**b) Deuda simple sin interés** (lote, personas)

- Monto y plan de pagos opcional (cuotas con fecha y valor).
- Progreso en % pagado.

**c) Tarjeta de crédito**

- Datos: cupo, día de corte, día de pago, cuota de manejo.
- Tasa mensual vigente con historial: se actualiza cada mes desde el extracto.
- Compra a **1 cuota** (la mayoría): gasto normal en la fecha de compra, sin interés.
- Compra a **N > 1 cuotas**: crea un plan de cuotas (diferido) con capital = monto / N. El interés se calcula sobre el saldo del diferido con la tasa de la tarjeta, o es 0 si la compra se marca sin intereses.
- **Registro de compras con TC:**
  - Si la cuenta elegida es de tipo tarjeta de crédito, el registro muestra el campo "Cuotas" (por defecto 1).
  - Si Cuotas > 1, pide la tasa de interés mensual, prellenada con la tasa vigente de la tarjeta. 0 = sin interés, que es el caso más común hoy.
  - Desde la F1d se guardan cuotas y tasa con la compra. El reparto en presupuestos y el cálculo de intereses llegan en la F2; mientras tanto la compra cuenta completa en su fecha.
- Pago de la tarjeta: transferencia desde la cuenta pagadora. Intereses y cuota de manejo son gastos en Financieros.

**d) Me deben**

- Igual que la deuda simple, pero por cobrar. Prestar = transferencia hacia la cuenta por cobrar; recibir el pago = transferencia de vuelta. No es gasto ni ingreso.

### 5.2 Reglas contables

| Evento | Registro | Efecto en gastos del periodo |
|---|---|---|
| Desembolso de préstamo | Transferencia préstamo → cuenta | Ninguno (no es ingreso) |
| Pago de cuota | Operación: transferencia de capital + gasto de intereses + gasto de seguros | Solo intereses y seguros (Financieros) |
| Compra con tarjeta a 1 cuota | Gasto desde la tarjeta | Cuenta completo en la fecha de compra |
| Compra diferida (N > 1) | Gasto desde la tarjeta con plan de cuotas | Se reparte: cada cuota de capital cuenta en su periodo, en la categoría original |
| Compra marcada "financiada con préstamo X" | Gasto con enlace al préstamo | Se reparte según las cuotas de capital del préstamo; si varias compras comparten préstamo, en proporción a sus montos |
| Pago de tarjeta | Transferencia cuenta → tarjeta | Ninguno (lo comprado ya contó) |
| Pago de deuda simple | Transferencia cuenta → deuda | Ninguno |

El capital de un préstamo **no** enlazado a compras es una transferencia pura: no cuenta como gasto y aparece en el reporte de flujo como "pago a deudas". Así no se cuenta dos veces.

### 5.3 Reportes de deudas

- Saldo, % pagado, próxima cuota y fecha.
- Intereses pagados: en el periodo, acumulados y proyectados al final.
- Costo total de cada deuda.
- Simulador de abono a capital.
- Orden sugerido de pago (mayor tasa primero).

---

## 6. Reportes

Todos aceptan un **alcance**:

- **Espacio:** lo compartido; es lo que ven todos los miembros.
- **Personal:** mis cuentas privadas.

Reportes:

- **Resumen del periodo:** ingresos, gastos (con el prorrateo de §5.2) y balance.
- **Flujo real:** entradas y salidas de dinero de las cuentas líquidas, incluidos los pagos a deudas, y deuda adquirida vs. capital pagado vs. intereses en el periodo.
- **Patrimonio** (pestaña "Mis finanzas"): cuentas + ahorros + por cobrar + bienes − deudas, por moneda y consolidado.
  - Si se cuentan las deudas del lote sin contar el lote, el patrimonio sale engañosamente negativo; por eso existen los bienes.
- **Por categoría:** donut + lista con %, con detalle por subcategoría.
- **Por etiqueta**, por cuenta y por persona que registró.
- **Barras diarias del periodo,** apiladas por categoría.
- **Promedios:** por día, por semana y del mes.

---

## 7. Pantallas (MVP)

Navegación inferior como 1Money: **Cuentas · Categorías · Transacciones · Presupuesto · Resumen**. Pantalla de inicio configurable; por defecto, Categorías.

### Encabezado global

- Selector de espacio (solo si el usuario tiene más de uno).
- Total de cuentas.
- Selector de periodo: flechas + chip con el rango; al tocarlo abre un bottom sheet con las opciones de §4.5.

### Categorías (inicio)

- Pestañas Gastos / Ingresos.
- Burbujas de categoría alrededor del donut. Cada burbuja muestra:
  - nombre;
  - restante del presupuesto arriba;
  - gastado abajo;
  - relleno según el presupuesto consumido;
  - una marca si se pasó del presupuesto.
- En el centro del donut: total de gastos y total de ingresos del periodo.
- Tocar una categoría abre el registro rápido.

### Registro rápido (bottom sheet)

- Teclado numérico propio, con suma y resta.
- Cuenta: por defecto la predeterminada del miembro.
- Chips de subcategoría.
- Fecha: hoy por defecto, con atajo a ayer.
- Etiquetas: precargadas desde la categoría.
- Nota opcional.
- "Incluir en el espacio", solo si la cuenta es privada.
- Meta: guardar un gasto típico en 3 toques. En escritorio, todo usable con teclado.

### Cuentas

Pestañas:

- **Cuentas:** cuentas y ahorros, agrupados.
- **Deudas:** debo, me deben y completadas, con círculo de progreso.
- **Mis finanzas:** patrimonio por moneda y consolidado.

Desde la F1b la pestaña Cuentas lista los grupos Cuentas, Ahorros, Deudas y Me deben, cada uno con su total por moneda, más un total general por moneda de las cuentas con "incluir en el total". Las archivadas van en una sección plegada.

**Gestión:** crear y editar cuentas, categorías y etiquetas son pantallas con ruta propia:

- `/cuentas/nueva` y `/cuentas/:id`;
- `/configuracion/categorias/…`;
- `/configuracion/etiquetas/…`.

Los formularios son organismos que el asistente reutiliza tal cual.

### Transacciones

- Lista agrupada por día y búsqueda.
- Filtros: cuenta, categoría, etiqueta, tipo, persona y estado.
- Crear, editar y eliminar movimientos y transferencias.

### Presupuesto

Barras de gastado vs. presupuestado por categoría y total. Edición de montos.

### Resumen

Reportes de §6 para el periodo seleccionado.

### Autenticación

- Inicio de sesión, registro (oculto mientras el registro público esté cerrado) y recuperar contraseña.

### Asistente de configuración inicial

Se abre al primer inicio de sesión sin espacio. Guía paso a paso la configuración del espacio y la situación financiera actual.

- Pasos:
  1. **Espacio y preferencias:** nombre del espacio, moneda principal, formato de moneda, primer día del mes y de la semana.
  2. **Situación financiera actual:** cuentas, ahorros, deudas y "me deben", cada una con su saldo actual. Moneda por cuenta (p. ej. USD) y cuenta predeterminada. Las deudas piden solo nombre, tipo y saldo; los datos de tasa, plazo y cuotas se completan en la F2.
  3. **Ingresos:** categorías de ingreso (fuentes) y, opcional, el monto mensual esperado de cada una.
  4. **Categorías de gasto:** empezar desde cero o partir de la plantilla sugerida (Anexo A), y editar categorías y subcategorías con ícono y color.
  5. **Etiquetas:** crear etiquetas (p. ej. Fijos) y asignar etiquetas por defecto a subcategorías.
  6. **Presupuesto (opcional):** monto mensual por categoría de gasto.
  7. **Resumen:** todo lo configurado, con opción de volver a cualquier paso antes de terminar.
- Comportamiento:
  - El progreso se guarda en cada paso: si se cierra la app, se retoma donde quedó.
  - Los pasos opcionales se pueden saltar.
  - Reutiliza los mismos formularios de gestión de cuentas, categorías y etiquetas (sin duplicar código).
  - Se puede volver a abrir desde Configuración para revisar o completar la configuración.

### Configuración

- **Usuario:** perfil, tema claro/oscuro, pantalla de inicio, formato de moneda.
- **Espacio:**
  - nombre;
  - miembros e invitaciones;
  - moneda principal;
  - primer día del mes y de la semana;
  - periodo por defecto;
  - presupuesto on/off;
  - categorías, etiquetas y cuentas.

---

## 8. Modelo de datos (borrador)

Todas las tablas de negocio llevan `space_id`. Montos en `bigint` (unidades menores) + código de moneda ISO.

```
profiles (user_id, display_name, avatar_url, created_at)
spaces (id, name, icon, color, created_by, created_at)
space_members (space_id, user_id, role, default_account_id, joined_at)
  role: owner | editor | viewer
space_invitations (id, space_id, email, role, token_hash, invited_by, expires_at, accepted_at)
space_settings (space_id, main_currency, month_start_day, week_start, budgets_enabled, default_period,
                onboarding_step, onboarding_completed_at)
user_settings (user_id, theme, number_format, show_decimals, home_screen, last_space_id)

accounts (id, space_id, owner_id, visibility, name, kind, account_group, currency,
          initial_balance, initial_balance_date, icon, color, include_in_total,
          include_in_space_by_default, sort_order, archived_at, created_at)
  visibility: shared | private
  kind: cash | bank | wallet | savings | credit_card | loan | simple_debt | receivable | asset
  account_group: accounts | savings | debts | receivables | assets   -- columna generada desde kind
account_balances (account_id, space_id, currency, initial_balance, movements_total, balance)
  -- vista security_invoker; en la F1b movements_total = 0 y la F1d lo llena sin cambiar columnas
credit_card_details (account_id, credit_limit, statement_day, payment_day, monthly_fee)
card_rates (account_id, effective_from, monthly_rate)
loan_details (account_id, principal, disbursed_on, effective_annual_rate, term_months, payment_day, monthly_insurance)

installment_plans (id, space_id, account_id, kind, source_transaction_id, installments, rate, start_date)
  kind: loan_schedule | debt_plan | card_deferral
installments (id, plan_id, number, due_date, principal, interest, fees, status, operation_id)

categories (id, space_id, parent_id, kind, name, icon, color, sort_order, archived_at, created_at)
  kind: expense | income   -- color null solo en subcategorías (hereda el del padre)
tags (id, space_id, name, color, archived_at, created_at)
category_default_tags (space_id, category_id, tag_id)
  -- space_id redundante a propósito: con FKs compuestas (space_id, id) no se mezclan espacios

transactions (id, space_id, type, date, amount, currency, account_id, to_account_id, to_amount,
              category_id, note, include_in_space, operation_id, financing_plan_id,
              source, status, external_id, created_by, created_at, updated_at)
transaction_tags (transaction_id, tag_id)

budgets (id, space_id, category_id, amount, effective_from)
  -- category_id puede ser de gasto (presupuesto) o de ingreso (ingreso mensual esperado)
exchange_rates (date, base, quote, rate, source)
recurring_templates (fase 3)
```

### Reglas de acceso (RLS)

| Tabla | Lectura | Escritura |
|---|---|---|
| `spaces`, `space_settings`, `categories`, `tags`, `budgets` | Miembros del espacio | Propietario o editor (configuración y miembros: solo propietario) |
| `accounts` | Compartidas: miembros. Privadas: solo el dueño | Compartidas: propietario o editor. Privadas: solo el dueño, y además debe ser propietario o editor |
| `category_default_tags` | Miembros del espacio | Propietario o editor |
| `transactions` | Visible si la cuenta o la cuenta destino es visible para el usuario, o si `include_in_space = true` | Quien puede escribir en la cuenta de origen |

- Funciones auxiliares: `is_space_member(space_id)`, `space_role(space_id)`, `is_space_editor(space_id)`, `can_see_account(account_id)`.
- Un editor no puede volver privada la cuenta compartida de otro miembro: la política de escritura se evalúa también sobre la fila nueva.
- Las FKs compuestas `(space_id, …)` garantizan que la cuenta predeterminada, la categoría padre y las etiquetas por defecto sean del mismo espacio.
- RPCs de la F1b:
  - `set_default_account(space_id, account_id)` acepta solo cuentas activas del espacio y visibles para quien llama. Con cualquier otra cuenta responde el mismo error, para no filtrar si existe.
  - `reorder_categories(ids)` reordena hermanos y respeta la RLS.
- `icon` y `color` guardan claves del catálogo de íconos y de la paleta (§13.3), nunca valores hex.
- Saldos: vista SQL. Reportes: funciones RPC con `SECURITY INVOKER` (respetan RLS) que reciben un rango de fechas y el alcance. El cliente calcula el rango a partir de la configuración de periodo.

---

## 9. Automatización (fase 3; el modelo ya la soporta)

- **Plantillas recurrentes:**
  - Frecuencia, día, monto, cuenta, categoría y etiquetas.
  - Generan movimientos pendientes o confirmados.
  - Ejemplos: arriendo, Starlink, suscripciones.
- **Cuotas automáticas:** las cuotas de préstamos y diferidos generan pendientes en su fecha.
- **Correo:**
  1. Una función programada lee las notificaciones del banco del usuario (Gmail API, autorización por usuario).
  2. Extrae monto, comercio y fecha.
  3. Sugiere la categoría según el historial de ese comercio.
  4. Lo deja en "Por confirmar".
- **Atajos:** Atajo en iOS y widget o atajo en Android que llaman a un endpoint autenticado (token personal por usuario) para crear pendientes.

---

## 10. Fases

| Fase | Alcance |
|---|---|
| F0 · Setup | Repo, Supabase, Vercel, Angular PWA, Supabase CLI y migraciones, pantallas de login/registro/recuperar contraseña, guard de sesión, layout con navegación inferior y páginas vacías, deploy automático |
| F1a · Base multiusuario | Migraciones de perfiles, espacios, miembros y configuración (espacio y usuario); RLS con pruebas pgTAP; RPC para crear espacio; servicio de espacio activo y guard; entrada al asistente con el paso 1 (crear espacio). Base del sistema de diseño: estructura atomic, átomos y moléculas de formulario, pantallas de auth migradas, catálogo `/ui` |
| F1b · Catálogos | Catálogo de íconos y paleta de colores con sus pickers; cuentas de todos los tipos con saldo inicial (incluidas deudas y "me deben"), cuentas privadas, categorías y subcategorías, etiquetas y etiquetas por defecto; pantallas de gestión |
| F1c · Asistente | Asistente de configuración inicial completo (§7), reutilizando los formularios de F1b; plantilla sugerida (Anexo A) |
| F1d · Movimientos | Movimientos (gasto, ingreso, transferencia, ajuste), registro rápido con cuotas y tasa para TC, selector de periodos, pantalla de inicio Categorías, multimoneda con tasa manual |
| F1e · Reportes | Presupuestos, Transacciones (lista, filtros, edición), Resumen y el resto de Configuración |
| F1f · Compartir | SMTP (Gmail), invitaciones con Edge Function, onboarding por invitación. Cuando la app esté madura |
| F2 · Deudas | Préstamos con amortización, deudas simples con plan, tarjetas con diferidos, pagos con desglose, prorrateo en presupuestos, reportes de intereses, flujo real, bienes en patrimonio, TRM automática, alcance Personal en reportes |
| F3 · Automatización | Recurrentes, cuotas automáticas, correo, atajos, bandeja "Por confirmar" |
| F4 · Abrir a terceros | Registro público con captcha, límites de tasa, política de datos, exportar y borrar cuenta, plantilla genérica de categorías pulida |

---

## 11. Convenciones técnicas

- TypeScript strict. Componentes standalone. Estado con signals.
- Código e identificadores en inglés; interfaz en español (preparada para i18n más adelante).
- Separación de responsabilidades en archivos distintos (componente, plantilla, estilos, servicio).
- Componentes según atomic design y sistema de diseño (§13).
- Lógica de dominio pura en `src/app/domain/`, sin dependencias de Angular y con pruebas unitarias: dinero, periodos, amortización y prorrateo.
- Nada de valores quemados: configuración, tokens de diseño y constantes centralizadas.
- Comentarios: solo TSDoc de una línea en símbolos exportados, una nota corta donde algo parece incorrecto pero es deliberado, y TODOs. Nada más.
- Montos: siempre enteros en unidades menores. Nunca `float` para dinero. Formateo solo a través del pipe o servicio de moneda.
- Fechas de movimiento: cadena `YYYY-MM-DD` local. Sin conversiones de zona horaria.
- Base de datos:
  - Cambios solo mediante migraciones en `supabase/migrations`.
  - RLS obligatorio en todas las tablas.
  - Pruebas de políticas RLS con pgTAP (`supabase test db`): un usuario no ve espacios ajenos ni cuentas privadas de otro miembro.
  - Tipos TS regenerados tras cada migración.
- Llaves:
  - En el frontend solo la publishable/anon key, que es pública por diseño (la seguridad la da RLS).
  - La service role key solo en Edge Functions. Nunca en el repo.

---

## 12. Decisiones

- [x] Nombre: Cuentas Claras (repo `CuentasClaras`).
- [x] 1Money: no se importa nada. Todo se configura desde cero con el asistente de configuración inicial.
- [x] Compras a cuotas con TC: hoy son sin interés; al registrar una compra a más de 1 cuota con TC, la app pide la tasa (0 = sin interés).
- [x] Invitaciones y SMTP: se posponen a la F1f. Hasta entonces el espacio tiene un solo miembro.
- [x] Entorno de desarrollo de base de datos: Supabase local en Docker (`supabase start`), con seed propio. Las pruebas pgTAP corren solo en local (en Windows `supabase test db` siempre usa un contenedor). Producción solo con `--remote=<ref>` explícito.
- [x] Postgres 17 en local y en producción (17.12): el esquema usa `on delete set null (columna)` y `nulls not distinct`.
- [x] F1b: el detalle de las reglas de cuentas, categorías, etiquetas, montos e íconos está en §4.1, §4.3, §4.4, §4.6, §8 y §13.3.

---

## 13. Sistema de diseño y personalización

Meta: un diseño visual excelente y muy personalizable, con estilos centralizados para que un cambio se haga en un solo lugar.

### 13.1 Atomic design

| Nivel | Qué es | Ejemplos | Carpeta |
|---|---|---|---|
| Tokens | Variables de diseño | Colores, tipografía, espaciado, radios, sombras, movimiento | `src/styles` |
| Átomos | Piezas mínimas, sin lógica de negocio | `cc-button`, `cc-icon`, `cc-icon-badge`, `cc-text-field`, `cc-money-field`, `cc-select`, `cc-amount`, `cc-color-swatch` | `shared/ui/atoms` |
| Moléculas | Combinaciones de átomos | `cc-icon-picker`, `cc-color-picker`, `cc-category-chip`, `cc-account-row`, `cc-form-actions`, `cc-period-chip` | `shared/ui/molecules` |
| Organismos | Secciones completas que reciben datos por inputs | `cc-category-grid`, `cc-quick-entry-sheet`, `cc-account-list`, `cc-budget-list`, `cc-wizard-stepper` | `shared/ui/organisms` |
| Plantillas | Layouts sin datos | Layout de auth, shell de la app, layout del asistente, layout de página | `shared/ui/templates` |
| Páginas | Rutas: conectan servicios y estado con organismos | `features/*/…-page` | `features` |

Reglas:

- Las páginas componen organismos y moléculas. No usan componentes de Angular Material directamente ni tienen estilos propios, salvo layout.
- Angular Material solo se usa dentro de átomos y moléculas. Cambiar el estilo de todos los campos = cambiar un solo componente.
- Átomos y moléculas son presentacionales: inputs/outputs, OnPush, sin servicios de datos.
- Los campos de formulario son controles personalizados compatibles con Signal Forms.
- Prefijo de selector `cc-`.
- Antes de crear un componente, buscar si ya existe uno que se pueda reutilizar o extender.
- Catálogo `/ui`, solo en desarrollo: muestra cada componente reutilizable con sus variantes, en claro y oscuro.

### 13.2 Tema

- Un solo lugar para el tema: paleta Material 3 en `_theme.scss` y tokens `--cc-*` en `_tokens.scss`.
- Nada de colores, tamaños, radios ni sombras sueltos en los componentes: todo sale de tokens.
- Modo claro, oscuro o según el sistema, como preferencia de cada usuario.
- Más adelante: que cada usuario elija el color principal de la app (paleta Material 3 generada en tiempo de ejecución).

### 13.3 Íconos y colores personalizables

Llevan ícono y color: categorías, subcategorías, cuentas y espacios. Las etiquetas llevan color.

**Íconos**

- Material Symbols Rounded, self-hosted para que funcionen sin conexión.
- Catálogo curado de varios cientos de íconos, agrupados (Hogar, Comida, Transporte, Salud, Familia y niños, Mascotas, Educación, Ocio, Compras, Tecnología, Finanzas, Viajes, Trabajo, Otros), con palabras clave en español para buscar.
- Si la fuente completa pesa mucho, se genera un subset con los íconos del catálogo y los de la interfaz.
- **Implementación (F1b):**
  - `npm run icons:build` genera el subset de forma reproducible:
    - descarga la fuente variable y sus codepoints de `google/material-design-icons`, con commit fijo y SHA-256 verificado;
    - fija peso 400, grado 0 y tamaño óptico 24, y conserva el eje de relleno (FILL) para los badges.
  - El woff2 y el mapa `icon-codepoints.generated.ts` se commitean: el build no corre el script ni necesita red.
  - Los íconos se dibujan por codepoint, no por ligadura. El nombre del ícono es un tipo (`IconName`), así que el compilador avisa si se usa uno que no está en el subset.

**Colores**

- Paleta curada de unos 30 colores, cada uno con variante para tema claro y oscuro, y con contraste suficiente para un ícono blanco encima.
- Se guarda la clave del color (p. ej. `teal`), no el hex: si cambia la paleta o el tema, todo se actualiza solo.
- Las subcategorías heredan por defecto el color de su categoría y pueden cambiarlo.
- Contraste mínimo de 3:1 de un ícono blanco sobre cada color, en claro y en oscuro (WCAG 1.4.11, gráfico no textual). Una prueba unitaria lo verifica.
- La paleta vive en un archivo TypeScript y cada color se aplica como `light-dark(claro, oscuro)` en una variable CSS, así que cambia sola con el tema.

**Selectores**

- Picker de íconos con búsqueda y grupos; picker de color en grilla.
- En móvil se abren como bottom sheet; en escritorio, como diálogo.

**Fuente única:** el catálogo de íconos y la paleta viven cada uno en un solo archivo, y de ahí salen tanto los pickers como los estilos.

### 13.4 Calidad visual

- Cada cambio de UI se verifica con screenshots de Playwright en móvil y escritorio, en claro y oscuro.
- Microinteracciones sutiles (ripple, transiciones cortas), respetando `prefers-reduced-motion`.
- Accesibilidad: contraste AA en textos, áreas táctiles de al menos 44 px y label en todos los campos.

---

## Anexo A — Plantilla sugerida de categorías

Opcional en el asistente: se puede editar todo o empezar desde cero.

**Gastos**

| Categoría | Subcategorías |
|---|---|
| Hogar | Arriendo o hipoteca, Servicios públicos, Internet y telefonía, Mantenimiento, Aseo |
| Mercado | Supermercado, Plaza, Tienda |
| Transporte | Combustible, Transporte público, Mantenimiento del vehículo, Parqueadero, Peajes |
| Salud | Medicamentos, Consultas, Seguros de salud |
| Educación | Colegio, Útiles, Cursos |
| Ocio | Salidas, Viajes, Juegos |
| Restaurantes y domicilios | Restaurantes, Domicilios, Antojos |
| Compras | Ropa, Tecnología, Hogar |
| Suscripciones | Streaming, Software, Otras |
| Mascotas | Comida, Veterinario |
| Regalos | — |
| Financieros | Intereses, Cuota de manejo, Seguros, Comisiones |
| Otros | — |

**Ingresos:** Salario, Trabajo independiente, Intereses, Otros.

**Etiquetas sugeridas:** Fijos.
