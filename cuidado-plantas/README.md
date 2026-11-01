# Brote — Cuidado de plantas

App para el celular que organiza el riego y el abono de tus plantas, guarda fotos de cada una y, con una foto, te dice qué problemas tiene usando Claude. Mismo formato que Déficit Tracker: una página web publicada en Netlify que se agrega a la pantalla de inicio y queda con su ícono.

## Qué incluye esta carpeta

- `index.html` — la app completa (frontend), sin dependencias externas.
- `manifest.json` + `icons/` — nombre ("Brote") e ícono para la pantalla de inicio.
- `netlify/functions/diagnostico.mjs` — función serverless que llama a la API de Claude protegiendo tu clave. El prompt y el formato de la respuesta viven acá.
- `netlify.toml` — configuración de Netlify. No hay paso de build ni `npm install`.

## Qué hace

- **Hoy:** qué regar y abonar hoy, lo atrasado, y lo que viene en los próximos 7 días. "✓ Listo", "posponer" y "Deshacer".
- **Mis plantas:** foto, especie, ubicación, historial (riegos, abonos, trasplantes, podas, notas) y galería de fotos.
- **Diagnóstico con IA:** abrís una foto, tocás "🩺 Diagnosticar" y Claude responde con el estado (saludable, leve, moderado, grave), los problemas probables con su tratamiento y qué hacer ahora. Si conviene, propone una nueva frecuencia de riego o corregir la especie (se aplican con un toque) y te programa una **foto de control** para seguir la evolución.
- **Identificar la especie** al cargar una planta nueva con foto.
- **Guía** de 27 plantas comunes con luz, riego, abono y toxicidad para perros y gatos (según la ASPCA).
- **Estaciones:** el riego se ajusta solo (más seguido en verano, más espaciado en invierno, abono en pausa en invierno). Hemisferio sur por defecto.
- **Recordatorios** en Google Calendar / Calendario de Apple (archivo .ics) y **respaldo** en archivo, con fotos.

## Paso 1 — La clave de Claude

Podés usar la misma clave que Déficit Tracker (es la misma cuenta) o crear una nueva:

1. Entrá a https://platform.claude.com/settings/keys (con crédito cargado en **Billing**).
2. **Create Key** y copiala. No la pegues en el código de la app.

## Paso 2 — Publicar en Netlify

Brote vive en la carpeta `cuidado-plantas` del repo `herramientasEGG`, así que se publica como un proyecto aparte con esa carpeta como base:

1. En https://app.netlify.com → **Add new project → Import an existing project → GitHub** → elegí `herramientasEGG`.
2. **Branch to deploy:** `main` (una vez que se haga el merge) o `app-cuidado-plantas` para probarla ya.
3. **Base directory:** `cuidado-plantas`. El resto (carpeta a publicar y funciones) lo toma de `netlify.toml`; el comando de build queda vacío.
4. **Deploy.** Netlify te da una dirección tipo `https://algo.netlify.app` (la podés cambiar en Project configuration → Change project name, por ejemplo `brote-plantas`).

## Paso 3 — Guardar la clave en Netlify

1. **Project configuration → Environment variables → Add a variable**:
   - Key: `ANTHROPIC_API_KEY`
   - Value: la clave del Paso 1
2. **Deploys → Trigger deploy → Deploy project.** Sin este paso la función no ve la clave: Netlify toma las variables recién en el próximo deploy.
3. Probá un diagnóstico. Si dice "clave rechazada", la copiaste mal; si dice "sin crédito", falta saldo en la cuenta.

### Cerrar el endpoint (opcional, recomendado)

La función ya viene con dos defensas: el prompt vive en el servidor (no sirve para pedirle otra cosa a Claude) y solo acepta pedidos desde el mismo sitio. Para cerrarla del todo:

- Agregá la variable `APP_SHARED_TOKEN` con un texto largo inventado.
- Pegá el mismo texto en la constante `APP_TOKEN` de `index.html` y volvé a publicar.

## Paso 4 — Instalarla en el celular

- **iPhone:** abrí la dirección en Safari → botón Compartir → **Agregar a pantalla de inicio**. Aparece como "Brote", con su ícono, y abre en pantalla completa.
- **Android:** abrila en Chrome → menú ⋮ → **Instalar app** (o "Agregar a la pantalla principal").

En iPhone, la app instalada guarda sus datos aparte de Safari: si ya habías cargado plantas en Safari, exportá un respaldo (Ajustes) e importalo en la app.

## Costos

Cada diagnóstico es un pedido a Claude con la foto (achicada a 1568 px). Estimación, no medición (el número real está en platform.claude.com → Usage; la app también muestra el costo aproximado de cada diagnóstico):

| Modelo (se elige en Ajustes) | Costo aproximado por foto |
|---|---|
| Claude Opus 5.5 — el más preciso (por defecto) | USD 0,06 |
| Claude Sonnet 5.5 — equilibrado y más rápido | USD 0,03 |
| Claude Haiku 5.5 — el más económico | menos de USD 0,01 |

Riego, abono, fotos, guía, recordatorios y respaldos no usan la IA: son gratis.

## Datos

Las plantas, el historial y las fotos se guardan en el celular (localStorage y la base de fotos del navegador). No hay cuenta ni nube: para no perder nada si cambiás de celular, usá **Ajustes → Exportar respaldo** (incluye las fotos). Las fotos se envían a Claude solo cuando pedís un diagnóstico o una identificación.

La app necesita internet para abrir, como Déficit Tracker. Si abrís `index.html` directamente (sin Netlify) funciona todo menos la IA.
