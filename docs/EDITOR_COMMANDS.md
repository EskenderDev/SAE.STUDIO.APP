# SAELABEL App - Comandos Del Editor Visual

Este documento resume los comandos y atajos actuales del `VisualCanvasEditor`.

## 1. Seleccion Y Deseleccion

- `Click` en objeto: seleccion simple.
- `Click` en objeto ya seleccionado (seleccion unica): deselecciona.
- `Ctrl + Click` o `Shift + Click` en objeto: agrega/quita de seleccion multiple.
- `Click` en area vacia (canvas o area gris): limpia seleccion.
- `Escape`: limpia seleccion y cierra menu contextual.

## 2. Seleccion Por Rectangulo

- `Click + Drag` izquierda -> derecha: selecciona objetos que **toquen** el rectangulo.
- `Click + Drag` derecha -> izquierda: selecciona objetos que queden **encerrados** completamente.
- El rectangulo se puede iniciar tanto en la etiqueta como en el area gris externa del viewport.

## 3. Mover Objetos

- `Drag` de objeto: mueve el objeto.
- Si el objeto pertenece a un grupo: mueve todo el grupo.
- Si el objeto esta en una seleccion multiple activa: mueve todos los seleccionados.

## 4. Resize, Rotacion Y Skew

### 4.1 Resize

- `Drag` de handles en modo normal: cambia `W/H` del objeto.

### 4.2 Modo Transformacion Por Doble Click

- `Doble click` sobre objeto: activa/desactiva modo transformacion de ese objeto.
- En modo transformacion:
  - handles de esquina: `Rotate`.
  - handles laterales: `Skew`.

### 4.3 Modificadores Durante Drag De Handle

- `Shift + Drag` handle: fuerza `Rotate`.
- `Alt + Drag` handle: fuerza `Skew` (auto `SkewX/SkewY` segun direccion del movimiento).
- `Ctrl + Drag` (o `Cmd + Drag` en macOS): fuerza `SkewY`.
- En skew, mantener `Shift` durante el arrastre activa modo fino (mas suave).

## 5. Menu Contextual (Click Derecho)

Disponible sobre objeto/capas:

- `Duplicar`
- `Traer al frente`
- `Agrupar` (solo si hay 2+ elementos seleccionados)
- `Desagrupar` (solo si hay seleccion agrupada; si no, aparece deshabilitado)
- `Eliminar`

## 6. Eliminacion

- `Delete` o `Backspace`: elimina seleccion actual (si no estas escribiendo en input/textarea).
- Desde menu contextual: `Eliminar`.
- Boton superior: `Eliminar seleccion`.

## 7. Capas

- Panel de capas en recuadro con scroll.
- Los grupos se muestran como carpeta `[G] Grupo (N)`.
- `Drag & Drop` en capas: reordena capas/elementos.
- Flechas `↑` y `↓` en cada fila de capa: mueve arriba/abajo en z-order.
- Click derecho en capa/grupo: abre menu contextual.

## 8. Barra De Elementos

- `Drag & Drop` desde la barra de elementos hacia la etiqueta para crear objetos.
- Soporta `text`, `barcode`, `box`, `line`, `ellipse`, `image`.

## 9. Zoom Y Plantilla

- Slider `Zoom`: afecta solo el canvas/etiqueta.
- Inputs de `ancho/alto (pt)` en topbar: cambian tamaño de plantilla.
- Boton `Aplicar XML`: persiste cambios actuales al XML (`saelabels` o `glabels`).

## 10. Documentos

- `Guardar`: guarda documento actual en backend.
- `Cargar`: carga documento seleccionado.
- `Eliminar`: borra documento seleccionado.

## 11. Notas

- Valores de transformacion (`rot_deg`, `scale_x`, `scale_y`, `skew_x`, `skew_y`) se reflejan al exportar/aplicar XML.
- El comportamiento de cursor/borde cambia segun accion activa (`resize/rotate/skew`) para mejor feedback visual.
