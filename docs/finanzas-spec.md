# Cuentas Claras — Especificación funcional y técnica

> Versión 0.12 · 27-nov-2026 · Repo: `Jucapo/CuentasClaras`
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
| Gráficas | Donut de Categorías en SVG propio; barras del Resumen con ECharts 6 (`ngx-echarts` 22, import modular, en un chunk diferido) | El donut replica el anillo segmentado de 1Money; el Resumen no lo usa |
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
  - Un usuario puede pertenecer a varios espacios (p. ej. su espacio personal y el del hogar). Si pertenece a más de uno, cambia de espacio desde el encabezado (§7).
- **Miembro:** relación usuario ↔ espacio, con rol y cuenta predeterminada propia.

| Rol | Puede |
|---|---|
| Propietario | Todo, incluido invitar o quitar miembros, borrar el espacio y cambiar la configuración |
| Editor | Registrar y editar movimientos, cuentas compartidas, categorías, etiquetas y presupuestos |
| Lector | Ver lo compartido |

Miembros (F1f):

- **Roles:** el propietario cambia el rol de los demás y los quita. Nadie cambia su propio rol: para dejar de ser propietario, otro propietario lo cambia.
- **Salir:** cualquiera sale del espacio, menos su último propietario.
- **Al menos un propietario:** lo garantiza la base, no solo la interfaz. Un trigger bloquea el espacio mientras revisa, así dos cambios simultáneos no lo dejan sin propietario. Borrar el espacio sí borra a todos.
- **Correos:** los miembros ven el nombre, el correo y el rol de los demás.

### 3.2 Cuentas privadas y presupuesto conjunto

Cada cuenta pertenece a un espacio, tiene un **dueño** (usuario) y una **visibilidad**:

- **Compartida:** todos los miembros ven saldo y movimientos.
- **Privada:** solo el dueño ve la cuenta, su saldo y sus movimientos. Excepción: los movimientos marcados **"incluir en el espacio"**.
  - Esos movimientos los ven todos los miembros (monto, fecha, categoría, etiquetas y nota) y cuentan en el presupuesto conjunto.
  - La cuenta aparece como "Cuenta privada de X".
  - Cada cuenta privada define si sus movimientos se incluyen por defecto o no; se puede cambiar movimiento por movimiento.

Resultado: dos personas pueden tener cuentas separadas y llevar un presupuesto conjunto. Lo compartido suma en el espacio; lo personal queda privado.

**Caso inicial (Juan y su esposa):** un espacio "Hogar" con las dos personas y todas las cuentas compartidas, que es el comportamiento actual de 1Money. Las cuentas privadas quedan disponibles cuando las necesiten.

**Quien sale o es removido (F1f):** se borra su membresía y nada más.

- Sus cuentas compartidas y los movimientos en ellas quedan en el espacio, como historia compartida.
- Sus cuentas privadas quedan ocultas para todos, también para él, porque ya no es miembro. Sus movimientos "incluidos en el espacio" siguen visibles y contando en el presupuesto conjunto.
- Si vuelve al espacio, recupera todo.
- Los reportes lo nombran "Otra persona", porque su perfil ya no se ve.
- Las confirmaciones de salir y de quitar lo explican.

**Fuera de alcance por ahora:** saldar cuentas entre miembros ("quién le debe a quién", estilo Splitwise).

### 3.3 Registro, sesión e invitaciones

- Email + contraseña, con verificación de correo y recuperación de contraseña.
- No usar magic links: en iOS la PWA instalada no comparte sesión con Safari, así que el link abre en el navegador y no inicia sesión en la app.
- Al registrarse se crea el perfil (trigger en `auth.users`).
- **Onboarding** al primer inicio de sesión sin espacio:
  - Crear espacio con el asistente de configuración inicial (§7).
  - Aceptar una invitación pendiente: el paso 1 del asistente la muestra arriba de "Crear espacio".
- **Invitaciones** (F1f):
  - **Correo:**
    - Los correos de Auth (invitación, recuperar contraseña, cambio de correo) salen por el SMTP de Gmail, con contraseña de aplicación y sin dominio propio.
    - Las plantillas de invitación y de recuperar contraseña están en español y con la marca (`supabase/templates`).
    - La configuración de producción está en `docs/runbooks/f1f-compartir.md`.
  - **Invitar:** solo el propietario, por correo y con un rol.
  - **El token:**
    - Cada invitación tiene un token propio: 32 bytes al azar, en hex. La base guarda solo su `sha256`.
    - Vence en 7 días, es de un solo uso y queda ligado al correo invitado.
    - El link es `/invitacion?token=…`.
  - **Edge Function `invite-member`** (las Edge Functions no pueden abrir SMTP: el correo lo envía Auth):
    - Verifica el JWT y que quien llama sea propietario, y crea la invitación por RPC con ese mismo JWT.
    - **Correo sin cuenta confirmada:** llama `inviteUserByEmail`, que crea al usuario aunque el registro esté cerrado y envía el correo. El link del correo es el de la invitación más el `token_hash` de Auth.
    - **Correo con cuenta:** no envía correo. Devuelve el link para que el propietario lo copie o lo comparta, y la persona ve la invitación al entrar a la app.
    - El propietario se entera de si un correo ya tiene cuenta. Se acepta mientras el registro esté cerrado y se revisa en la F4.
  - **El link del correo** depende del vencimiento de los OTP de Auth: 24 h, el máximo. Si vence o ya se usó, el propietario reenvía.
  - **Reenviar:**
    - El token crudo solo existe al crear o al reenviar, así que reenviar rota el token: el link anterior deja de servir y el vencimiento vuelve a 7 días desde hoy.
    - A una cuenta invitada que todavía no aceptó (existe en Auth pero sin confirmar), Auth le reenvía el correo con un `token_hash` nuevo. No responde `email_exists`: lo comprueba el e2e local, que además verifica que el `token_hash` anterior ya no sirve.
  - **Revocar** no borra al usuario que creó la invitación: sin contraseña no puede entrar, y una invitación nueva lo reutiliza.
- **Aceptar** (`/invitacion`, pensado para iOS):
  - **Dónde abre:** el link abre en Safari, no en la PWA, porque no comparten sesión. Nada depende de que la sesión siga después.
  - **Cuenta nueva** (llega con `token_hash`):
    - Elige su nombre visible y su contraseña, y acepta.
    - El `token_hash` se verifica al enviar el formulario, no al cargar, para que un escáner de links no lo gaste. Si este navegador ya tiene la sesión de esa persona (un reintento), no se verifica de nuevo.
  - **Cuenta existente:** inicia sesión (con el login de siempre, que vuelve a la invitación) y acepta o rechaza. Con otra cuenta abierta, la página avisa y ofrece cerrar sesión.
  - **Al aceptar:** queda la membresía con el rol y una cuenta predeterminada, y el espacio queda como el último usado.
    - La cuenta predeterminada es la de quien invitó si es compartida y activa. Si no, la primera compartida activa del grupo Cuentas. Si no hay, ninguna.
  - **Al terminar** (fuera de la app instalada): cómo instalarla (iOS: Compartir → Agregar a inicio; Android: "Instalar") y "Entra con tu correo y contraseña".
  - **Dentro de la app:** con un espacio y una invitación pendiente, un aviso persistente "Te invitaron a «X»" con "Ver" (una vez por visita), que abre la misma página.
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

**Convención de signo única:** saldo = saldo inicial + ingresos − gastos + transferencias entrantes − transferencias salientes ± ajustes. Las deudas tienen saldo negativo. Comprar con tarjeta es un gasto desde la cuenta de la tarjeta, así que la deuda crece. Pagarla es una transferencia hacia la tarjeta, así que la deuda baja. Los saldos se calculan; no se guardan.

- Cuentan los movimientos confirmados con fecha igual o posterior a la del saldo inicial. Los anteriores ya están dentro de ese saldo, así que no lo cambian, pero sí cuentan en los totales de su periodo. Registrar gastos de días anteriores al asistente no descuadra los saldos.
- Una transferencia entrante suma lo que llegó, en la moneda de la cuenta destino.

Reglas de gestión (F1b):

- **Saldo de las deudas:** se escribe en positivo ("lo que debes") y se guarda en negativo. Si se cambia el tipo de una cuenta entre deuda y no deuda, se conserva el monto que ve el usuario y se ajusta el signo guardado.
- **Incluir en el total:** el valor por defecto depende del grupo.
  - Sí solo en **Cuentas** (dinero disponible).
  - No en Ahorros, Deudas, Me deben y Bienes: eso se ve en Mis finanzas.
  - El formulario lo precarga según el tipo mientras el usuario no lo toque, igual que el ícono y el color.
  - En la base de datos lo pone un trigger si no llega.
- **Cuenta predeterminada:** se limpia sola cuando la cuenta se archiva, o cuando se vuelve privada (para todos menos el dueño).
- **Bienes:** el tipo existe en la base de datos desde la F1b, pero la interfaz lo ofrece desde la F2.
- **Tipo y moneda:** se pueden editar mientras no haya movimientos. Desde la F1d lo garantiza un trigger, y la pantalla de la cuenta deshabilita esas filas con la explicación.
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

Reglas (F1d):

- **Ajuste:** el monto sigue positivo y la dirección va en `adjustment_direction`: `increase` sube el saldo y `decrease` lo baja. Es obligatoria en los ajustes y null en los demás tipos. Los ajustes no llevan categoría ni cuentan en los totales por categoría.
- **Categoría:** obligatoria en gasto e ingreso, y de su misma clase. Las transferencias y los ajustes no llevan. Solo un movimiento pendiente (F3) puede llegar sin categoría.
- **Transferencias:**
  - Solo hacia otra cuenta que quien registra puede ver.
  - Si las monedas difieren, el monto destino es obligatorio; si son iguales, no se guarda.
- **Moneda:** la del movimiento es la de su cuenta; la copia la base de datos.
- **Incluir en el espacio:** solo aplica a gastos e ingresos de cuentas privadas, y por defecto toma lo que diga la cuenta. En las compartidas, y en transferencias y ajustes, siempre es falso. Si una cuenta compartida se vuelve privada, sus movimientos quedan privados.
- **Guardado idempotente:** el cliente genera el id del movimiento al abrir el registro. Guardar con un id que ya existe, y que quien llama puede escribir, lo actualiza; así un reintento no duplica.
- **Deshacer:** al crear un movimiento, el aviso de guardado trae "Deshacer", que lo elimina con sus etiquetas y su diferido. Al editar no aparece.
- **Borrar y editar:** se puede quien puede escribir en la cuenta de origen y además ve la cuenta destino. Así nadie cambia el saldo privado de otro.

