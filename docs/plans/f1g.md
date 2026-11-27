# F1g · Sensación nativa — plan

> Se guarda en `docs/plans/f1g.md` como primer commit de `feat/f1g-native-feel`, creada desde `main` actualizado. Antes de empezar: `CLAUDE.md` y `docs/finanzas-spec.md` completos. Sin migraciones y nada en producción.
>
> **Aprobado** con estas decisiones:
>
> 1. Cuentas lleva sus pestañas en la segunda fila, sin selector de periodo.
> 2. B5 aprobado. Se registra en §7.
> 3. La tabla de títulos queda como está, salvo que **se queda** la ayuda de la tasa ("Aplica a los movimientos de esa fecha en adelante").
> 4. Si el scroller del shell, el `theme-color` dinámico o el arrastre del asa no se comportan como se espera, se aplica un plan B, se registra en la spec y se menciona en el resumen final.

## Contexto

Cuentas Claras todavía se siente como una página web:

- **Encabezado:** el título grande de cada pestaña se desplaza bajo el encabezado y el ⚙ ocupa un espacio fijo.
- **Barras del sistema:** salen azules (`theme-color` fijo `#1e4e8c`) sobre un encabezado gris.
- **Scroll:** la página entera se desplaza, rebota y tiene pull-to-refresh.
- **Registro rápido:** necesita scroll y no se parece a 1Money.

Objetivo: lo de la referencia (`reference/encabezado`, `reference/categorias`) en Android y en el iPhone, sin perder AA.

Lo que ya existe y se reutiliza:

- **Overlays:** `OverlayService` (sheet o diálogo, historial para el atrás, guarda de descarte), `OverlayViews` y `cc-overlay-panel`.
- **Dinero y fechas:** `cc-keypad` y `cc-amount-display` (también los usa la calculadora del presupuesto) y `entryDateText`.
- **Color:** `readableForeground`, `paletteForeground` y `paletteTextColor` (`shared/ui/colors/color-palette.ts`), `contrastRatio` (`domain/color/contrast.ts`).
- **Componentes:** `cc-chip-choice` (ya pinta borde, ícono y texto en el color de la categoría) y `cc-fab`.
- **PWA y datos:** `InstallService`, `AppUpdateService`, `ProfileService`, `AuthService`, `SpaceService`, `UserSettingsService.update`, `THEME_OPTIONS`, `cc-install-steps`, `cc-segmented-control` y `.cc-visually-hidden`.

Lo que no existe:

- acciones de página en el encabezado global (hoy cada página las pone en su `cc-page-header`, que se desplaza);
- una señal de tema resuelto y una de "hay un overlay abierto";
- arrastrar para cerrar;
- esqueletos;
- la versión de la app (`package.json` dice `0.0.0`);
- transiciones y memoria de scroll.

## Decisiones (van a la spec)

- **Bloques del registro rápido:** el texto sobre el color usa la misma idea de contraste automático, pero con 4,5:1, porque "De cuenta" y el nombre son texto normal.
  - Regla: blanco si llega a 4,5:1; si no, el oscuro de la paleta; si tampoco llega (algunos tonos medios), negro. Uno de los dos siempre pasa de 4,5:1.
  - Nuevo `paletteOnColorText(key)`.
  - `paletteForeground` (3:1) queda para íconos y para el ✓, que son gráficos.
- **Íconos flotantes como en la referencia:** cuadro o círculo de superficie, con sombra y con el ícono en el color.
  - La cuenta va al **inicio** del bloque izquierdo y la categoría al **final** del derecho. Así el centro queda libre para el asa.
- **Cerrar el registro rápido:** asa flotante centrada sobre el borde superior, botón "Cerrar" (excepción en §13.5).
  - En diálogo y panel, la ✕ ocupa ese mismo lugar: un círculo pequeño centrado sobre el borde.
  - Ninguno de los dos le quita ancho a los bloques.
- **Asa en los demás sheets:** todos los sheets de compacta llevan la misma asa flotante, decorativa (`aria-hidden`), para arrastrar. Conservan su ✕ o su barra.
- **Monto:** se usa el color tal cual si llega a 3:1 (texto grande), y si no, el tono más oscuro de su paleta que llegue (`paletteLargeTextColor`). La etiqueta "Gasto"/"Ingreso" sigue con `paletteTextColor` (4,5:1).
- **Acento del registro rápido:**
  - El acento es el color de la categoría. En transferencias y ajustes, el de la cuenta de origen.
  - Dentro del organismo se redefinen `--mat-sys-primary` y `--mat-sys-on-primary` con el tono AA del acento y su contraste. Así el interruptor, el select, el borde de la nota y los botones de texto dejan el azul de marca sin tocar cada uno.
  - El anillo de foco usa `--mat-sys-on-surface`.
- **Encabezado:**
  - En compacta, dos filas. En mediana y expandida, una fila (total, periodo, acción) y el avatar arriba del rail.
  - Las acciones de pantalla se registran con una directiva `ccHeaderAction` (`TemplateRef` en un servicio, que el shell pinta). Al destruirse la página, la acción se va.
