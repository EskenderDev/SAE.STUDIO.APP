# SAELABEL.App

Frontend desktop con **Tauri 2 + Astro + React** para consumir `SAELABEL.Api`.

## Requisitos
- Node.js 20+
- Rust toolchain (para Tauri)
- Backend `SAELABEL.Api` corriendo en `https://localhost:7097`

## Variables de entorno
Crear `.env` opcional:

```bash
PUBLIC_SAELABEL_API_BASE_URL=https://localhost:7097
```

## Instalar dependencias
```bash
npm install
```

## Desarrollo web
```bash
npm run dev
```

## Desarrollo desktop (Tauri)
```bash
npm run tauri:dev
```

## OpenAPI
Genera cliente tipado desde el backend:

```bash
npm run gen:api
```

Detalles:
- Intenta descargar el spec desde `https://localhost:7097/openapi/v1.json`.
- Si falla (backend apagado/certificado local), usa `openapi/saelabel.openapi.json` en cache.
- Variables opcionales:
  - `SAELABEL_OPENAPI_URL` para cambiar la URL del spec.
  - `SAELABEL_OPENAPI_TIMEOUT_MS` para timeout de descarga.