### 4.3 Categorías y subcategorías

- Pertenecen al espacio. Dos clases: gasto e ingreso. Máximo dos niveles (categoría → subcategoría).
- Un movimiento puede ir a la categoría directamente o a una subcategoría.
- Ícono, color, orden, archivada.
- Una subcategoría puede no tener color propio: hereda el de su categoría. Una subcategoría no puede tener hijos ni ser de otra clase que su padre, y la clase no cambia después de crearla.
- Eliminar: solo si no tiene movimientos (si tiene, se archiva). Eliminar una categoría elimina sus subcategorías, con una confirmación que las nombra.
- **Etiquetas por defecto:** una categoría o subcategoría puede traer etiquetas que se aplican solas al registrar (editables en el momento). Ej.: Casa › Arriendo → `Fijos`.
  - Se asignan desde los dos lados: en la pantalla de categoría (y el sheet de subcategoría) se eligen sus etiquetas; en el sheet de una etiqueta, "¿En qué categorías se pone sola?" muestra el árbol de categorías y subcategorías con casillas, independientes entre sí.
- Espacios nuevos: las categorías de gasto y de ingreso se crean en el asistente de configuración inicial (§7), desde cero o partiendo de la plantilla sugerida (Anexo A). No se importa nada de 1Money.

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
  - Se recuerda el **tipo**. Al abrir la app, Día, Semana, Mes y Año vuelven al periodo actual; Siempre y el rango personalizado se restauran tal cual.
  - Sin nada recordado, se usa el periodo por defecto del espacio.
- Periodo por defecto configurable (Mes).
- La flecha mueve un rango personalizado en bloques de su mismo largo; Siempre no tiene flechas.
- Nombres: "Hoy", "Ayer", "Jueves 26 nov", "Semana del 23 nov", "Diciembre" (con el año si no es el actual), "2026", "Siempre". El rango va al lado ("28 nov – 27 dic").
- Presupuestos por periodo: el Mes usa el de su mes, y el Año suma los 12 meses. Día, Semana, Siempre y el rango personalizado no muestran presupuesto.

Toda la lógica de rangos vive en una sola función pura con pruebas unitarias.

### 4.6 Monedas y formato

- Cada espacio tiene una moneda principal (COP en el caso inicial). Cada cuenta tiene su moneda (hoy COP y USD).
- Totales consolidados: convierten a la moneda principal con la tasa del día.
  - Fase 1: tasa manual.
  - Fase 2: TRM automática diaria, con opción de sobrescribirla.
- **Tasas manuales (F1d):**
  - Son del espacio; las escriben propietario o editor en Configuración → Monedas.
  - Hay una por par y día, en cualquiera de los dos sentidos; guardar otra el mismo día la reemplaza.
  - Se escriben como "1 US$ = $ X", con hasta 6 decimales.
  - Un movimiento usa la tasa más reciente con fecha igual o anterior a la suya. Si no hay ninguna anterior, usa la más antigua, para no dejar sin convertir lo anterior a la primera tasa.
  - Un saldo o total de hoy usa la tasa más reciente.
  - Si hay cuentas en otra moneda y no hay tasa, la app la pide la primera vez que la necesita. Mientras falte, esos montos no suman y el total lo avisa.
- Las transferencias entre monedas guardan los dos montos reales (la tasa efectiva queda implícita).
- Formato configurable **por usuario**: separadores de miles y decimales, mostrar decimales sí/no. Por defecto el actual de 1Money: `-$ 1,234,567.90`.
  - Sin decimales, el monto se redondea a la unidad, alejándose de cero. Solo cambia lo que se muestra; lo guardado no cambia.
  - Al escribir, los separadores siguen el formato del usuario y se valida la agrupación de miles: en `1,234.56`, escribir "1,5" es un error, no 15.
  - **Formato mientras se escribe (F1d)**, en los campos de monto y en el registro rápido:
    - Los separadores de miles se ponen solos (`1.250.000`) y el cursor se queda junto al mismo dígito.
    - Borrar sobre un separador borra el dígito de al lado.
    - Escribir a mano el separador de miles y dejar mal la agrupación no se reinterpreta: el texto queda como está con el error. Mientras ese error siga, el campo no se reagrupa.
    - Con `show_decimals` apagado, el teclado del registro rápido no ofrece la tecla decimal.
- Cada moneda tiene un exponente ISO 4217 fijo para las unidades menores (COP, USD y EUR: 2) y un símbolo: COP `$`, USD `US$` (para no confundir dólares con pesos), EUR `€`; las demás usan su código.
- Un único pipe o servicio formatea montos en toda la app.

### 4.7 Presupuestos

- Pertenecen al espacio. Un monto por categoría de gasto que se repite cada periodo mensual hasta que se cambia (vigencia desde un periodo).
  - La vigencia se guarda como el primer día del mes con que se nombra el periodo (el mes en que termina, §4.5), así que cambiar el día de inicio del mes no mueve los presupuestos.
  - Cada monto lleva su moneda; por defecto la principal del espacio. Mientras no haya conversión (F1d), los totales se muestran por moneda.
  - Un monto de 0 quita el presupuesto desde ese periodo.
  - La misma tabla guarda el **ingreso mensual esperado** de las categorías de ingreso, con las mismas reglas.
- Cuentan los movimientos compartidos del espacio: los de cuentas compartidas más los de cuentas privadas marcados "incluir en el espacio".
- Vista: gastado, presupuestado y restante por categoría, más el total. El restante también aparece en las burbujas de la pantalla de inicio.
- Interruptor para mostrar u ocultar presupuestos.
- Sin acumulación de sobrantes entre periodos.

Presupuesto por subcategoría (F1e):

- Cada subcategoría puede tener su propio monto. `budgets` ya acepta subcategorías, así que el esquema no cambia.
- **Presupuesto de una categoría:** su monto propio más la suma de los de sus subcategorías.
  - El monto propio cubre lo registrado directamente en la categoría y se muestra como la fila "General".
  - Los montos que ya existen (los puso el asistente por categoría) quedan como "General", sin migrar datos.
- **Por fila:** gastado, restante y excedido se calculan por fila (General y cada subcategoría) y se suman en la categoría.
  - Si la categoría tiene algún presupuesto, una fila sin monto pero con gasto se marca como excedida por lo gastado.
  - Una categoría sin ningún presupuesto solo muestra lo gastado, sin marcar excedida ninguna fila.
  - Solo aplica a gastos: en ingresos, una fila sin monto con lo recibido no es un exceso.
- **En las burbujas del inicio:** el total de la categoría (§7).
- **Ingresos esperados:** las mismas reglas, con lo recibido en lugar de lo gastado.

Alcance de una edición (F1e, vista Mes):

- Arriba de la lista, un selector de alcance: "Solo {mes}" (por defecto) o "{mes} y los siguientes". Se elige una vez y aplica a cada fila que se edite, también a las de subcategoría y a "Quitar presupuesto".
- **"Solo {mes}":** guarda el monto en ese mes y, si el mes siguiente no tiene monto propio, le guarda el que regía antes. Así los meses siguientes no cambian.
  - Si antes no regía ninguno, le guarda 0 ("sin monto").
  - Se guarda primero el mes siguiente, para que un fallo a mitad de camino no cambie los meses que vienen.
- **"{mes} y los siguientes":** guarda desde ese mes. Los meses posteriores que ya tienen monto propio lo conservan, y la fila dice desde cuál.
- **Marca "Solo {mes}":** la fila la muestra, discreta, cuando el monto de ese mes es propio y distinto del de los meses siguientes.
- **Meses pasados:** se editan igual, con el mismo selector.
- **El asistente (paso 6) no cambia:** sus montos son el "General" de cada categoría y rigen hacia adelante.

Pantalla Presupuesto (F1e):

- **Por periodo:**
  - **Mes:** editable.
  - **Año:** suma los 12 meses y es de solo lectura ("Para cambiar montos, elige un mes").
  - **Día, Semana, Siempre y rango personalizado:** no muestran presupuesto y ofrecen ir al mes actual.
- **Secciones:** "Gastos" e "Ingresos esperados", cada una encabezada por su fila de total con el mismo estilo de las filas.
  - La de Gastos es el presupuesto total contra todo lo gastado del periodo (alcance Espacio, en la moneda principal), y debajo dice cuánto fue a categorías sin presupuesto ("Sin presupuesto: $X").
  - En ingresos, recibir de más es buena noticia: la pastilla va en tono positivo, no de error.
- **Lista:** cada categoría principal activa, en su orden, con su total, como en 1Money.
  - El fondo de la fila es la barra de avance, en un tono suave del color de la categoría, con `role="progressbar"`.
  - A la izquierda, el ícono, el nombre y lo gastado. A la derecha, una pastilla con el restante o el excedido (este, resaltado en color de error) y "presupuestado $X" debajo.
  - El texto cumple contraste AA sobre el fondo.
- **Detalle de una categoría:** se abre al tocarla, como sheet en compacta y en el panel de detalle en expandida (§13.5).
  - **Encabezado:** el periodo, lo gastado, lo restante y lo presupuestado.
  - **Filas:** "General" y cada subcategoría, con el monto editable en la fila, lo gastado y lo restante.
  - **"Ver transacciones":** abre Transacciones filtrado por la categoría, en el periodo actual.
  - **"Quitar presupuesto":** pone en 0 el General y las subcategorías, con confirmación y con el alcance elegido.
  - **En compacta (y en mediana, como diálogo):** es un solo sheet (§13.5). La calculadora y la confirmación de "Quitar presupuesto" son vistas dentro de él, con ← para volver al detalle.
    - Al confirmar, vuelve al detalle con la fila actualizada y el scroll donde estaba.
    - Esc y el atrás del sistema también vuelven al detalle sin cerrar el sheet.
    - "Ver transacciones" cierra el sheet y navega.
  - **En expandida:** el detalle está en el panel, y la calculadora y la confirmación se abren como diálogo.
- **Calculadora:**
  - Cada fila editable suma un botón que abre el teclado del registro rápido (`cc-keypad` y `cc-amount-display`): una vista dentro del detalle en compacta y mediana, un diálogo en expandida.
  - Trae un encabezado de contexto: "Categoría › Subcategoría", el periodo, lo gastado, lo restante y el presupuesto actual.
  - El resultado vuelve a la fila y se guarda con el alcance elegido.
  - La edición sigue siendo en la fila ("Menos modales", §13.5).