- **Cuentas sin selector de periodo:** sus saldos no dependen del periodo, así que en Cuentas la segunda fila son sus pestañas (Cuentas · Mis finanzas), como en la referencia.
- **Subpantallas en compacta** (detalle de cuenta, Configuración, sus subpantallas y Miembros): solo su barra ← fija, sin encabezado global ni navegación inferior, como los flujos. El total y el periodo no aplican ahí, y así hay un solo encabezado. En mediana y expandida no cambian.
- **Menú lateral:**
  - Es el mismo drawer modal en todos los tamaños: en compacta lo abre el avatar del encabezado y en mediana y expandida, el del rail.
  - Se monta como un tamaño nuevo de `OverlayService` (`drawer`). Así hereda el fondo atenuado, Esc, la trampa de foco, el atrás de Android y la señal de "overlay abierto".
  - Lo que abre dentro (instalar, acerca de) son vistas del mismo overlay, con ←. El selector de espacio se despliega en el mismo menú. Ningún overlay abre otro.
- **Tema:**
  - Se cambia en el menú y se aplica al instante (optimista; si falla el guardado, vuelve y avisa).
  - Sale de Configuración → Preferencias, para que haya un solo lugar.
  - "Cerrar sesión" también pasa al menú y la sección "Sesión" sale de Configuración.
- **Versión:** sale de `package.json`. La F1g la sube a `0.10.0` (F1a = 0.1 … F1g = 0.10) y cada fase sube el minor.
- **Barras del sistema:**
  - `theme-color` dinámico con el token `--cc-bar-surface` (= `--mat-sys-surface-container`, el mismo del encabezado, la navegación y el rail). Sigue el tema de la app, no solo el del sistema.
  - Con un overlay o el menú abiertos, toma la mezcla de ese color con el fondo atenuado. El fondo atenuado pasa a tokens (`--cc-scrim`, `--cc-scrim-opacity`) para que la cuenta coincida.
- **iOS:**
  - No se usa `apple-mobile-web-app-status-bar-style`. WebKit (bug 317153, 2026) recomienda omitirlo: la barra toma el color de la página, y `black-translucent` está obsoleto.
  - Se mantiene `viewport-fit=cover`, con el encabezado ocupando `safe-area-inset-top`.
  - Se confirma en el iPhone.
- **Manifest:** `theme_color` = superficie del encabezado en claro y `background_color` = superficie de la página en claro.
  - Un e2e los compara con los tokens computados, porque el JSON no puede leerlos.
  - Limitación: el manifest no tiene variante oscura estable, así que en oscuro el splash sale claro. Queda anotado.
- **Scroll:**
  - Solo el contenido del shell se desplaza, en un scroller a todo el ancho entre el encabezado y la navegación (`overscroll-behavior: contain`).
  - `html, body` llevan `overscroll-behavior: none`.
  - Auth, asistente e `/invitacion` siguen con el scroll del documento, sin rebote ni pull-to-refresh.

## A. Registro rápido (`cc-quick-entry`, `cc-entry-endpoints`, `cc-keypad`, `cc-amount-display`)

- **Overlay:**
  - `.cc-overlay-entry` pasa a contenedor transparente y sin sombra, con la franja superior como `padding-top`. Material deja `overflow: auto` y recortaría lo de fuera.
  - Los íconos y el asa (o la ✕) se pintan antes de `cc-overlay-panel`, en el host del registro rápido; dentro del cuerpo con scroll quedarían recortados.
  - El formulario y las vistas (selectores, borrar, descartar) pintan cada uno su superficie con radio arriba, y la franja mide lo mismo en todas.
  - El alto máximo del panel descuenta la franja, para no tener dos scrollers.
  - **Toques en la franja:** el panel y el contenedor del sheet llevan `pointer-events: none`, y el panel, los íconos y el asa, `auto`. Así un toque en la franja cae en el fondo de CDK y sigue el camino de siempre (guarda e historial), sin código nuevo.
  - `hideClose` también oculta la ✕ flotante (hoy solo aplica a la barra). Se quita el espacio que los bloques le reservan.
  - `cc-overlay-panel` gana una ranura sin padding arriba (`ccOverlayHero`) para los bloques.
- **Bloques:**
  - Van a todo el ancho y pegados arriba, con las esquinas superiores del sheet y relleno `paletteColor`.
  - Texto con `paletteOnColorText`: "De cuenta" (label) y el nombre (title-large).
  - Tocar un bloque abre la vista de cuentas o categorías, como hoy.
  - Se quita `--cc-overlay-close-clearance` de los bloques.
- **Asa:**
  - Es `cc-sheet-handle`, una molécula: píldora clara sobre el fondo atenuado y área táctil de 48 px.
  - En el registro rápido es el botón "Cerrar" (mismo nombre que la ✕ de hoy), con la guarda de descarte.
  - El atrás, Esc y el fondo siguen igual.
