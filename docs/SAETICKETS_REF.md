# SAETickets & SAELABEL — Documentación de Referencia

## Tabla de Contenidos
1. [Arquitectura General](#1-arquitectura-general)
2. [Formato XML `saetickets`](#2-formato-xml-saetickets)
3. [Bloques del Diseñador](#3-bloques-del-diseñador)
4. [Sistema de Condiciones](#4-sistema-de-condiciones)
5. [Bloque `each` — Iteración de Listas](#5-bloque-each--iteración-de-listas)
6. [Impresoras Lógicas](#6-impresoras-lógicas)
7. [API — Servidor Local](#7-api--servidor-local)
8. [Convención de Datos](#8-convención-de-datos)

---

## 1. Arquitectura General

```
sae_app_local_server          SAELABEL (Desktop)          Impresora Física
     │                              │
     │  POST /api/labels/           │
     │  library/{nombre}/print      │
     │  { printerName, data }  ─────► Resuelve impresora lógica
     │                              │  Aplica config (copias, ancho)
     │                              │  Genera ESC/POS
     │                              └────────────────────────► ZDesigner / EPSON / etc.
```

**El servidor local solo conoce:**
- Nombre del documento a imprimir
- Nombre de la impresora lógica
- Datos variables (`data`)

**SAELABEL se encarga de:**
- Resolver la impresora lógica → física
- Aplicar configuración (copias, ancho de papel)
- Procesar el XML y generar comandos ESC/POS

---

## 2. Formato XML `saetickets`

```xml
<?xml version="1.0" encoding="utf-8"?>
<saetickets version="1.0">
  <setup width="42"/>           <!-- 42 = 80mm | 32 = 58mm -->
  <commands>
    <!-- bloques aquí -->
  </commands>
</saetickets>
```

---

## 3. Bloques del Diseñador

### `<text>` — Texto

```xml
<text align="center" bold="true" size="large"
      showIf="${MOSTRAR}">Título del Tiquete</text>
```

| Atributo | Valores | Default |
|----------|---------|---------|
| `align`  | `left | center | right` | `left` |
| `bold`   | `true | false` | `false` |
| `size`   | `normal | medium | large | extra-large` | `normal` |
| `showIf` | expresión de condición | — |

#### Negrita Implícita (Markdown-like)
El motor soporta negrita selectiva dentro de cualquier bloque de texto usando la sintaxis de doble asterisco:
`**este texto** será negrita`.

#### Comandos Dinámicos
Se pueden usar comandos especiales que el motor resuelve al momento de imprimir:
- `${DATE}`: Fecha corta (ej. 04/03/2026)
- `${TIME}`: Hora (ej. 14:30)
- `${NOW}`: Fecha y hora completa
- `${YEAR}`, `${MONTH}`, `${DAY}`: Componentes de fecha

---

### `<separator>` — Línea separadora

```xml
<separator char="-"/>
<separator char="="/>
<separator char="*"/>
```

---

### `<total>` — Línea de total

```xml
<total label="SUBTOTAL" value="${SUBTOTAL}" bold="false"/>
<total label="IVA"      value="${IVA}"      bold="false"/>
<total label="TOTAL"    value="${TOTAL}"    bold="true"/>
```

---

### `<qr>` — Código QR

```xml
<qr align="center" size="80">${URL_FACTURA}</qr>
```

| Atributo | Valores | Default |
|----------|---------|---------|
| `align`  | `left | center | right` | `center` |
| `size`   | píxeles del QR (32–200) | `80` |

---

### `<feed>` — Avance de papel

```xml
<feed lines="3"/>
```

---

### `<cut>` / `<beep>` / `<open-drawer>` — Acciones

```xml
<cut/>           <!-- Cortar papel -->
<beep/>          <!-- Pitido de la impresora -->
<open-drawer/>   <!-- Abrir cajón de dinero -->
```

---

### `<if>` — Condicional simple

Muestra el texto **solo si** la condición es verdadera.

```xml
<if expr="${MOSTRAR_DESC}" align="left" bold="false">
  Descuento: ${DESCUENTO}
</if>
```

---

### `<ifelse>` — Condicional con alternativa

```xml
<ifelse expr="${ES_MIEMBRO}" align="center">
  <then>Cliente Miembro — Gracias</then>
  <else>Gracias por su compra</else>
</ifelse>
```

---

### `<each>` — Iteración de lista

```xml
<each listVar="ITEMS" header="true">
  <column field="DESC"  label="Descripción" width="auto"  align="left"/>
  <column field="QTY"   label="Cant"        width="6"     align="right"/>
  <column field="PRICE" label="Precio"      width="10"    align="right" showIf="${MOSTRAR_PRECIO}"/>
  <column field="TOTAL" label="Total"       width="10"    align="right"/>
</each>
```

| Atributo | Descripción | Default |
|----------|-------------|---------|
| `field`  | Nombre del campo en los datos | — |
| `label`  | Encabezado de la columna | — |
| `width`  | `auto` o número de caracteres fijo | `auto` |
| `align`  | `left | center | right` | `left` |
| `bold`   | `true | false` (Negrita en TODA la columna) | `false` |
| `size`   | `normal | medium | large` | `normal` |
| `showIf` | Condición de visibilidad de la columna | — |

---

## 5. Bloque `each` — Extensiones Avanzadas

### Sub-items (Extras)
Es posible anidar una sub-lista (colección) dentro de cada item de la lista principal. Ideal para extras de platillos o notas de productos.

```xml
<each listVar="ITEMS" childField="EXTRAS" childIndentCol="1">
  <column field="QTY"  label="Cant"   width="4"/>
  <column field="DESC" label="Descripción" width="auto"/>
</each>
```

| Atributo | Descripción |
|----------|-------------|
| `childField` | Nombre de la propiedad que contiene los sub-items (ej. una cadena con saltos de línea o una sub-lista) |
| `childIndentCol` | Índice (0, 1, 2...) de la columna respecto a la cual se debe identar el sub-item |

---

## 4. Sistema de Condiciones

### Reglas de evaluación

Un valor es **falso** si es:
- Cadena vacía `""`
- `"0"`
- `"false"` / `"False"`
- `"no"` / `"No"`
- Variable sin resolver: `"${VAR}"` (la variable no existe en los datos)

Un valor es **verdadero** si es cualquier otro valor no vacío, por ejemplo `"1"`, `"true"`, `"si"`, un nombre, un número, etc.

### Usos

| Atributo | Dónde | Efecto |
|----------|-------|--------|
| `showIf="${VAR}"` | Cualquier bloque | Oculta el bloque completo si es falso |
| `showIf="${VAR}"` | `<column>` dentro de `<each>` | Oculta la columna en TODAS las filas |
| `expr="${VAR}"` | `<if>` | Condición de visibilidad del texto |
| `expr="${VAR}"` | `<ifelse>` | Determina cuál de las dos ramas mostrar |

### Ejemplos

```xml
<!-- Mostrar descuento solo si existe -->
<if expr="${DESCUENTO}">Descuento: ${DESCUENTO}</if>

<!-- Ocultar precio si es venta sin precio -->
<column field="PRICE" label="Precio" width="10" align="right"
        showIf="${MOSTRAR_PRECIO}"/>

<!-- Mensaje diferente si es cliente frecuente -->
<ifelse expr="${FRECUENTE}">
  <then>¡Gracias por regresar!</then>
  <else>Visítenos de nuevo</else>
</ifelse>

<!-- Bloque completo visible solo en cierto contexto -->
<total label="IVA 16%" value="${IVA}" bold="false"
       showIf="${TIENE_IVA}"/>
```

---

## 5. Bloque `each` — Iteración de Listas

### Convención de claves en `data`

Para una lista con `listVar="ITEMS"`:

```
ITEMS_COUNT    → número de filas (opcional, se detecta automáticamente)
ITEMS_0_DESC   → fila 0, campo DESC
ITEMS_0_QTY    → fila 0, campo QTY
ITEMS_0_PRICE  → fila 0, campo PRICE
ITEMS_1_DESC   → fila 1, campo DESC
...
```

### Ejemplo completo de datos (JSON para API)

```json
{
  "printerName": "Cocina",
  "data": {
    "FOLIO":           "000123",
    "FECHA":           "2026-03-04",
    "MESA":            "5",
    "ITEMS_COUNT":     "3",
    "ITEMS_0_DESC":    "Hamburguesa Clásica",
    "ITEMS_0_QTY":     "2",
    "ITEMS_0_PRICE":   "90.00",
    "ITEMS_0_TOTAL":   "180.00",
    "ITEMS_1_DESC":    "Papas Francesas",
    "ITEMS_1_QTY":     "1",
    "ITEMS_1_PRICE":   "45.00",
    "ITEMS_1_TOTAL":   "45.00",
    "ITEMS_2_DESC":    "Refresco",
    "ITEMS_2_QTY":     "2",
    "ITEMS_2_PRICE":   "25.00",
    "ITEMS_2_TOTAL":   "50.00",
    "SUBTOTAL":        "275.00",
    "IVA":             "44.00",
    "TOTAL":           "319.00",
    "MOSTRAR_PRECIO":  "1",
    "TIENE_IVA":       "1",
    "FRECUENTE":       "0"
  }
}
```

---

## 6. Impresoras Lógicas y Mapeo

### Mapeo en el diseño
El diseño puede incluir una lista de impresoras pre-vinculadas en el bloque `<setup>`:

```xml
<setup width="42" printers="Cocina, Bar, Caja"/>
```

El diseñador permite seleccionar múltiples impresoras mediante un buscador con multiselección.

### Impresora Lógica
Una **Impresora Lógica** es un alias con configuración que abstrae la impresora física del servidor local.

| Campo | Descripción |
|-------|-------------|
| `name` | Nombre lógico (el que envía el servidor local) |
| `physicalPrinter` | Nombre real de Windows |
| `copies` | Copias por defecto |
| `paperWidth` | `58` ó `80` mm |
| `mediaType` | `receipt` (tiquete) ó `label` (etiqueta) |
| `isActive` | Habilitar/deshabilitar |

### Endpoints

```
GET    /api/logical-printers          → Lista todas
POST   /api/logical-printers          → Crear/actualizar
DELETE /api/logical-printers/{id}     → Eliminar
GET    /api/logical-printers/system-printers  → Impresoras físicas de Windows
```

---

## 7. API — Servidor Local

### Imprimir documento de la librería

```
POST /api/labels/library/{nombre}/print
```

**Body:**
```json
{
  "printerName": "NombreLogico",
  "copies": 1,
  "data": {
    "VAR1": "valor1",
    "VAR2": "valor2"
  }
}
```

> `copies` en el body tiene prioridad sobre la configuración de la impresora lógica.  
> Si `printerName` coincide con una impresora lógica, se resuelve automáticamente.

---

## 8. Convención de Datos

### Variables simples

```
${VARIABLE}   → se reemplaza en cualquier atributo o contenido de texto
```

### Datos por fila en `each`

```
LISTA_N_CAMPO
│     │  └── Nombre del campo (=field en <column>)
│     └───── Índice basado en 0
└─────────── Valor del atributo listVar
```

Ejemplo para `listVar="PRODUCTOS"`:
- `PRODUCTOS_0_NOMBRE`, `PRODUCTOS_0_PRECIO`
- `PRODUCTOS_1_NOMBRE`, `PRODUCTOS_1_PRECIO`
- `PRODUCTOS_COUNT` (opcional, se auto-detecta)

---

## Ejemplo de tiquete completo

```xml
<?xml version="1.0" encoding="utf-8"?>
<saetickets version="1.0">
  <setup width="42"/>
  <commands>
    <text align="center" bold="true" size="large">MI RESTAURANTE</text>
    <text align="center">Tel: 555-0100</text>
    <separator char="="/>
    <text align="left">Folio: ${FOLIO}    Mesa: ${MESA}</text>
    <text align="left">Fecha: ${FECHA}</text>
    <separator char="-"/>
    <each listVar="ITEMS" header="true">
      <column field="DESC"  label="Descripción" width="auto"  align="left"/>
      <column field="QTY"   label="Cant"        width="5"     align="right"/>
      <column field="PRICE" label="Precio"      width="9"     align="right" showIf="${MOSTRAR_PRECIO}"/>
      <column field="TOTAL" label="Total"       width="9"     align="right"/>
    </each>
    <separator char="-"/>
    <total label="Subtotal" value="${SUBTOTAL}" bold="false"/>
    <total label="IVA 16%"  value="${IVA}"      bold="false" showIf="${TIENE_IVA}"/>
    <separator char="="/>
    <total label="TOTAL" value="${TOTAL}" bold="true"/>
    <separator char=" "/>
    <ifelse expr="${FRECUENTE}">
      <then>¡Gracias por regresar!</then>
      <else>Vuelva pronto</else>
    </ifelse>
    <if expr="${URL_FACTURA}">
      <qr align="center" size="80">${URL_FACTURA}</qr>
    </if>
    <feed lines="3"/>
    <cut/>
  </commands>
</saetickets>
```