- **Presupuestos apagados:** Presupuesto sigue en la navegación y dice que están apagados. El propietario ve el interruptor para encenderlos; los demás, el texto.
- **Lector:** ve los montos sin poder editarlos.

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
  - Se guardan en `installment_plans` (`card_deferral`), que apunta a la compra: el plan se borra con ella y sigue su cuenta y su fecha. Si la compra deja de ser un gasto con tarjeta, el plan se borra.
  - Hasta que exista el historial de tasas de la tarjeta (F2), la tasa se prellena con 0.
  - Cuotas de 1 a 48; tasa mensual desde 0 hasta menos de 100 %.
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

- **Resumen del periodo:** ingresos, gastos (con el prorrateo de §5.2), balance y tasa de ahorro (balance / ingresos), con la comparación contra el periodo anterior.
- **Flujo real:** entradas y salidas de dinero de las cuentas líquidas, incluidos los pagos a deudas, y deuda adquirida vs. capital pagado vs. intereses en el periodo.
- **Patrimonio** (pestaña "Mis finanzas"): cuentas + ahorros + por cobrar + bienes − deudas, por moneda y consolidado.
  - Si se cuentan las deudas del lote sin contar el lote, el patrimonio sale engañosamente negativo; por eso existen los bienes.
  - Los bienes entran con su valor manual desde la F2; hasta entonces el patrimonio no los cuenta.
- **Por categoría:** barras con % y lista, con detalle por subcategoría.
- **Por etiqueta**, por cuenta y por persona que registró.
- **Barras diarias del periodo,** apiladas por categoría.
- **Promedios:** por día, por semana y del mes.

Detalle (F1e2):

- **Alcance:** los reportes del Resumen usan el alcance Espacio, igual que Categorías y Presupuesto (§4.7). El alcance Personal llega en la F2.
- **Conversión:** cada movimiento se convierte a la moneda principal por separado, con la tasa de su fecha. Así cualquier reparto (por día, categoría, cuenta, persona o etiqueta) suma exactamente el mismo total. Lo que no tiene tasa no suma y se avisa.
- **Comparación con el periodo anterior:**
  - **Periodo en curso:** contra el anterior hasta el mismo punto, es decir, los mismos días transcurridos (sin pasar del fin del anterior).
  - **Periodo terminado:** contra el anterior completo.
  - Siempre y los periodos futuros no tienen comparación. El rango personalizado compara contra el bloque anterior de su mismo largo.
  - La nota dice el cambio en % y contra qué rango compara, con el formato de periodos de la app: "▼ 9 % vs. 28 sep – 26 oct". Que suban los gastos va en tono de error y que suban los ingresos, en tono positivo. Si el anterior es 0, no hay nota.
- **Barras:** se apilan las 3 categorías mayores del periodo, cada una con su color, y el resto en gris. En Año, en Siempre y en rangos largos, las barras van por mes del periodo.
- **Promedios:** se cuentan los días desde el inicio del periodo (en Siempre, desde el primer movimiento) hasta el fin, o hasta hoy si está en curso.
  - Por día = total / días; por semana = por día × 7.
  - Mes: en el periodo Mes es el total del periodo; en los demás, por día × 365,2425 / 12 ("Mes (prom.)").
  - Se redondean a unidades menores, alejándose de cero.

---

## 7. Pantallas (MVP)

Destinos como en 1Money: **Cuentas · Categorías · Transacciones · Presupuesto · Resumen**. En móvil van en la navegación inferior; en pantallas medianas y grandes, en un rail lateral (§13.5). Pantalla de inicio configurable; por defecto, Categorías.

### Encabezado global

- Selector de espacio (solo si el usuario tiene más de uno). Desde la F1f es un botón con el ícono del espacio activo, antes de Configuración. Abre la lista de espacios con el rol en cada uno; al elegir otro, la app va a la pantalla de inicio.
- Total de cuentas: el mismo de la pestaña Cuentas (las cuentas activas que el usuario ve con "incluir en el total", incluidas sus privadas), en la moneda principal. Si falta una tasa, lo avisa.
- Selector de periodo: flechas + chip con el nombre y el rango; al tocarlo abre las opciones de §4.5 (bottom sheet en compacta, diálogo en los demás tamaños).
  - En compacta el selector ocupa todo el centro, entre el total y Configuración.
  - El total tiene prioridad: aunque sea largo se ve completo, y el chip se achica (recorta primero el rango).

### Categorías (inicio)

- Pestañas Gastos / Ingresos.
- Burbujas de categoría alrededor del donut (`cc-category-grid`). Cada burbuja muestra:
  - nombre;
  - restante del presupuesto arriba;
  - gastado abajo;
  - relleno según el presupuesto consumido;
  - una marca si se pasó del presupuesto.
  - La línea del restante solo se reserva si alguna burbuja de la grilla tiene presupuesto; si no, el nombre va pegado al ícono.
- En el centro del donut: total de gastos y total de ingresos del periodo.
- El donut se segmenta por categoría, con el color de cada una.
- Tocar una categoría abre el registro rápido.
- Desde la F1b2 la grilla existe sin montos; los montos y el registro rápido llegan en la F1d.
- Montos (F1d):
  - Van en la moneda principal y cuentan lo compartido del espacio (§4.7).
  - Cada categoría suma sus subcategorías.
  - Con los presupuestos apagados no se muestra el restante.
  - En ingresos, el restante es lo que falta para el ingreso esperado.
- **Modo edición:** el lápiz del encabezado abre `/categorias/editar`. Es la misma grilla con una burbuja "+" para crear; tocar una categoría abre su pantalla, y las burbujas se reordenan arrastrándolas. Configuración → Categorías lleva al mismo lugar: un solo flujo con dos puntos de entrada.
- **Pantalla de categoría:** nombre grande en el encabezado, badge de ícono y color, etiquetas por defecto y la lista de subcategorías con "Añadir subcategoría".
  - Si la categoría es nueva, añadir una subcategoría la guarda primero.
- **Subcategoría:** se crea y edita en un sheet con nombre, etiquetas por defecto e ícono. El color se hereda de la categoría y se puede cambiar. En "Más opciones" se puede mover a otra categoría o volverla principal.

### Registro rápido (bottom sheet)

- Teclado numérico propio, con suma y resta.
- Cuenta: por defecto la predeterminada del miembro.
- Chips de subcategoría.
- Fecha: hoy por defecto, con atajo a ayer.
- Etiquetas: precargadas desde la categoría.
- Nota opcional.
- "Incluir en el espacio", solo si la cuenta es privada.
- Meta: guardar un gasto típico en 3 toques. En escritorio, todo usable con teclado.

Detalle (F1d):

- **Forma:** bottom sheet en compacta; diálogo de dos columnas en los demás tamaños (teclado a la izquierda, campos a la derecha). Es el mismo organismo (`cc-quick-entry-sheet`) para crear y editar gastos, ingresos, transferencias y ajustes.
- **Los 3 toques:** categoría → monto → ✓. Cuenta, fecha (hoy) y etiquetas ya vienen puestas.
- **Teclado:**
  - Edita una expresión con suma y resta, que se muestra formateada (`12.000 + 3.500`) con el resultado debajo. ✓ la evalúa y guarda.
  - Desde la F1e también multiplica y divide (`×`, `÷`; en el teclado físico `*` y `/`):
    - La precedencia es la normal.
    - El resultado se redondea a la unidad menor, alejándose de cero.
    - Dividir entre cero es un error claro ("No se puede dividir entre cero"), no un monto 0.
    - El mismo teclado sirve a la calculadora del presupuesto (§4.7).
  - ✓ queda deshabilitado mientras se guarda.
- **Campos** (desde la F1e2, ver abajo):
  - Subcategoría en chips de selección única, con ícono.
  - Cuenta y categoría en los bloques de arriba.
  - Fecha en una línea que abre Hoy, Ayer o Elegir día.
  - La nota, visible; las etiquetas, plegadas.
  - Con TC, "Cuotas" y, si son más de 1, la tasa mensual.
- **Etiquetas:** mientras el usuario no las toque, siguen a la categoría elegida (las de la categoría más las de la subcategoría).
- **En escritorio:**
  - El foco empieza en el monto. Dígitos, `+`, `-`, el separador decimal y Backspace editan la expresión desde cualquier parte del diálogo, salvo en los campos de texto.
  - Tab recorre los campos; Enter o Ctrl/⌘+S guardan; Esc vuelve de una vista o cierra (preguntando si hay cambios sin guardar).
- **Transferencia:** origen y destino, sin categoría ni etiquetas. Si cambia la moneda, se ven dos montos ("Sale" y "Llega") y se toca uno para escribirlo.
- **Ajuste:** "Sube" o "Baja" el saldo, monto, fecha y nota.
- **Después de guardar:** un aviso ("Gasto guardado"), que al crear trae "Deshacer".

Rediseño (F1e2), como en 1Money; aplica al crear y al editar, desde cualquier pantalla:

- **Bloques:** arriba van dos bloques, cada uno con su color y su ícono:
  - gastos: "De cuenta → A categoría";
  - ingresos: "De categoría → A cuenta";
  - transferencias: "De cuenta → A cuenta";
  - ajustes: un solo bloque con la cuenta.
- **Selector:** tocar un bloque abre el selector como vista dentro del mismo overlay, con ←: las cuentas por grupo con su saldo, o las categorías del mismo tipo. Al cambiar la categoría, la subcategoría vuelve a la categoría y, al crear, las etiquetas la siguen.
- **Subcategorías:** chips con ícono en una fila desplazable. La elegida va rellena con el color de la categoría.
- **Monto:** grande, en el color de la categoría, con contraste AA: si el color no llega a 4,5:1 sobre la superficie, se usa un tono más oscuro de la misma paleta.
- **Nota:** visible, sin abrir nada. Las etiquetas, las cuotas e "incluir en el espacio" siguen donde estaban.
- **Fecha:** una línea ("Hoy, 27 nov"). Tocarla abre una vista con Hoy, Ayer y Elegir día. Periodicidad y recordatorio llegan con los recurrentes (F3).
- **Al crear:** el teclado siempre visible.
- **Al editar:**
  - En el sheet, el teclado aparece al tocar el monto. En el diálogo y el panel hay espacio y se ve siempre.
  - Abajo van las acciones Borrar, Fecha y Duplicar.
  - Borrar confirma en una vista del mismo overlay; al confirmar, borra y cierra.
  - Duplicar abre un movimiento nuevo con los datos guardados del original y la fecha de hoy. Si hay cambios sin guardar, primero pregunta "¿Descartar los cambios?".