- **Subcategorías:** `cc-chip-choice` ya pinta borde, ícono y texto con `paletteTextColor` en los no elegidos. Se revisa con screenshot. El elegido va relleno, con `paletteOnColorText` en la etiqueta.
- **Monto:** `cc-amount-display` separa `--cc-amount-color` (3:1, `paletteLargeTextColor`) de `--cc-amount-label-color` (4,5:1).
- **Nota:**
  - `cc-text-field` gana `appearance="outline"`, `align="center"`, la etiqueta solo para lectores de pantalla (el `label` sigue obligatorio) y una ranura al final.
  - La nota queda redondeada, con "Notas…" centrado y el ícono de etiqueta (`sell`) al final.
- **Etiquetas:**
  - El ícono abre una vista "Etiquetas" con `cc-chip-select`. Las elegidas se ven como chips pequeños bajo la nota; tocarlas abre la misma vista.
  - Siguen precargadas desde la categoría.
  - Sin etiquetas en el espacio, no hay ícono.
  - Sale el `cc-disclosure`.
- **Teclado:**

  | col 1 | col 2 | col 3 | col 4   | col 5    |
  | ----- | ----- | ----- | ------- | -------- |
  | ÷     | 7     | 8     | 9       | ⌫        |
  | ×     | 4     | 5     | 6       | 📅       |
  | −     | 1     | 2     | 3       | ✓ (alto) |
  | +     | 000   | 0     | decimal | ✓        |
  - Sin decimales, el 0 ocupa dos casillas.
  - La tecla 📅 es opcional (input `dateKey`). En la calculadora del presupuesto no está, y ⌫ ocupa sus dos filas.
  - Operadores, ⌫ y 📅 en gris neutro (`surface-container-highest` / `on-surface-variant`); dígitos en superficie clara con borde `outline-variant`.
  - ✓ con `paletteColor(acento)` y `paletteForeground`. La calculadora pasa el color de su categoría.

- **Fecha:**
  - Texto bajo el teclado: "Hoy, 27 nov 2026", con el año siempre (nueva opción de `entryDateText`).
  - Tocarlo, o la tecla 📅, abre la vista de fecha.
  - Al editar sin teclado, la línea queda al final del formulario, así que sale "Fecha" de las acciones (quedan Borrar y Duplicar).
- **Sin ayudas en el registro:** sale la ayuda de "Incluir en el espacio" (ya la explica la cuenta). Las cuotas y el interruptor solo aparecen cuando aplican, como hoy.
- **Meta de alto:** un gasto típico (bloques, chips, monto, nota, teclado y fecha) cabe sin scroll en 360×740. Lo comprueba un e2e.

## B. Encabezado, menú lateral y títulos

### B1. Encabezado

- **Compacta, fila 1:** avatar a la izquierda ("Abrir el menú"), total al centro ("Total" y el monto) y la acción de la pantalla a la derecha.
- **Compacta, fila 2:** `‹ chip ›` a todo el ancho. En Cuentas, sus pestañas.
- **Fuera del encabezado:** el ⚙ y el selector de espacio.
- **Acción por pantalla** (directiva `ccHeaderAction`):

  | Pantalla      | Acción                                                                                                                                                        |
  | ------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
  | Cuentas       | "+"                                                                                                                                                           |
  | Categorías    | lápiz (si puede editar)                                                                                                                                       |
  | Transacciones | 🔍. Abre el campo de búsqueda arriba del contenido, con foco; se queda visible mientras haya texto. El "+" pasa a un FAB abajo a la derecha (atajo `N` igual) |
  | Presupuesto   | ninguna                                                                                                                                                       |
  | Resumen       | ninguna                                                                                                                                                       |

- **Componentes:**
  - `cc-avatar`, un átomo: iniciales del nombre visible, hasta que haya foto.
  - El rail gana una ranura arriba para el avatar.
- **Total:** mientras carga, esqueleto en lugar de "—".

### B2. Títulos

Regla para §13.5:

- Las pestañas principales no llevan título: lo dice la navegación.
- Se quitan:
  - los títulos que solo nombran lo que se ve;
  - los títulos de sheet que repite el contenido;
  - las etiquetas y subtítulos redundantes;
  - las ayudas que solo sirven la primera vez.
- Se quedan:
  - la barra ← con título de subpantallas, flujos y vistas;
  - los títulos que separan contenido distinto;
  - los estados vacíos y los avisos de estado;
  - las ayudas que explican una consecuencia (privacidad, rol, deuda en positivo).
- Si se quita un título visible, su región conserva el nombre (`aria-label` o `.cc-visually-hidden`).

