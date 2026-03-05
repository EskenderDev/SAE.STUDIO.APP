# Guía de Despliegue, Actualización y Servicio de SAE.STUDIO

Esta guía documenta la arquitectura de empaquetado de SAE.STUDIO, cómo funciona el actualizador automático (Tauri Updater), y los pasos necesarios para publicar nuevas versiones.

## Arquitectura de Distribución

La aplicación final se distribuye como un único instalador de Windows (MSI/NSIS) que contiene dos componentes principales:

1.  **Frontend (Tauri / React):** La interfaz gráfica de usuario.
2.  **Backend (.NET Core):** El servidor que procesa las plantillas XML y domina la lógica de impresión y renderizado, empaquetado como un *Sidecar* (un ejecutable secundario).

### Instalación como Servicio de Windows

Al ejecutar el instalador NSIS generado por Tauri, ocurren varias acciones clave configuradas a través de *NSIS Hooks* (`src-tauri/windows/hooks.nsh`):

*   **Pre-Instalación:** Detiene y elimina versiones anteriores del servicio `SAE.STUDIO.Api` si existen.
*   **Instalación:** Extrae el ejecutable sidecar `.NET` en la carpeta binaria del sistema.
*   **Post-Instalación:** Crea e instala automáticamente el servicio `SAE.STUDIO.Api` usando `sc.exe`, configurándolo para inicio automático (`start= auto`) y reglas de recuperación ante caídas. Finalmente, inicia el servicio en segundo plano de forma silenciosa para que la UI de Tauri pueda consumir la API limpia.
*   **Desinstalación:** Si el usuario desinstala la App de SAE.STUDIO, el *hook* detiene de manera limpia el servicio en segundo plano y luego lo elimina del administrador de servicios de Windows (`services.msc`).

---

## Actualizaciones Automáticas (Tauri Updater)

SAE.STUDIO está configurado con **Tauri Updater** apuntando directamente a las entregas de GitHub Releases (`https://github.com/EskenderDev/SAE_STUDIO/releases/latest/download/latest.json`). 

Para evitar alteraciones malintencionadas, el instalador usa comprobación de firmas criptográficas (claves generadas con el algoritmo ED25519). 

### 1. Claves de Configuración (IMPORTANTE)

El proceso de firmado utiliza dos claves (almacenadas localmente y gestionadas por claves de seguridad de GitHub):

1.  **Clave Pública:** Ya se encuentra incluida incrustada dentro del código fuente de la App (`tauri.conf.json`). Esta clave **SÍ** puede ser pública y es la que la App utilizará para validar que el paquete descargado de GitHub es el fidedigno y correcto.
2.  **Clave Privada (¡Mantenerla a salvo!):** Generada localmente en la máquina bajo la ruta `src-tauri/updater.key`.  **NUNCA debe subirse a Git ni compartirse**. Es imperativo mantener copias de seguridad de este archivo local fuera de la estructura del proyecto en caso de accidentes. Si pierdes la llave privada tendrás que forzar a la base de usuarios existente a descargar el programa desde cero, porque se romperá el updater.

### 2. Configuración en GitHub Actions (Paso Obligatorio)

Para que el servidor de integración continua (GitHub Actions) pueda generar instaladores .msi/.exe listos para distribución y "firmados" con tu clave privada:

1.  Ve a tu repositorio en GitHub: `https://github.com/EskenderDev/SAE_STUDIO`
2.  Navega a: **Settings** -> **Secrets and variables** -> **Actions**.
3.  Haz clic en **"New repository secret"**.
4.  Crea el primer secreto:
    *   **Name:** `TAURI_SIGNING_PRIVATE_KEY`
    *   **Secret:** _Copia y pega TODO el texto del archivo local_ `C:\Proyectos\repos\EskenderDev\SAELABEL.App\src-tauri\updater.key` _(incluyendo las líneas de "--BEGIN--" y "--END--")._
5.  Crea el segundo secreto (Solo si durante la generación pusiste una contraseña, sino, puedes saltarlo pero se recomienda si agregas una contraseña):
    *   **Name:** `TAURI_SIGNING_PRIVATE_KEY_PASSWORD`
    *   **Secret:** La contraseña en texto plano de tu clave. Si diste "Enter" para dejarla vacía, no es necesario crear este secreto.

---

## Cómo Publicar una Nueva Versión (Release)

¡No tienes que compilar ni subir de forma manual el instalador nunca más! Con el flujo de GitHub Actions implementado, solo debes hacer lo siguiente:

### Pasos para un Lanzamiento (Release):

1.  Abre el archivo `package.json` en la carpeta raíz (`SAELABEL.App`). Modifica la etiqueta `"version": "0.X.X"` con tu siguiente versión (por ejemplo `"version": "0.3.0"`).
2.  Abre el archivo `src-tauri/tauri.conf.json` y asegúrate de modificar también allí la misma `"version": "0.X.X"`.
3.  Abre la terminal o usa Visual Studio Code para consolidar tus cambios y lanzar una etiqueta de git (*Git Tag*). Sube los cambios así:

```bash
git add .
git commit -m "chore: preparar lanzamiento version 0.3.0"
git tag v0.3.0
git push --tags
```

### ¿Qué ocurre detrás de escena?
GitHub Actions detectará una nueva etiqueta en formato `v*` (ejemplo: `v0.3.0`). Activará instantáneamente el flujo documentado en `.github/workflows/release.yml` cumpliendo esta secuencia:
1. Configura Node.js y compila el frontend en Astro+React.
2. Descarga a nivel del servidor, compila y empaqueta `.NET 10 Core (SAE.STUDIO.Api)` dentro de un archivo EXE aislado usando MSBuild y PowerShell.
3. Lo mueve como Sidecar al proyecto.
4. Genera el instalador NSIS completo unificando el frontend y el `.NET Core API Service`.
5. Extrae tu variable de Entorno `TAURI_SIGNING_PRIVATE_KEY` en la nube para firmar la versión con seguridad criptográfica.
6. Publica el instalador MSI / Setup.exe en una pestaña de Releases de tu repositorio bajo la versión correspondiente.
7. Crea y sube el archivo `latest.json` que la App tomará como base para notificar a instalaciones antiguas "Existe una nueva versión, instálala ya".

Los usuarios recibirán una notificación (Configurada mediante el código del frontend) para que puedan actualizar usando un solo click dentro del programa.