- **✕ y ✓ flotantes (§13.5):** la ✕ arriba a la derecha. El ✓ es la tecla del teclado mientras el teclado se ve; sin teclado, es el ✓ flotante. Nunca hay dos.
- **Descartar:** con cambios sin guardar, cerrar (✕, fondo, Esc o el atrás del sistema) muestra la vista "¿Descartar los cambios?" en vez de cerrar.
- **Diálogo y panel:** los bloques arriba, a todo el ancho; debajo, el monto y el teclado a la izquierda y lo demás a la derecha.

### Cuentas

Pestañas:

- **Cuentas:** cuentas y ahorros, agrupados.
- **Deudas:** debo, me deben y completadas, con círculo de progreso.
- **Mis finanzas:** patrimonio por moneda y consolidado. Llega en la F1e2 como pestaña de Cuentas, no como sección del Resumen. Así queda en el panel de lista y, en expandida, el detalle de cuenta sigue al lado (§13.5).
  - Activos (Cuentas, Ahorros y Me deben) contra Deudas, y el neto, por moneda y consolidado en la moneda principal con la tasa de hoy (RPC `net_worth`).
  - Entran las cuentas que el usuario ve, aunque no estén en "incluir en el total". Las archivadas no entran.
  - Si falta una tasa, lo avisa.
  - Los bienes con valor manual llegan en la F2. Hasta la pestaña Deudas (F2), las deudas siguen en la lista de Cuentas.

Desde la F1b la pestaña Cuentas lista los grupos Cuentas, Ahorros, Deudas y Me deben, cada uno con su total por moneda, más un total general por moneda de las cuentas con "incluir en el total". Las archivadas van en una sección plegada.

**Crear una cuenta:** el "+" abre "¿Qué vas a crear?" (Cuenta, Ahorro, Deuda o Me deben). Después viene un formulario corto:

- el nombre grande en el encabezado, con el badge de ícono y color al lado;
- filas para el tipo y la moneda (abren la lista de opciones) y el saldo, que se escribe en la misma fila (§13.5, "Menos modales"), e interruptores para "Incluir en el total" y la cuenta predeterminada;
- en "Más opciones": fecha del saldo, cuenta privada e "incluir en el espacio".

Lo mínimo para guardar es el nombre; el saldo arranca en 0 y lo demás viene precargado por tipo. Crear y editar usan la misma pantalla.

**Gestión:** crear y editar cuentas y categorías son pantallas con ruta propia. Las etiquetas y las subcategorías se crean y editan en un sheet.

- `/cuentas/nueva?grupo=…`, `/cuentas/:id` (detalle) y `/cuentas/:id/editar`;
- `/categorias/editar`, `/categorias/editar/nueva?clase=…` y `/categorias/editar/:id`;
- `/configuracion/etiquetas`.

Los organismos de estas pantallas y sheets son los que el asistente reutiliza tal cual.

**Detalle de cuenta (F1d):**

- Se abre al tocar una cuenta; en expandida, en el panel de detalle.
- Muestra el saldo y la lista de movimientos agrupada por día (los más recientes primero, de a 50), con el monto con signo según la cuenta.
- Tocar un movimiento lo abre en el registro rápido para editarlo o eliminarlo.
- Una transferencia desde o hacia una cuenta que el usuario no ve dice "Cuenta privada de X".
- Acciones:
  - Editar: la pantalla de la cuenta, que al cerrar vuelve al detalle y al eliminar vuelve a la lista.
  - Transferir: el registro rápido en modo transferencia, con esta cuenta como origen.
  - Ajustar al saldo real: se escribe el saldo que muestra el banco, como lo ve el usuario (las deudas en positivo), y se crea un ajuste por la diferencia.

### Transacciones

- Lista agrupada por día y búsqueda.
- Filtros: cuenta, categoría, etiqueta, tipo, persona y estado.
- Crear, editar y eliminar movimientos y transferencias.

Detalle (F1e):

- **Qué muestra:** los movimientos del periodo global que el usuario ve, incluidas sus cuentas privadas, igual que el detalle de cuenta. Van agrupados por día, los más recientes primero, de a 50 con "Ver más".
  - La fila lleva la categoría ("Categoría (Subcategoría)", desde la F1e2), la cuenta con su ícono, las etiquetas y la nota, en una línea aparte. Las transferencias dicen "Efectivo → Nequi" (o "Cuenta privada de X").
  - El monto va con el color del tipo: gastos e ingresos con su signo y su tono; transferencias y ajustes, neutros.
  - **Encabezado de cada día (F1e2):** el día y, a la derecha, su neto (ingresos − gastos) con signo y el color de su signo, con las reglas de los totales. No depende de cuánto de la lista se haya cargado.
  - Un candado pequeño marca los movimientos de cuentas privadas, porque explica por qué los totales pueden diferir de Categorías, que usa el alcance Espacio.
- **Búsqueda:**
  - Busca en la nota, la categoría (y su padre) y la cuenta de origen o destino, sin distinguir mayúsculas ni tildes.
  - Cada palabra tiene que aparecer en algún campo.
  - Si el texto completo es un monto válido en el formato del usuario, también encuentra los movimientos con ese monto exacto (o monto destino).
  - Los nombres de cuentas que el usuario no ve no se buscan.
- **Filtros:**
  - Son chips: tocar uno abre la lista de opciones, de selección múltiple. Los activos muestran lo elegido y una ✕, y con dos o más aparece "Limpiar".
  - Dentro de un filtro basta cualquiera de los valores; entre filtros se combinan.
  - Elegir una categoría incluye sus subcategorías, y el filtro de cuenta mira el origen o el destino.
  - "Persona" (quien registró) solo aparece si el espacio tiene más de un miembro.
  - Los filtros se recuerdan mientras la app está abierta, no en el dispositivo.
- **Totales:** ingresos, gastos y neto de lo filtrado, en la moneda principal, con la tasa de la fecha de cada movimiento. Las transferencias y los ajustes no suman. Si falta una tasa, el aviso de siempre.
  - Sin filtro de estado solo suma lo confirmado, la misma regla de `category_totals`. Lo pendiente se lista, pero no suma.
  - Con el filtro de estado suma exactamente los estados elegidos, pendientes incluidos.
  - Los movimientos de cuentas fuera del espacio (las privadas propias, sin incluir) también suman, para que el total siempre sume lo que muestra la lista. Son la única diferencia con Inicio y Presupuesto, y su fila lleva el candado.
  - Si alguno suma, debajo de los totales va una línea discreta con el candado: "Incluye {monto} de cuentas fuera del espacio". Si vienen de gastos y de ingresos a la vez: "Incluye {monto} en gastos y {monto} en ingresos de cuentas fuera del espacio".
- **Saldo inicial y saldo final (F1e2):** arriba de los totales, en dos casillas.
  - Cuentas: las del total del encabezado (incluidas en el total) o, si hay filtro de cuenta, esas cuentas.
  - El inicial es el saldo al cierre del día anterior al periodo; el final, al cierre del periodo, o de hoy si está en curso. En Siempre solo hay saldo final.
  - En la moneda principal, con la tasa de esa fecha.
  - Con búsqueda o con filtros de otro tipo (categoría, etiqueta, tipo, persona o estado) no se muestran, porque un saldo no aplica.
- **Editar:**
  - Tocar un movimiento lo abre en el registro rápido para editarlo o eliminarlo: en compacta como sheet, y en mediana como diálogo.
  - En expandida, lista y detalle van lado a lado (§13.5): el registro rápido se abre en línea en el panel de detalle. Si hay cambios sin guardar y se toca otro movimiento, se cierra el panel o se sale, pregunta "¿Descartar los cambios?".
- **Crear:** "+" (atajo `N`) abre "¿Qué vas a registrar?". Luego abre el registro rápido, en el panel en expandida.
  - Desde la F1e2 tiene tres pestañas, Ingreso, Gasto y Transferencia, y abre siempre en Gasto.
  - Gasto e Ingreso: la cuadrícula de categorías de ese tipo, con lo registrado en el periodo debajo de cada ícono, en su color (AA).
  - Transferencia: las cuentas por grupo (Cuentas, Ahorros, Deudas, Me deben), con el total del grupo y el saldo de cada una. Tocar una abre el registro rápido de transferencia desde esa cuenta.

### Presupuesto

Barras de gastado vs. presupuestado por categoría y total. Edición de montos. Desde la F1e: presupuesto por subcategoría, alcance de cada edición, detalle de categoría y calculadora (reglas en §4.7).

### Resumen

Reportes de §6 para el periodo seleccionado, como el Resumen de 1Money. De arriba abajo (F1e2):

1. **Balance** del periodo (ingresos − gastos) y, al lado, un anillo con la tasa de ahorro (balance / ingresos, en %). Sin ingresos, el anillo no aparece; con el balance negativo, va en tono de error.
2. **Gastos e Ingresos:** dos tarjetas que son a la vez el selector de la clase. La elegida va rellena con su color, y cada una lleva su nota de comparación (§6).
3. **Barras apiladas por día** (§6). Eje de montos a la derecha y eje de fechas con marcas por semana desde el inicio del periodo, más la fecha final. Tocar o pasar el mouse por una barra muestra el día, su total y el desglose.
4. **Promedios:** por día, por semana y por mes, en tres casillas (§6).
5. **"Por categoría":** filas con ícono, nombre, monto y barra con el %.
   - Primero las 3 categorías mayores, en el mismo orden y color del gráfico. Si hay más, una fila gris "Más…" despliega el resto. Las categorías sin movimientos no aparecen.
   - Tocar una categoría despliega sus subcategorías (y "General", lo registrado directo en ella). Tocar una subcategoría abre Transacciones filtrado por ella, en el periodo global.
6. **"Presupuesto":** solo con presupuestos activos (encendidos, en Mes o Año y con monto). Una fila de Gastos (gastado frente a presupuestado) y una de Ingresos (recibido frente a presupuestado), con el estilo de fila de Presupuesto y su pastilla. Tocarla abre Presupuesto. La fila de Ahorros llega con las metas de la F2.
7. **Pestañas Etiqueta, Cuenta y Persona,** con la clase elegida. Persona solo aparece con más de un miembro, y un aviso dice que con varias etiquetas el % no suma 100.

- En expandida van dos columnas: a la izquierda el balance, las tarjetas, el gráfico y los promedios; a la derecha la lista, el presupuesto y las pestañas. En compacta y mediana, una columna.
- El gráfico lleva `role="img"` con un resumen (periodo, total y categoría mayor). El tooltip no es la única forma de leer los datos: la lista los tiene todos.
- Si falta una tasa, el aviso de siempre.

### Autenticación