| Pantalla                                         | Quito                                                                                                                                                                                                                                                                                                                                                                                                                                                                       | Dejo                                                                                                                                                                                                                                    | Motivo                                                                                                             |
| ------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| **Cuentas**                                      | h1 "Cuentas" (el "+" va al encabezado). Fila "Total" de la lista cuando hay una sola moneda                                                                                                                                                                                                                                                                                                                                                                                 | Pestañas; grupos Cuentas/Ahorros/Deudas/Me deben; "Archivadas"; vacío; en Mis finanzas, Activos/Deudas/Neto y "Por moneda"; "Total" con varias monedas                                                                                  | El total ya está en el encabezado; con varias monedas la fila muestra el desglose. Los grupos separan contenido    |
| **Categorías**                                   | h1 "Categorías"; pestañas Gastos/Ingresos (B5)                                                                                                                                                                                                                                                                                                                                                                                                                              | "Completa tu configuración"; vacío; aviso de tasa                                                                                                                                                                                       | El centro del donut cambia de clase                                                                                |
| **Transacciones**                                | h1; campo "Buscar" siempre visible (pasa al 🔍)                                                                                                                                                                                                                                                                                                                                                                                                                             | Chips de filtro; Saldo inicial/final; Ingresos/Gastos/Neto; días; nota "Incluye … fuera del espacio"; vacíos                                                                                                                            | La nota explica una diferencia de totales y solo sale cuando aplica                                                |
| **Presupuesto**                                  | h1                                                                                                                                                                                                                                                                                                                                                                                                                                                                          | Filas total "Gastos" e "Ingresos esperados" (son los encabezados de sección); alcance; apagados; "se ve por mes o por año"; nota del año; panel vacío                                                                                   | Estados y la regla de solo lectura                                                                                 |
| **Resumen**                                      | h1                                                                                                                                                                                                                                                                                                                                                                                                                                                                          | "Balance"; tarjetas; h2 "Presupuesto"; pestañas; nota "% no suma 100" (solo en Etiqueta)                                                                                                                                                | "Presupuesto" separa contenido; la nota la pide §7                                                                 |
| **Detalle de cuenta**                            | —                                                                                                                                                                                                                                                                                                                                                                                                                                                                           | Barra ← nombre ✎ (fija en compacta); "Saldo"/"Lo que debes"; días; ayuda de Ajustar ("Se registra un ajuste…")                                                                                                                          | Subpantalla; consecuencia de la acción                                                                             |
| **Cuenta nueva/editar**                          | Título de la barra al editar = el nombre (pasa a "Editar cuenta", porque el nombre ya está grande debajo). h2 "Cuenta" (queda `aria-label`). Ayudas de "Incluir en el total" y "Cuenta predeterminada". "Cargando la cuenta…" (pasa a esqueleto)                                                                                                                                                                                                                            | Barra; filas; "Escríbelo en positivo…"; ayudas de "Cuenta privada" e "Incluir sus movimientos en el espacio"; avisos de tipo bloqueado y archivada                                                                                      | Nombre repetido; las ayudas que quedan explican deuda y privacidad                                                 |
| **¿Qué vas a crear?**                            | —                                                                                                                                                                                                                                                                                                                                                                                                                                                                           | Título y descripciones de cada opción                                                                                                                                                                                                   | Es un menú: el título da el contexto                                                                               |
| **Editar categorías**                            | Ayuda "Toca una categoría… arrástrala…" y la de teclado: pasan a `.cc-visually-hidden` con `aria-describedby`                                                                                                                                                                                                                                                                                                                                                               | Barra "Editar categorías"; pestañas; "Archivadas"; panel vacío                                                                                                                                                                          | Ayuda de primera vez; el lector de pantalla la conserva                                                            |
| **Categoría**                                    | Título de la barra al editar = el nombre (pasa a "Editar categoría"). Instrucción de reordenar (pasa a oculta). "Cargando…" (esqueleto)                                                                                                                                                                                                                                                                                                                                     | h2 "Subcategorías"; "Etiquetas por defecto"; "Añadir subcategoría"; aviso de archivada                                                                                                                                                  | "Subcategorías" separa la lista de la configuración                                                                |
| **Sheet de subcategoría**                        | —                                                                                                                                                                                                                                                                                                                                                                                                                                                                           | (título ya oculto) "Etiquetas por defecto"; "Categoría" con su ayuda en Más opciones                                                                                                                                                    | La ayuda explica que mover cambia su lugar                                                                         |
| **Sheet de etiqueta**                            | h3 "Color" (queda `aria-label` en la grilla); ayuda "Se pone sola al registrar…"                                                                                                                                                                                                                                                                                                                                                                                            | "¿En qué categorías se pone sola?"; h3 Gastos/Ingresos del árbol                                                                                                                                                                        | La pregunta ya lo dice                                                                                             |
| **Detalle de presupuesto**                       | —                                                                                                                                                                                                                                                                                                                                                                                                                                                                           | Título (la categoría); fila del periodo; "Los cambios rigen: solo {mes}"                                                                                                                                                                | Recordar el alcance evita errores                                                                                  |
| **Calculadora y Quitar**                         | —                                                                                                                                                                                                                                                                                                                                                                                                                                                                           | Título "Cat › Línea"; etiqueta del monto; confirmación                                                                                                                                                                                  | Contexto que pide §4.7                                                                                             |
| **¿Qué vas a registrar?**                        | Título visible (queda como nombre del overlay); constante sin uso `transferHint`                                                                                                                                                                                                                                                                                                                                                                                            | Pestañas Ingreso/Gasto/Transferencia                                                                                                                                                                                                    | Las pestañas ya dicen qué se registra                                                                              |
| **Registro rápido**                              | Disclosure "Etiquetas"; ayuda de "Incluir en el espacio"; acción "Fecha"                                                                                                                                                                                                                                                                                                                                                                                                    | Título oculto; "Gasto"/"Ingreso"; barras ← de las vistas; "0 = sin interés"                                                                                                                                                             | Ver A                                                                                                              |
| **Overlays**                                     | —                                                                                                                                                                                                                                                                                                                                                                                                                                                                           | Títulos de periodo, Tipo, Moneda, Rol (nombran el campo que se elige); confirmaciones; razón de la tasa faltante; ayuda "Aplica a los movimientos de esa fecha en adelante" de la tasa                                                  | La ayuda de la tasa explica una consecuencia que no es obvia                                                       |
| **Configuración**                                | h1 (pasa a barra ←). Descripciones de "Tu perfil", "Preferencias" y "Catálogos". Ayudas "La que se abre al entrar", "Separadores…", "Por ejemplo: Hogar…", "Los totales se muestran en esta moneda", "Se usa en los dispositivos…", "En Presupuesto y en las burbujas…". Secciones "Miembros" y "Configuración inicial" (encabezado y descripción de una sola fila: las filas pasan a "Espacio"). Subtítulos fijos de las filas de Catálogos. Tema y "Sesión" (van al menú) | Barra ← "Configuración"; h2 "Tu perfil", "Preferencias", "Espacio", "Catálogos"; la ayuda dinámica del día de inicio ("Cada mes va del 1 al…"); descripción de Espacio solo para quien no es propietario; conteo de miembros en su fila | Son ayudas de primera vez y encabezados de una fila. Las secciones que quedan separan usuario, espacio y catálogos |
| **Etiquetas / Monedas**                          | Monedas: párrafo de introducción                                                                                                                                                                                                                                                                                                                                                                                                                                            | Barras ←; vacíos; secciones por moneda con "Vigente…"                                                                                                                                                                                   | La regla de tasas vive en la spec                                                                                  |
| **Miembros**                                     | h2 "Miembros (N)" (repite la barra; queda `aria-label`); "Toca a alguien…"; descripción "Cada invitación sirve…"; botón "Invitar a alguien" (repite el + de la barra); h2 "Salir del espacio"                                                                                                                                                                                                                                                                               | Barra ← "Miembros" con +; "Solo el propietario invita…" (a los demás); h2 "Invitaciones pendientes" (solo si hay); "Salir de {espacio}" con la explicación solo cuando está deshabilitado                                               | Repetidos y ayudas de primera vez; lo que queda explica por qué falta un control                                   |
| **Invitar**                                      | Ayuda "Si la persona no tiene cuenta, le llega un correo…"                                                                                                                                                                                                                                                                                                                                                                                                                  | h2 "Invitar a {espacio}" (con varios espacios dice a cuál); descripción del rol; vista del link completa                                                                                                                                | El resultado ya lo explica                                                                                         |
| **Asistente**                                    | —                                                                                                                                                                                                                                                                                                                                                                                                                                                                           | Todo                                                                                                                                                                                                                                    | Es la primera vez: ahí sí sirven las ayudas                                                                        |
| **Auth, `/invitacion`** (sumado durante la fase) | "¡Listo!": el título "Instala la app" (queda para lectores). Antes de aceptar con cuenta nueva: "Únete a Cuentas Claras" (la línea del logo pasa a ser el título, "Únete a" + logo + "Cuentas Claras"). "Invitación" en vencida, usada, revocada, inválida, iniciar sesión, otra cuenta y responder (queda para lectores). Subtítulos de iniciar sesión, recuperar y restablecer                                                                                            | La tarjeta de la invitación, el texto de la cuenta, el formulario, "¡Listo!" con su subtítulo, los mensajes de estado                                                                                                                   | Repiten el logo, la tarjeta, los campos o un botón                                                                 |

### B3. Menú lateral (`cc-app-drawer`, organismo; el shell lo conecta)

- **Arriba:** avatar, nombre visible y correo. Debajo, el espacio activo (badge, nombre y rol).
  - Con más de un espacio, tocarlo despliega la lista (con el rol) en el mismo menú.
  - Al elegir uno: `select()`, va a la pantalla de inicio y se cierra el menú.
- **Opciones:**
  - Configuración.
  - Miembros, con el conteo.
  - Tema: `cc-segmented-control` Sistema/Claro/Oscuro, inmediato.
  - Instalar la app: solo si no está instalada, con `isStandalone` como señal. En Android y escritorio, con aviso del navegador, `prompt()`; si no, una vista con `cc-install-steps`.
  - Acerca de: una vista con el logo, la versión y "Buscar actualizaciones" (`AppUpdateService`).
  - Cerrar sesión, con la misma confirmación de hoy.
- **Cerrar:** atrás de Android, Esc, tocar fuera o deslizar a la izquierda (`ccDragDismiss`). Entra y sale deslizándose desde la izquierda.
- **Futuro:** datos, exportar y ayuda van como filas nuevas.

### B4. Expandida

El avatar va arriba del rail y abre el mismo drawer. Se elige el drawer y no un panel: es un solo componente y un solo comportamiento, y es el "modal navigation drawer" de M3, válido en pantallas grandes. Se registra en §13.5.

### B5. El donut cambia entre gastos e ingresos (aprobado)