- Inicio de sesión, registro (oculto mientras el registro público esté cerrado) y recuperar contraseña.
- `/invitacion` (F1f): aceptar o rechazar una invitación, también sin sesión. Las reglas están en §3.3.

### Asistente de configuración inicial

Se abre al primer inicio de sesión sin espacio. Guía paso a paso la configuración del espacio y la situación financiera actual.

- Pasos (rutas bajo `/bienvenida`):
  1. **Espacio y preferencias** (`espacio`): nombre del espacio, moneda principal, formato de moneda, primer día del mes y de la semana. Con el espacio ya creado (retomar o revisar), el paso guarda cambios en vez de crear otro. Sin espacio y con invitaciones pendientes (F1f), arriba muestra cada una con "Aceptar invitación" y "Rechazar".
  2. **Situación financiera actual** (`cuentas`): cuentas, ahorros, deudas y "me deben", cada una con su saldo actual, agrupadas y con sus totales. "Agregar" abre "¿Qué vas a crear?" y la pantalla de cuenta; al guardar vuelve al paso. Al final, la cuenta predeterminada. Moneda por cuenta (p. ej. USD). Las deudas piden solo nombre, tipo y saldo; los datos de tasa, plazo y cuotas se completan en la F2.
  3. **Ingresos** (`ingresos`): categorías de ingreso (fuentes) en la grilla en modo edición y, opcional, el monto mensual esperado de cada una (§4.7), escrito en su fila.
  4. **Categorías de gasto** (`gastos`): la grilla en modo edición, con la pantalla de categoría.
  5. **Etiquetas** (`etiquetas`, opcional): crear etiquetas con su sheet, que también dice en qué categorías se pone sola cada una (§4.3). Sugiere `Fijos` mientras no exista.
  6. **Presupuesto** (`presupuesto`, opcional): monto mensual por categoría de gasto, con el total por moneda junto al ingreso esperado.
     - Cada monto se escribe en su fila, en la moneda principal; el símbolo de la moneda es un botón que abre la lista de monedas. Enter pasa a la fila siguiente, para llenar el presupuesto de corrido.
     - Cada fila guarda al confirmar (Enter o al salir del campo). Vacío no cambia nada y 0 quita el monto.
  7. **Resumen** (`resumen`): una fila por paso con lo configurado y un enlace para volver a él; "Terminar" marca el asistente como completo.
- Ingresos y gastos, sin categorías de esa clase, ofrecen empezar desde cero o partir de la plantilla sugerida (Anexo A). La plantilla es una lista para marcar, con todo marcado: desmarcar una categoría desmarca sus subcategorías y marcar una subcategoría marca su categoría. Lo marcado se crea en una sola transacción (`create_category_tree`) y el paso sigue en la grilla para ajustarlo.
- Comportamiento:
  - Reutiliza las pantallas y sheets de gestión tal cual (cuenta, categoría, subcategoría, etiqueta, ícono y color, monto). Las pantallas de cuenta y categoría vuelven a su ruta padre, así que bajo un paso vuelven al paso.
  - El progreso (`onboarding_step`, pasos completados en orden) se guarda al completar cada paso; revisar un paso anterior no lo hace retroceder. Se puede abrir cualquier paso hasta el pendiente; con el asistente completo, todos.
  - Mientras el asistente no esté completo y nunca se haya pospuesto, entrar a la app lo retoma en el paso pendiente (también si se cerró la app a mitad de camino).
  - "Terminar más tarde" lleva a la app y guarda `onboarding_postponed_at`: desde ahí la app no vuelve a abrirlo sola, en ningún dispositivo. Mientras no esté completo, la pantalla de inicio muestra la tarjeta "Completa tu configuración · Faltan N pasos · Continuar" y Configuración, "Completar configuración inicial".
  - Los pasos opcionales dicen "Saltar" mientras no tienen nada y "Continuar" cuando sí. En Presupuesto basta un monto distinto de 0 escrito en cualquier fila, aunque todavía no se haya guardado.
  - "Continuar", "Atrás" y "Terminar más tarde" esperan a que terminen los guardados pendientes de las filas del paso. Si alguno falla, no navegan y muestran el error.
  - Terminar el paso 7 guarda `onboarding_completed_at`. Configuración → "Revisar configuración inicial" lo vuelve a abrir en el resumen; terminar otra vez conserva la primera fecha.
  - Solo el propietario ve el asistente, la tarjeta y la fila de Configuración, porque la configuración del espacio es suya.
  - Layout (§13.5): en compacta y mediana, un paso por pantalla con el progreso arriba ("Paso 3 de 7" y una barra por pasos) y las acciones abajo; en expandida, los pasos en una columna lateral y el paso al lado. Los flujos que se abren desde un paso ocupan la pantalla completa en compacta y mediana, y el panel del paso en expandida.

### Configuración

- **Usuario:** perfil, tema claro/oscuro, pantalla de inicio, formato de moneda.
- **Espacio:**
  - nombre;
  - miembros e invitaciones;
  - moneda principal;
  - primer día del mes y de la semana;
  - periodo por defecto;
  - presupuesto on/off;
  - categorías, etiquetas y cuentas;
  - monedas (`/configuracion/monedas`, F1d): una sección por moneda en uso distinta de la principal, con la tasa vigente, su historial y "Nueva tasa";
  - configuración inicial: completar el asistente o revisarlo (solo el propietario).

Detalle (F1e):

- **Orden:**
  - Primero el usuario: "Tu perfil" y "Preferencias".
  - Luego el espacio: "Espacio", la configuración inicial y los catálogos (con monedas).
  - Al final, "Sesión".
- **Perfil:** el nombre visible (`profiles.display_name`), que es el que ven los demás miembros. El avatar llega cuando haya almacenamiento de archivos.
- **Pantalla de inicio:** Cuentas, Categorías, Transacciones, Presupuesto o Resumen. Abrir la app en `/` lleva a ella.
- **Periodo por defecto:** Día, Semana, Mes, Año o Siempre. Solo se usa en los dispositivos que no recuerdan otro (§4.5).
- **Presupuesto on/off:** el interruptor "Mostrar presupuestos", que se guarda con el resto del espacio. Solo el propietario.
- **Miembros e invitaciones (F1f):** una fila en la sección "Miembros", con cuántos miembros e invitaciones pendientes hay, abre `/configuracion/miembros`.
  - **Lista:** nombre, correo y rol de cada miembro, con "(tú)" en el propio.
  - **El propietario:**
    - Toca a un miembro para elegir su rol. Hacer a alguien propietario pide confirmación.
    - "Quitar" pide confirmación y explica qué pasa con sus datos (§3.2).
    - Ve las invitaciones pendientes (correo, rol y "Vence el …", o "Venció: reenvíala"), con Reenviar y Revocar.
    - Invita con "+" (atajo `N`).
  - **Invitar** es un sheet con confirmación: correo y rol, con lo que permite cada rol, como las etiquetas y las subcategorías.
    - A una cuenta nueva le llega el correo y el sheet se cierra.
    - Con una cuenta existente, el sheet muestra el link con "Copiar link" y "Compartir".
    - Reenviar a una cuenta existente abre la misma vista.
  - **Salir:** cualquiera tiene "Salir de {espacio}", con confirmación. Al último propietario el botón le aparece deshabilitado, con la explicación. Después de salir, la app va a otro espacio o al asistente.
  - **Los demás roles** ven la lista y la salida, sin invitar ni cambiar roles.

### Nueva versión (F1e)

- Cuando el service worker tiene lista una versión nueva, un aviso "Nueva versión disponible" con "Recargar". El aviso no se cierra solo.
- La app busca versiones nuevas al volver a primer plano y cada cierto tiempo.
- Si el service worker queda en un estado irrecuperable, la app lo avisa y recarga.

---

## 8. Modelo de datos (borrador)

Todas las tablas de negocio llevan `space_id`. Montos en `bigint` (unidades menores) + código de moneda ISO.

```
profiles (user_id, display_name, avatar_url, created_at)
spaces (id, name, icon, color, created_by, created_at)
space_members (space_id, user_id, role, default_account_id, joined_at)
  role: owner | editor | viewer
space_invitations (id, space_id, email, role, token_hash, invited_by, created_at, expires_at,
                   accepted_at, accepted_by, declined_at, revoked_at)
  -- F1f: email en minúsculas; token_hash = sha256 del token (único); una sola respuesta
  -- (aceptada, rechazada o revocada); una abierta por (space_id, email)
space_settings (space_id, main_currency, month_start_day, week_start, budgets_enabled, default_period,
                onboarding_step, onboarding_completed_at, onboarding_postponed_at)
  -- onboarding_step: pasos del asistente completados en orden (create_space deja 1)
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

installment_plans (id, space_id, account_id, kind, source_transaction_id, installments, rate, start_date, created_at)
  kind: loan_schedule | debt_plan | card_deferral
  -- F1d: solo card_deferral. source_transaction_id = la compra (única, se borra con ella);
  -- rate mensual como fracción (0 = sin interés, < 1)
installments (id, plan_id, number, due_date, principal, interest, fees, status, operation_id)

categories (id, space_id, parent_id, kind, name, icon, color, sort_order, archived_at, created_at)
  kind: expense | income   -- color null solo en subcategorías (hereda el del padre)
tags (id, space_id, name, color, archived_at, created_at)
category_default_tags (space_id, category_id, tag_id)
  -- space_id redundante a propósito: con FKs compuestas (space_id, id) no se mezclan espacios

transactions (id, space_id, type, date, amount, currency, account_id, to_account_id, to_amount,
              category_id, adjustment_direction, note, include_in_space, operation_id,
              financing_plan_id, source, status, external_id, created_by, created_at, updated_at)
  type: expense | income | transfer | adjustment
  adjustment_direction: increase | decrease   -- solo en ajustes; amount siempre > 0
  source: manual | recurring | email | shortcut | import · status: confirmed | pending
  -- id lo genera el cliente (guardado idempotente); currency la copia un trigger desde la cuenta
  -- FKs compuestas (space_id, …) a cuentas y categorías, on delete restrict
  -- financing_plan_id: compras financiadas con un préstamo (F2)
transaction_tags (space_id, transaction_id, tag_id)
  -- space_id redundante a propósito, como en category_default_tags

budgets (id, space_id, category_id, amount, currency, effective_from, created_at)
  -- category_id puede ser de gasto (presupuesto) o de ingreso (ingreso mensual esperado)
  -- amount >= 0 (0 = sin monto desde ese periodo); effective_from = día 1 del mes que nombra el periodo
  -- única por (category_id, effective_from); FK compuesta (space_id, category_id), on delete cascade
exchange_rates (id, space_id, date, base, quote, rate, source, created_at)
  -- 1 base = rate quote; source manual (del espacio) | trm (space_id null, F2)
  -- una por (espacio, par sin importar el sentido, fecha)
recurring_templates (fase 3)
```