- **Cómo quedaría:**
  - Sin las pestañas Gastos/Ingresos en Categorías (el modo edición las conserva, como 1Money).
  - El centro del donut muestra la clase visible grande ("Gastos $X") y la otra en pequeño ("Ingresos $Y"), con un ícono ⇅ discreto.
  - Tocar el centro cambia la grilla, el donut y `?clase=` (con `replaceUrl`, como hoy).
  - Se ganan unos 48 px.
- **Accesibilidad:**
  - El centro deja el `aria-hidden` y pasa a ser un `<button>`:
    - nombre: la acción ("Ver ingresos");
    - `aria-describedby`: los dos totales.
  - Al cambiar:
    - una región `aria-live="polite"` dice "Mostrando ingresos";
    - la grilla cambia su nombre ("Categorías de ingresos").
  - Teclado: Tab y Enter o Espacio. El área táctil es todo el centro (más de 44 px).
  - **Riesgo:** quien no conoce 1Money no sabe que el centro se toca. Lo mitigan el ⇅ y el texto de la otra clase.
- **Además:**
  - se ajustan los e2e que tocan la pestaña "Ingresos";
  - se registra en §7.

## C. Que se sienta como app

1. **Barras del sistema:**
   - **Tema resuelto:** `ThemeService` gana `preference` y `scheme`.
     - `apply()` actualiza `scheme` justo después de poner `data-theme`, y un listener de `matchMedia` cubre "Según el sistema". Así no depende del orden de los efectos.
     - `set(theme)` es optimista.
   - **`resolveLightDark`:** sale de `bar-chart.ts` a un helper compartido, porque el estilo computado devuelve `light-dark(a, b)` tal cual. Lo usan la gráfica y `SystemBarsService`.
   - **`SystemBarsService`** (`core/theme`):
     - toma el color de `--cc-bar-surface`;
     - con `n` overlays abiertos lo mezcla con el fondo atenuado, con alfa `1-(1-a)^n` (puro: `blendColors` y `parseCssColor` en `domain/color`, con pruebas);
     - escribe el resultado en las **dos** metas `theme-color` (claro y oscuro), que conservan su `media`.
   - **Overlays abiertos:** `OverlayService.anyOpen` cuenta en `open()` y descuenta en el cierre, no en `afterDismissed`, que llega 375 ms tarde en los sheets. Entran los sheets, los diálogos, las confirmaciones, el periodo y el drawer; el snackbar, los selects y los tooltips no.
   - **Fondo atenuado:** regla sin capa `rgb(var(--cc-scrim-rgb) / var(--cc-scrim-opacity))`, que gana a la de CDK (`@layer cdk-overlay`).
   - **Superficie de cada marco:** el asistente en compacta y el login redefinen `--cc-bar-surface` con la superficie de su borde superior.
   - **`index.html`:**
     - las dos metas traen los valores iniciales;
     - suma `interactive-widget=resizes-content`;
     - se actualiza el comentario de `_theme.scss` sobre `#1e4e8c`.
   - **Manifest:** con sus colores nuevos (ver Decisiones).
   - **De paso:** `theme.e2e.ts:37` toma los tres primeros números del color, que con `light-dark()` son los del claro. Se arregla con el mismo helper.
2. **Solo el contenido se desplaza:**
   - **Shell:**
     - `cc-app-shell` pasa a una grilla de alto `var(--cc-shell-height, 100dvh)`: encabezado, scroller y navegación en flujo, y el rail estirado.
     - El scroller es un elemento **a todo el ancho** con `cdkScrollable`, `overflow-y: auto`, `overflow-x: hidden`, `overscroll-behavior: contain` y `tabindex="-1"`.
     - Por dentro va un contenedor centrado, que se queda con `max-width`, padding y `wide-content`. Si el scroller fuera el `<main>` centrado, la barra quedaría a la mitad de la pantalla y la rueda no movería nada en los márgenes.
     - El padding inferior deja de sumar la navegación.
   - **`ScrollContainer`:**
     - Solo lo registra el `Shell` real, no las copias del catálogo `/ui`, que usan `--cc-shell-height: 100%`.
     - Al terminar cada navegación, si el foco quedó en `body` o en la navegación, pasa al scroller (`preventScroll`). Así las teclas de página y las flechas funcionan en escritorio.
   - **Se ajustan:**
     - `list-detail-layout`: se borra su `window.scroll*` (lo cubre la memoria) y los paneles llevan `cdkScrollable`. Hoy el drag-drop no hace autoscroll ahí;
     - el `top` de la barra de flujos pasa a `0`;
     - los overlays mantienen la estrategia de scroll `block`. Dentro del shell no hace nada, y fuera (asistente e `/invitacion`) evita que el fondo se desplace.
   - **Memoria por pestaña:**
     - Guarda `scrollTop` por URL en NavigationStart.
     - Al terminar la navegación, en `afterNextRender({ write })`:
       - restaura si la URL es menos profunda o es otra pestaña;
       - vuelve arriba si es más profunda (por la profundidad de la URL, no por `popstate`, porque los ← navegan a `..`).
     - Si el contenido todavía no tiene alto, espera con un `ResizeObserver` sobre el contenedor interno. Se cancela con rueda, toque o tecla, y al segundo.
     - Las navegaciones que solo cambian query params con `replaceUrl` (las pestañas internas) no tocan el scroll.
     - Se limpia al cambiar de espacio y al cerrar sesión.
   - **Screenshots:** `capture()` del e2e inyecta un estilo temporal (`addStyleTag`): el shell a `height: auto` y el scroller a `overflow: visible`. Así el `fullPage` sigue completo sin cambiar el viewport ni los `dvh`.
   - **Lo que se pierde:**
     - En iOS, el toque en la barra de estado ya no sube al inicio.
     - En el navegador, Chrome ya no esconde su barra; en la app instalada no aplica.
     - Queda en la spec.