### Reglas de acceso (RLS)

| Tabla | Lectura | Escritura |
|---|---|---|
| `spaces`, `space_settings`, `categories`, `tags`, `budgets` | Miembros del espacio | Propietario o editor (configuración y miembros: solo propietario) |
| `accounts` | Compartidas: miembros. Privadas: solo el dueño | Compartidas: propietario o editor. Privadas: solo el dueño, y además debe ser propietario o editor |
| `category_default_tags` | Miembros del espacio | Propietario o editor |
| `transactions` | Visible si la cuenta o la cuenta destino es visible para el usuario, o si `include_in_space = true` | Quien puede escribir en la cuenta de origen; la cuenta destino tiene que verla |
| `transaction_tags` | Si se ve el movimiento | Si se puede escribir el movimiento |
| `installment_plans` | Si se ve la cuenta o la compra | Quien puede escribir en la cuenta |
| `exchange_rates` | Miembros del espacio (y las comunes, F2) | Propietario o editor; no se editan, se reemplazan |
| `space_members` | Miembros del espacio | Rol: el propietario, a los demás. Borrar: cada quien la suya (salir) o el propietario (quitar). Insertar: solo `create_space` y `accept_invitation` |
| `space_invitations` | El propietario, sin `token_hash` (grant por columnas) | Solo por RPC |

- Funciones auxiliares: `is_space_member(space_id)`, `space_role(space_id)`, `is_space_editor(space_id)`, `can_see_account(account_id)`.
- Un editor no puede volver privada la cuenta compartida de otro miembro: la política de escritura se evalúa también sobre la fila nueva.
- Las FKs compuestas `(space_id, …)` garantizan que la cuenta predeterminada, la categoría padre y las etiquetas por defecto sean del mismo espacio.
- RPCs de la F1b:
  - `set_default_account(space_id, account_id)` acepta solo cuentas activas del espacio y visibles para quien llama. Con cualquier otra cuenta responde el mismo error, para no filtrar si existe.
  - `reorder_categories(ids)` reordena hermanos y respeta la RLS.
- RPC de la F1c: `create_category_tree(space_id, kind, tree)` crea categorías con sus subcategorías en una sola transacción (todo o nada), con `SECURITY INVOKER`: aplican la RLS y los triggers de categorías.
- RPCs de la F1d, todos con `SECURITY INVOKER`:
  - `save_transaction(...)` crea o actualiza (según exista el id) un movimiento con sus etiquetas y su diferido, todo o nada.
  - `category_totals(space_id, from, to, budget_months)` devuelve por categoría el monto en la moneda principal (cada categoría suma sus subcategorías), el presupuesto, el restante y las monedas sin tasa. Usa el alcance Espacio.
    - Desde la F1e (mismas columnas), las subcategorías también traen su presupuesto y su restante.
    - El presupuesto de la categoría es su monto propio (el "General") más la suma de los de sus subcategorías (§4.7).
  - `accounts_total(space_id, on_date)` es el total del encabezado.
  - `save_exchange_rate(...)` reemplaza la tasa del mismo par y día.
- RPCs de la F1e (Transacciones), con `SECURITY INVOKER`:
  - `search_transactions(space_id, from, to, search_terms, search_amount, filter_*)` devuelve las filas de `transactions` que quien llama ve, con la búsqueda y los filtros de §7. Así PostgREST embebe etiquetas, autor y diferido, y ordena y pagina.
  - `transaction_totals(...)` toma los mismos argumentos y da ingresos, gastos y neto en la moneda principal, más las monedas sin tasa.
    - Sin `filter_statuses` solo suma lo confirmado, como `category_totals`.
    - Suma también los movimientos de cuentas fuera del espacio: los de las cuentas privadas de quien llama sin "incluir en el espacio". Así el total es el de la lista.
    - `outside_space_income` y `outside_space_expense` dicen cuánto de cada total viene de esas cuentas, en la moneda principal y con las mismas tasas. Restados, los totales son los de `category_totals` (Inicio y Presupuesto).
  - La búsqueda sin tildes usa la extensión `unaccent` a través de `private.search_text`.
- RPCs de la F1e2 (Resumen, Mis finanzas y Transacciones), con `SECURITY INVOKER`:
  - `daily_category_totals(space_id, from, to)`: por día y categoría principal (suma sus subcategorías), alcance Espacio, en la moneda principal.
  - `breakdown_totals(space_id, from, to, dimension)`: por etiqueta, cuenta o persona que registró, alcance Espacio. Un movimiento con varias etiquetas cuenta en cada una; sin etiqueta, o de una cuenta privada de otro, va con key null.
  - `net_worth(space_id, on_date)`: saldo por grupo y moneda de las cuentas activas que quien llama ve (sin bienes), convertido con la tasa de `on_date`.
  - `transaction_day_totals(...)`: los argumentos de `search_transactions`; ingresos, gastos y neto por día de lo filtrado, con las reglas de `transaction_totals`.
  - `accounts_balance(space_id, on_date, account_ids)`: el saldo al cierre de `on_date` de las cuentas del total del encabezado o de las elegidas, en la moneda principal con la tasa de esa fecha. Antes de la fecha del saldo inicial, descuenta lo que ese saldo ya traía.
  - **Conversión por movimiento:** `category_totals`, `transaction_totals` y las RPCs de la F1e2 convierten cada movimiento por separado (mismas columnas de antes). Así cualquier reparto suma lo mismo. Las piezas compartidas son `private.space_movements` (alcance Espacio) y `private.filtered_amounts` (lo que suma en Transacciones).
- RPCs de la F1f (`SECURITY DEFINER`, con `search_path = ''`; los errores de negocio son `P0001` con una clave estable en el mensaje, y los de permiso, `42501`):
  - **Del propietario:**
    - `create_invitation(space_id, email, role)` devuelve el token una sola vez, si el correo ya tiene cuenta confirmada y los nombres para el correo. Una invitación abierta pero vencida se revoca y se reemplaza.
    - `rotate_invitation(id)` reenvía: token nuevo y 7 días más.
    - `revoke_invitation(id)`.
  - **Para la página de la invitación:**
    - `invitation_preview(token)`: también para anon, y es la única excepción. Sin el token no devuelve nada.
    - `my_invitations()`: las abiertas y vigentes para el correo confirmado de quien llama.
  - **Para quien recibe la invitación:**
    - `accept_invitation(token | id)` y `decline_invitation(token | id)`: por token (el link) o por id (dentro de la app, donde la prueba es el correo confirmado).
    - Validan, en orden: sesión, que exista, revocada, usada, vencida, que el correo coincida (confirmado) y, al aceptar, que no sea ya miembro.
  - **Para los miembros:** `space_member_list(space_id)` da nombre, correo y rol. El correo de los miembros solo sale por aquí.
- Trigger de la F1f: `space_members_keep_owner` (después de borrar o de cambiar el rol) exige al menos un propietario y bloquea el espacio (`for update`). No aplica si el espacio se está borrando.
- Edge Function de la F1f: `invite-member` (§3.3).
  - Tiene `verify_jwt` apagado y verifica el JWT ella misma con `auth.getUser`.
  - Usa la service role solo para `auth.admin.inviteUserByEmail`; los datos van por RPC con el JWT de quien llama.
  - CORS solo para `ALLOWED_ORIGINS`.
  - Respuestas: `{ invitationId, email, expiresAt, delivery: 'email' | 'link', link? }`, o `{ error: { code } }`.
- Triggers de la F1d:
  - la moneda e "incluir en el espacio" del movimiento;
  - la clase de la categoría y el monto destino;
  - el bloqueo de tipo y moneda de cuentas con movimientos;
  - la coherencia del diferido con su compra;
  - borrar un espacio borra primero sus movimientos, para que las FKs restrict no frenen la cascada.
- `budgets`: los clientes insertan filas y solo cambian `amount` y `currency`; un cambio desde otro periodo es una fila nueva.
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
| F1b2 · Flujos móviles y diseño adaptativo | Layouts por clase de tamaño (navegación inferior o rail, lista y detalle lado a lado) y flujos cortos pensados primero para móvil (§13.5): crear cuenta por tipo, selector único de ícono y color, grilla de categorías con modo edición, pantalla de categoría, subcategorías y etiquetas en sheet. Reemplaza los formularios largos de la F1b. Sin cambios en la base de datos |
| F1c · Asistente | Asistente de configuración inicial completo (§7), reutilizando los flujos de la F1b2; plantilla sugerida (Anexo A) |
| F1d · Movimientos | Movimientos (gasto, ingreso, transferencia, ajuste), registro rápido con cuotas y tasa para TC, selector de periodos, pantalla de inicio Categorías, multimoneda con tasa manual |
| F1d2 · Pulido visual | Tema azul de marca y logo (favicon e íconos de la PWA), densidad por clase de tamaño, encabezados centrados, edición en la fila (§13.5, "Menos modales"), overlays con confirmación (✕ y ✓ flotantes), selector de ícono con Sugeridos y catálogo ampliado, paleta tono × intensidad con color de ícono automático. Sin cambios en la base de datos |
| F1e · Reportes | Presupuestos, Transacciones (lista, filtros, edición), Resumen y el resto de Configuración |
| F1f · Compartir | SMTP (Gmail) y plantillas, invitaciones con Edge Function, página `/invitacion` pensada para iOS, onboarding por invitación, Miembros (roles, quitar y salir, al menos un propietario en la base), selector de espacio |
| F2 · Deudas | Préstamos con amortización, deudas simples con plan, tarjetas con diferidos, pagos con desglose, prorrateo en presupuestos, reportes de intereses, flujo real, bienes en patrimonio, TRM automática, alcance Personal en reportes, metas de ahorro por cuenta |
| F3 · Automatización | Recurrentes, cuotas automáticas, correo, atajos, bandeja "Por confirmar" |
| F4 · Abrir a terceros | Registro público con captcha, límites de tasa, política de datos, exportar y borrar cuenta, plantilla genérica de categorías pulida |

**Pendientes sin fase:**

- Sugerir el presupuesto de cada categoría según el promedio de los últimos meses (el "Asistente" del presupuesto de 1Money).
- Presupuesto por etiqueta (§4.4).
- Metas de ahorro por cuenta (F2).

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
- [x] F1d: ajuste con dirección y monto positivo; saldos desde la fecha del saldo inicial; tasas manuales por espacio con su regla de fecha; guardado idempotente con "Deshacer"; periodo recordado por tipo; montos formateados mientras se escribe. Detalle en §4.1, §4.2, §4.5, §4.6, §5.1 c, §7 y §8.
- [x] Datos reales desde la F1d: respaldo de producción (`npm run db:backup`) antes de cada `db push`, y prueba de migraciones con esos datos en local (`npm run db:restore-local`). Las reglas viven en `CLAUDE.md`.
- [x] F1d2: tema azul generado desde las semillas de marca; menos modales (un solo texto o monto se edita en la fila); paleta de 16 tonos × 5 intensidades con el color del ícono elegido por contraste; las claves de color anteriores se mapean a su equivalente sin tocar lo guardado. Detalle en §7, §13.2, §13.3 y §13.5.
- [x] F1e (Transacciones, Presupuesto y Configuración):
  - **Transacciones:** muestra todo lo que el usuario ve, con un candado en lo privado, y sus totales suman lo listado. Los filtros son de selección múltiple y combinables. En expandida, el registro rápido se edita en línea en el panel de detalle.
  - **Presupuesto:**
    - Va por subcategoría: el monto propio de la categoría es su "General" y el total suma todo, con `category_totals` actualizada.
    - Cada edición tiene un alcance: "Solo {mes}" (por defecto) o "{mes} y los siguientes".
    - La lista es por categoría, con detalle (sheet o panel), calculadora con × y ÷, y filas con la barra de fondo y una pastilla.
    - El Año es de solo lectura.
  - **Configuración y app:** Configuración suma perfil, pantalla de inicio, periodo por defecto y el interruptor de presupuestos, y hay un aviso de nueva versión.
  - Detalle en §4.7, §7 y §8. Plan en `docs/plans/f1e.md`.
- [x] F1e2 (Resumen, Mis finanzas, registro rápido y Transacciones):
  - **Resumen** como el de 1Money: balance con tasa de ahorro, tarjetas de Gastos e Ingresos que son el selector, barras con las 3 categorías mayores y el resto en gris, promedios y lista por categoría sin donut, con "Más…" y subcategorías desplegables.
  - **Comparación:** un periodo en curso se compara contra el anterior hasta el mismo punto; uno terminado, contra el anterior completo. La nota dice el rango.
  - **Cifras coherentes:** cada movimiento se convierte por separado, así los totales por día, categoría, cuenta y persona suman lo mismo; `category_totals` y `transaction_totals` cambiaron a esa regla sin cambiar columnas.
  - **"Mis finanzas"** es una pestaña de Cuentas.
  - **Registro rápido** con bloques de origen y destino, selectores como vistas dentro del mismo overlay, nota visible, fecha en una línea, Borrar y Duplicar al editar, y la pregunta antes de descartar. "¿Qué vas a registrar?" va en pestañas.
  - **Transacciones** con el neto de cada día y los saldos inicial y final del periodo.
  - **Sheets:** en compacta salen con el alto de su contenido.
  - Detalle en §6, §7, §8 y §13.5. Plan en `docs/plans/f1e.md` (Parte 2).
- [x] F1f (Compartir):
  - **Invitaciones:** token propio guardado como hash, de 7 días, un solo uso y ligado al correo.
    - La Edge Function crea la invitación y Auth envía el correo (`inviteUserByEmail`). A una cuenta existente no se le envía: ve la invitación al entrar y el propietario comparte el link.
    - Reenviar rota el token. A una cuenta invitada sin confirmar, Auth le reenvía sin problema (comprobado en el e2e local).
  - **iOS:** `/invitacion` abre en Safari y no depende de la sesión después. La cuenta nueva verifica el link de Auth al enviar el formulario, y al final la página enseña a instalar la app y a entrar con la contraseña.
  - **Miembros:** el propietario cambia roles ajenos y quita miembros, y cualquiera sale. La base garantiza al menos un propietario.
  - **Quien sale:** no se borra nada. Lo compartido queda, sus cuentas privadas quedan ocultas y vuelven si regresa.
  - **Encabezado:** selector de espacio con más de uno.
  - Detalle en §3, §7 y §8. Plan en `docs/plans/f1f.md`; configuración de producción en `docs/runbooks/f1f-compartir.md`.
- [x] F1c: el asistente se retoma al entrar hasta que el propietario lo pospone ("Terminar más tarde", guardado en el espacio para todos sus dispositivos); presupuestos e ingresos esperados con moneda por fila y vigencia por mes del periodo; plantilla para gasto e ingreso con lista para marcar. Detalle en §4.3, §4.7, §7, §8 y §13.5.

---

## 13. Sistema de diseño y personalización

Meta: un diseño visual excelente y muy personalizable, con estilos centralizados para que un cambio se haga en un solo lugar.

### 13.1 Atomic design

| Nivel | Qué es | Ejemplos | Carpeta |
|---|---|---|---|
| Tokens | Variables de diseño | Colores, tipografía, espaciado, radios, sombras, movimiento | `src/styles` |
| Átomos | Piezas mínimas, sin lógica de negocio | `cc-button`, `cc-fab`, `cc-icon`, `cc-icon-badge`, `cc-text-field`, `cc-money-field`, `cc-select`, `cc-amount`, `cc-color-swatch`, `cc-tabs`, `cc-donut`, `cc-progress-bar`, `cc-progress-ring`, `cc-bar-chart` | `shared/ui/atoms` |
| Moléculas | Combinaciones de átomos | `cc-appearance-picker`, `cc-field-row`, `cc-money-row`, `cc-option-panel`, `cc-confirm-panel` (y `cc-confirm-dialog`, su overlay), `cc-category-bubble`, `cc-account-row`, `cc-form-actions`, `cc-period-chip`, `cc-filter-chips`, `cc-stat-group`, `cc-budget-pill`, `cc-budget-row`, `cc-total-toggle`, `cc-entry-endpoints`, `cc-date-choice`, `cc-invitation-card`, `cc-install-steps` | `shared/ui/molecules` |
| Organismos | Secciones completas que reciben datos por inputs | `cc-category-grid`, `cc-account-editor`, `cc-quick-entry` (en línea) y `cc-quick-entry-sheet` (su overlay), `cc-entry-chooser` (y su overlay), `cc-account-list`, `cc-budget-list`, `cc-budget-detail` (y su sheet), `cc-amount-calculator` (y su overlay), `cc-transaction-list`, `cc-breakdown-list`, `cc-net-worth`, `cc-missing-rates-notice`, `cc-nav-rail`, `cc-member-list`, `cc-invitation-list`, `cc-invite-sheet` | `shared/ui/organisms` |
| Plantillas | Layouts sin datos | Layout de auth, shell de la app, layout del asistente, flujo, lista-detalle | `shared/ui/templates` |
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
- Colores de marca (F1d2): primario azul oscuro `#1E4E8C` y acento azul claro `#3FB6E8`.
  - Son las semillas de las paletas Material 3 (primaria y terciaria), generadas con HCT por el schematic `@angular/material:theme-color` en `_theme-colors.scss`. No se ajustan a ojo: si cambia una semilla, se regenera.
  - Los pares de texto del tema (on-surface, primary, on-*-container…) cumplen contraste AA en claro y oscuro; un e2e lo verifica con los colores computados.
- Nada de colores, tamaños, radios ni sombras sueltos en los componentes: todo sale de tokens.
- Modo claro, oscuro o según el sistema, como preferencia de cada usuario.
- Más adelante: que cada usuario elija el color principal de la app (paleta Material 3 generada en tiempo de ejecución).

**Marca (F1d2)**

- Dos versiones del logo en `public/brand/`:
  - con esquinas redondeadas: favicon (`.ico` y `.svg`) y logo del login y del asistente (`cc-brand`). El favicon `.svg` y el de 16 px del `.ico` dibujan las C 1,4 veces más gruesas (misma geometría) para que se lean a 16 px; el logo de la interfaz conserva el trazo original;
  - a sangre completa: íconos de la PWA (192, 512 y maskable) y `apple-touch-icon`. Android e iOS recortan las esquinas, y el símbolo ya está dentro de la zona segura del maskable.
- Los PNG y el `.ico` salen de los SVG con `npm run brand:build` (reproducible) y se commitean.
- `theme_color` y `background_color` del manifest en `#1E4E8C`: la pantalla de carga de la app instalada sale con el color de la marca.

### 13.3 Íconos y colores personalizables

Llevan ícono y color: categorías, subcategorías, cuentas y espacios. Las etiquetas llevan color.

**Íconos**

- Material Symbols Rounded, self-hosted para que funcionen sin conexión.
  - La fuente se precarga (`preload` con `crossorigin`) y usa `font-display: block`, para no mostrar cuadros vacíos mientras carga.
- Catálogo curado de unos 900 íconos (desde la F1d2), agrupados (Hogar, Comida, Transporte, Salud, Familia y niños, Mascotas, Educación, Ocio, Compras, Tecnología, Finanzas, Viajes, Trabajo, Otros), con palabras clave en español para buscar. Cada grupo tiene su propio ícono para el menú de grupos.
- Los íconos del catálogo no se quitan ni se renombran: la clave guardada es el nombre del ícono.
- Si la fuente completa pesa mucho, se genera un subset con los íconos del catálogo y los de la interfaz.
- **Implementación (F1b, ampliada en la F1d2):**
  - `npm run icons:build` genera el subset de forma reproducible:
    - descarga la fuente variable y sus codepoints de `google/material-design-icons`, con commit fijo y SHA-256 verificado;
    - fija peso 400, grado 0 y tamaño óptico 24, y conserva el eje de relleno (FILL) para los badges.
  - El woff2 y el mapa `icon-codepoints.generated.ts` se commitean: el build no corre el script ni necesita red.
  - Los íconos se dibujan por codepoint, no por ligadura. El nombre del ícono es un tipo (`IconName`), así que el compilador avisa si se usa uno que no está en el subset.

**Colores**

- Paleta en grilla de 16 tonos × 5 intensidades (desde la F1d2), cada color con variante para tema claro y oscuro.
  - Tonos: rojo, naranja, ámbar, amarillo, lima, verde, verde azulado, cian, celeste, azul, índigo, violeta, morado, rosado, café y gris.
  - Intensidades: pálido, claro, base, intenso y oscuro.
  - Claves: el tono solo para la intensidad base (`blue`) y `tono-intensidad` para las demás (`blue-pale`, `blue-light`, `blue-deep`, `blue-dark`). Solo letras y guiones, como exige el dominio `color_key`.