3. **Nada de página:**
   - **Selección y arrastre:**
     - en `body`: `user-select: none`, `-webkit-touch-callout: none` y `-webkit-user-drag: none` en imágenes y SVG;
     - `user-select: text` en inputs, textarea y `.cc-selectable` (notas de movimientos y el link de invitación).
   - **Gestos:** `touch-action: manipulation` en `html`. El zoom con dos dedos sigue (no se toca `maximum-scale`).
   - **Barras de scroll:** en `pointer: coarse` no se ven.
   - **Ancho:** sin desborde horizontal en 360 px (se arregla la fuente, no se esconde).
4. **Movimiento:**
   - **Transiciones de pantalla:** `withViewTransitions` con `skipInitialTransition` y una función pura `navigationTransition(from, to)`, que devuelve `fade`, `forward`, `back` o `none`:
     - entre pestañas, fundido;
     - a una subpantalla más profunda, deslizar hacia adelante;
     - de vuelta, hacia atrás.
   - **Cuándo no hay transición:**
     - cuando solo cambian query params;
     - entre lista y detalle lado a lado en expandida;
     - al entrar o salir de un flujo en compacta (el encabezado y la navegación aparecen o desaparecen);
     - con un overlay abierto o su fondo todavía visible (CDK los pinta en el top layer, y quedarían bajo el encabezado nombrado);
     - con `prefers-reduced-motion` (`skipTransition()`).
   - **Qué se anima:** el encabezado, la navegación y el rail tienen su propio `view-transition-name`; el scroller a todo el ancho lleva el suyo, así solo se mueve el contenido.
   - **Detalles:**
     - `data-cc-transition` en `<html>` lleva el id de la transición, y solo se limpia si sigue siendo el suyo.
     - Las duraciones van con tokens.
     - Angular ya salta cuando el navegador hizo su propio gesto de atrás.
   - **Arrastrar para cerrar:** directiva `ccDragDismiss` en `shared/ui/services/drag-dismiss.ts`.
     - Usa pointer events con `setPointerCapture`, y `touch-action: none` en el asa.
     - Mueve el `.cdk-overlay-pane`, no el contenedor, porque la animación de Material le gana a los estilos en línea.
     - Pasado el umbral, llama a `handle.requestClose()`, que pasa a devolver si cerró. Si la guarda lo frena, el sheet vuelve a su lugar.
     - Si cierra, el pane se queda donde quedó y la salida sigue desde ahí.
     - Se ignora el clic que sigue a un arrastre, porque el asa también es "Cerrar".
   - **El drawer en `OverlayService`:**
     - Tamaño `drawer`: diálogo a la izquierda, de alto completo, también en compacta (nunca como sheet).
     - Entra y sale deslizándose, con `enter`/`exitAnimationDuration` y CSS propio. Material cierra cuando termina esa duración.
     - Sus opciones no navegan directo: devuelven el destino y el shell navega después de cerrar, como hoy con el espacio. Si navegara antes, el cierre dejaría un atrás muerto en el historial.
   - **Estado presionado:** mixin `state-layer` (`src/styles/_interaction.scss`, con `--mat-sys-pressed-state-layer-opacity`). Se aplica en burbujas, bloques, filas de cuenta y presupuesto, tarjetas del Resumen, chip de periodo, teclado y filas del menú. Lo que ya tiene `matRipple` se queda.
5. **Esqueletos:**
   - **Componente:** `cc-skeleton` (átomo: línea, círculo y bloque; brillo que se apaga con movimiento reducido).
   - **Dónde:** entrada `loading` en `cc-category-grid`, `cc-account-list`, `cc-transaction-list` (y sus casillas de saldos y totales), `cc-budget-list`, `cc-net-worth`, `cc-member-list`, el Resumen y el total del encabezado.
   - **Cuándo:** se usan los `loaded`/`isLoading` que ya existen. Se suma `categoryTotalsLoading` en `TotalsService`.
   - **Al cambiar de periodo:** se conservan los montos anteriores hasta que llegan los nuevos, sin esqueleto ni "$ 0".
   - Los "Cargando…" de las pantallas de cuenta y categoría pasan a esqueleto.
6. **Auditoría:** pasada con Playwright en Pixel 7 (Chrome) e iPhone 15 (WebKit) por las 5 pestañas, los detalles, Configuración, el registro rápido y el menú. Revisa:
   - foco visible al tocar;
   - inputs de menos de 16 px (zoom de iOS);
   - hover pegado en táctil;
   - tooltips por mantener presionado;
   - selects y fechas nativos;
   - arrastre de links;
   - el teclado del sistema sobre la nota y la búsqueda;
   - la navegación inferior con el teclado abierto;
   - el título de la tarea;
   - los avisos sobre la navegación.

   Lo que entra se arregla. Lo demás va a la spec como "Pendientes de sensación nativa" (§13.4).

## Pruebas

- **Unitarias:**
  - `paletteOnColorText` ≥ 4,5:1 y `paletteLargeTextColor` ≥ 3:1 para los 80 colores en claro y oscuro (el naranja base se conserva en el monto);
  - `blendColors` y `parseCssColor`;
  - `entryDateText` con año;
  - `navigationTransition`;
  - las reglas de la memoria de scroll;
  - `ThemeService.scheme` y `set()` con su reversión;
  - `OverlayService.anyOpen`.
- **e2e:**
  - **`native-feel.e2e.ts`** (proyectos móviles e `iphone-webkit`):
    - el encabezado y la navegación no se mueven al desplazar;
    - el documento no se desplaza y no hay desborde horizontal en 360 px;
    - `theme-color` sigue el tema de la app y se atenúa con un sheet y con el menú;
    - el manifest coincide con los tokens;
    - `user-select` en botones y en inputs;
    - inputs ≥ 16 px;
    - la memoria de scroll;
    - el registro rápido sin scroll en 360×740;
    - el menú:
      - abre, cambia el tema y se cierra con el atrás y con Esc;
      - el foco vuelve al avatar;
      - tras ir a Configuración desde el menú, un atrás vuelve al origen;
    - arrastrar el asa:
      - sin cambios cierra;
      - con cambios muestra "¿Descartar…?";
      - un arrastre corto no cierra;
    - la memoria de scroll: volver de un detalle restaura, una subpantalla empieza arriba y un cambio de pestaña interna no mueve nada;
    - una prueba en Chromium con `reducedMotion: 'no-preference'` recorre pestaña, subpantalla y vuelta con transiciones.
  - **Ajustes:**
    - `transactions.e2e` (el asa conserva "Cerrar"; "Hoy, 26 nov 2026");
    - `layout`, `navigation` y `accounts` (h1 de las pestañas);
    - `sharing` (el selector de espacio pasa al menú; "Miembros (N)");
    - `categories` (`.total-value`);
    - `onboarding` ("Sesión iniciada como…" pasa al menú);
    - unitarias de `page-header`, `shell`, `app-shell` y `settings-page`.
- **Catálogo `/ui`:** se suman `cc-avatar`, `cc-skeleton`, `cc-sheet-handle`, `cc-app-drawer`, el encabezado de dos filas, el teclado, los bloques y la nota outline.
- **Screenshots:** móvil y escritorio, claro y oscuro, más iPhone, junto a las referencias.

## Spec, CLAUDE.md y commits

- **Spec (v0.13):**
  - **§7:** encabezado global (dos filas, acciones por pantalla, avatar, Cuentas con pestañas), menú lateral, registro rápido (bloques, asa, teclado, nota, etiquetas, fecha, colores), Transacciones (🔍 y FAB), Configuración (sin tema ni sesión) y subpantallas.
  - **§13.1:** los componentes nuevos.
  - **§13.2:** `theme-color`, manifest, iOS y la versión.
  - **§13.4:** sensación nativa, esqueletos y pendientes.
  - **§13.5:** títulos, asa y arrastre, excepción del registro rápido, drawer, subpantallas y transiciones.
  - **§10 y §12:** la F1g.
- **`CLAUDE.md`:** `native-feel.e2e.ts` en `iphone-webkit` y la versión por fase.
- **Commits:**
  1. el plan;
  2. dominio de color y acento;
  3. registro rápido;
  4. asa, arrastre y `anyOpen`;
  5. shell (scroller, encabezado, `ccHeaderAction`, subpantallas, memoria);
  6. menú lateral, avatar, tema y versión;
  7. títulos;
  8. `theme-color`, manifest e iOS;
  9. transiciones, presionado, selección;
  10. esqueletos;
  11. auditoría y e2e;
  12. spec y `CLAUDE.md`.

## Verificación

- **Antes del PR:**
  - `npm run lint`, `npm test` y `npm run build`;
  - `npm run e2e` (5 proyectos) y `npm run db:test`. Sin migraciones; la fase no toca invitaciones ni Edge Functions, así que no corre `e2e:local`.
- **Screenshots:** revisarlos junto a `reference/encabezado` y `reference/categorias`.
- **A mano**, en el preview de Vercel instalado, en Android y en el iPhone:
  - las barras de estado y de navegación: claro, oscuro, con un sheet y con el menú. En iOS no está confirmado que la barra siga un `theme-color` que cambia;
  - el autoscroll al reordenar una lista larga de categorías;
  - el teclado del sistema en la nota y en los flujos;
  - las transiciones;
  - la salida del drawer.
- **Entrega:** PR contra `main` sin merge. Nada en producción.