- Se guarda la clave del color (p. ej. `teal`), no el hex: si cambia la paleta o el tema, todo se actualiza solo.
- Las subcategorías heredan por defecto el color de su categoría y pueden cambiarlo.
- El ícono sobre un color se elige solo: blanco si alcanza 3:1 sobre ese color; si no, oscuro. Así entran colores claros sin perder legibilidad (WCAG 1.4.11, gráfico no textual). Una prueba unitaria lo verifica para cada color, en claro y en oscuro.
- **Claves anteriores:** las 30 claves de la paleta de la F1b siguen funcionando. Las que siguen siendo un tono (`red`, `blue`, `teal`…) no cambian. Las demás (`navy`, `crimson`, `graphite`…) son alias de su color más cercano en la grilla. Lo guardado no se reescribe: cambia solo si el usuario elige otro color.
- La paleta vive en un archivo TypeScript y cada color se aplica como `light-dark(claro, oscuro)` en una variable CSS, así que cambia sola con el tema.

**Selector**

- Un solo selector de ícono y color (`cc-appearance-picker`) con vista previa en vivo y pestañas Ícono | Color. Las pestañas no llevan bordes, solo el indicador inferior.
  - Ícono: búsqueda y una grilla continua que empieza con **Sugeridos** y sigue con los grupos del catálogo.
    - Sugeridos, en orden y sin repetir: los íconos cuyas palabras clave coinciden con el nombre escrito; los usados recientemente en el espacio (íconos de las cuentas y categorías más nuevas); y los del contexto (cuenta → Finanzas; categoría de ingreso → Trabajo y Finanzas).
    - Sin scroll horizontal. En un contenedor angosto (móvil), arriba de la grilla queda fijo un botón con el grupo visible ("Hogar ▾", 44 px de alto) que abre el menú de grupos para saltar a cada sección. En uno ancho (escritorio), un menú lateral de grupos marca la sección visible.
  - Color: grilla de tono × intensidad (en angosto, una fila por tono; en ancho, una columna por tono); en subcategorías, la primera opción es "Igual que la categoría".
- Se abre tocando el badge grande del encabezado de cada flujo. El ✓ ("Listo") aplica los dos valores; la ✕ los descarta (overlay con confirmación, §13.5).
- En móvil se abre como bottom sheet; en pantallas medianas y grandes, como diálogo.
- Dentro de un sheet (p. ej. el de subcategoría) va en línea (`cc-appearance-editor`), porque un sheet no abre otro. En línea, la grilla de íconos o de colores tiene su propio alto con scroll, para que lo que sigue en el sheet (Más opciones, las categorías de una etiqueta) quede a mano.

**Fuente única:** el catálogo de íconos y la paleta viven cada uno en un solo archivo, y de ahí salen tanto los pickers como los estilos.

### 13.4 Calidad visual

- Cada cambio de UI se verifica con screenshots de Playwright en móvil y escritorio, en claro y oscuro.
- Microinteracciones sutiles (ripple, transiciones cortas), respetando `prefers-reduced-motion`.
- Accesibilidad: contraste AA en textos, áreas táctiles de al menos 44 px y label en todos los campos.

### 13.5 Patrones de interacción y layouts adaptativos

Meta: flujos cortos, pensados primero para móvil, con layouts que se adaptan al dispositivo en vez de solo estirarse. El asistente (F1c) reutiliza estos flujos.

**Clases de tamaño** (window size classes de Material 3)

| Clase | Ancho | Navegación | Lista y detalle | Selecciones |
|---|---|---|---|---|
| Compacta | < 600 px | Barra inferior | Un panel a la vez; los flujos ocupan la pantalla completa | Bottom sheet |
| Mediana | 600–839 px | Rail (ícono sobre la etiqueta) | Un panel a la vez, junto al rail | Diálogo |
| Expandida | ≥ 840 px | Rail expandido (ícono y etiqueta en fila) | Lado a lado: lista a la izquierda, detalle a la derecha | Diálogo |

- `LayoutService` expone la clase como signal. Las plantillas cambian según la clase; los organismos son los mismos en todas.
- Los cortes viven en `_breakpoints.scss` y en `WINDOW_BREAKPOINTS`, y deben coincidir.
- **Densidad (F1d2):** en compacta, los encabezados de página, las secciones, las listas y las burbujas usan márgenes y paddings más chicos. Son tokens semánticos (`--cc-page-padding`, `--cc-section-padding`, `--cc-list-item-padding`…) con el valor compacto por defecto y otro desde la clase mediana; los componentes solo leen el token. Las áreas táctiles siguen siendo de al menos 44 px.

**Encabezados**

- Título de página centrado; el botón atrás a la izquierda cuando aplica y las acciones a la derecha (p. ej. el lápiz de Categorías).
- La barra de los flujos sigue el mismo orden: cerrar o atrás, título centrado y Guardar.

**Flujos** (crear o editar algo)

- Barra superior con cerrar, título y Guardar. Al crear, cerrar es "✕" (descarta); al editar algo que ya existe, "←".
- Encabezado con el nombre grande y, al lado, el badge de ícono y color que abre el selector (§13.3). El foco automático en el nombre va solo al crear.
- Debajo, filas tipo lista. Las de opciones abren un sheet con la lista; los interruptores y los campos de un solo dato cambian en la misma fila (ver "Menos modales").
- Lo poco usado va plegado en "Más opciones".
- Si hay cambios sin guardar, salir (cerrar, volver, Esc o el atrás del sistema) pide confirmación: "¿Descartar los cambios?".
- En compacta el flujo ocupa la pantalla completa (sin encabezado ni navegación); en expandida va en el panel de detalle.

**Menos modales (F1d2)**

- Una fila con un solo campo de texto o monto se edita en la misma fila: al tocarla, el campo se enfoca con el teclado adecuado (p. ej. el numérico para un monto). Ej.: Saldo en la cuenta, monto del presupuesto y del ingreso esperado.
- En una lista de filas con monto, Enter pasa a la fila siguiente, para llenarlas de corrido.
- Una fila que guarda al confirmar (Enter o salir del campo) deja su guardado pendiente; los botones que salen de la pantalla (Continuar, Atrás, Terminar más tarde) lo esperan. Si alguno falla, no navegan y muestran el error.
- Los sheets quedan para listas de opciones, varios campos o el teclado del registro rápido.

**Sheets y diálogos**

- **Alto (F1e2):** en compacta, los overlays salen desde abajo con el alto de su contenido y la pantalla de fondo visible. Solo pasan a pantalla completa (su alto máximo, con scroll interno) cuando el contenido es largo.
- Un sheet a la vez: un sheet nunca abre otro. Si necesita confirmar algo (archivar, eliminar), se cierra devolviendo la intención y la pantalla pregunta.
- **Vistas dentro de un overlay (F1e):** cuando el paso siguiente es parte del mismo contexto (la calculadora o la confirmación dentro del detalle de Presupuesto), se muestra como una vista del mismo sheet, no como otro.
  - La vista lleva ← ("Volver") en lugar de ✕. Esc y el atrás del sistema vuelven a la vista anterior sin cerrar el sheet.
  - Al volver, la vista anterior conserva su scroll y el foco vuelve al control que abrió la vista.
  - Desde la F1e2, el registro rápido también usa vistas: los selectores de cuenta y categoría, la fecha, la confirmación de borrar y la de descartar. Las mismas vistas funcionan en el panel de Transacciones (expandida), sin entrada de historial.
- **Descartar en un overlay (F1e2):** un overlay con cambios sin guardar (hoy, el registro rápido) no se cierra con la ✕, el fondo, Esc ni el atrás: muestra la vista "¿Descartar los cambios?".
- El atrás del sistema (Android o el navegador) cierra solo el overlay abierto, sin navegar.
- **Overlays con confirmación (F1d2):** los sheets y diálogos que se confirman (ícono y color, subcategoría, etiqueta, opciones de selección múltiple, tasa de cambio y monto) siguen un mismo patrón, igual en sheet y en diálogo:
  - Sin barra superior ni título visible: el contenido sube hasta el borde superior (en el selector, la vista previa del ícono).
  - Una ✕ flotante en la esquina superior derecha descarta, como siempre.
  - La acción principal es un botón flotante circular con ✓ en la esquina inferior derecha, siempre visible. El contenido con scroll deja espacio abajo para que el ✓ no tape la última fila.
  - Mientras guarda, el ✓ muestra la carga y queda deshabilitado; un error se muestra dentro del overlay.
  - Accesibilidad: el overlay conserva su nombre accesible (el título de antes); la ✕ y el ✓ tienen nombre y tooltip ("Cerrar", "Listo"). Enter y Ctrl/⌘+S confirman (Enter conserva su efecto sobre botones, casillas y listas).
  - Desde la F1e2 el registro rápido sigue este patrón, con una diferencia: mientras su teclado se ve, el ✓ es la tecla del teclado, para que no haya dos.
  - Los overlays sin confirmación (una opción, "¿Qué vas a crear?", "¿Qué vas a registrar?", periodo, confirmaciones) y las pantallas de flujo mantienen su barra.

**Teclado y puntero** (mediana y expandida)

- Atajos:
  - `N`: nuevo;
  - `E`: editar categorías;
  - `Esc`: cerrar el flujo o el panel;
  - `Ctrl/⌘+S`: guardar;
  - `Alt` + flechas: reordenar.
- Los atajos de una tecla se pueden apagar en Preferencias (WCAG 2.1.4). La preferencia se guarda en el dispositivo y viene encendida.
- Estados de hover solo en dispositivos con puntero.

**Una sola versión de cada flujo:** si un flujo nuevo reemplaza a otro, el anterior se elimina.

**Asistente** (F1c)

- Los flujos de crear o editar salen a su ruta padre (navegación relativa), así que la misma pantalla sirve bajo su lista y bajo un paso del asistente, y vuelve a donde se abrió.
- Compacta y mediana: un paso por pantalla con el progreso arriba y las acciones fijas abajo (en mediana, en una tarjeta centrada). Expandida: los pasos en una columna lateral y el paso en el panel de al lado.
- Un flujo abierto desde un paso ocupa la pantalla completa en compacta y mediana; en expandida, el panel del paso, con la columna de pasos visible.

---

## Anexo A — Plantilla sugerida de categorías

Opcional en el asistente, para gastos e ingresos: se marca qué incluir, se puede editar todo después o empezar desde cero. Los íconos y colores de cada categoría viven en `core/config/category-template.ts`.

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

**Etiquetas sugeridas:** Fijos (el asistente la ofrece mientras no exista).
