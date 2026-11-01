// Función serverless de Netlify — Brote (cuidado de plantas).
//
// Recibe { photo: { mediaType, data }, contexto, modelo? } desde la app, arma el
// pedido a la API de Claude con la clave guardada como variable de entorno
// (ANTHROPIC_API_KEY) y devuelve el diagnóstico ya parseado:
//   { resultado, modelo, uso: { input_tokens, output_tokens } }
//
// Mismo diseño que la función `analyze` de Déficit Tracker:
//
// 1. El prompt y el esquema viven ACÁ, no en la app. El cliente solo manda la
//    foto y los datos de la planta (que acá se validan y recortan), así el
//    endpoint no sirve como API de Claude de uso libre facturada a tu cuenta.
// 2. Salida estructurada (output_config.format): la API garantiza un JSON con
//    la forma del esquema, sin parseo frágil.
// 3. fetch nativo, sin dependencias: no hace falta `npm install` para publicar.
// 4. Chequeo de origen (mismo sitio) y token opcional APP_SHARED_TOKEN.
//
// Usa el formato actual de funciones de Netlify (export default con
// Request/Response). Las funciones síncronas tienen 60 segundos para responder:
// un diagnóstico con Claude Opus 5.5 suele tardar bastante menos.

const API_URL = "https://api.anthropic.com/v1/messages";
const API_VERSION = "2026-10-21";
const MODELO_POR_DEFECTO = "claude-opus-5-5";

// La app deja elegir el modelo en Ajustes; cualquier otro valor usa el de por
// defecto. `fallback`: si los filtros de seguridad de Claude rechazan la
// consulta, la API la reintenta sola con el modelo que recomienda Anthropic
// (Haiku 5.5 no tiene esa opción).
const MODELOS = {
  "claude-opus-5-5": { fallback: true },
  "claude-sonnet-5-5": { fallback: true },
  "claude-haiku-5-5": { fallback: false },
};

// Techo de generación, no un costo: solo se paga lo que se genera. Tiene que
// ser holgado porque el modelo razona antes de responder.
const MAX_TOKENS = 16000;

// Límites de entrada: cortan abuso y errores obvios antes de gastar un token.
// La app manda la foto achicada a 1568 px (unos 300-500 KB).
const MAX_FOTO_BYTES = 5 * 1024 * 1024;
const TIPOS_FOTO = ["image/jpeg", "image/png", "image/webp"];

// Catálogo de especies de la app: [id, nombre común, nombre científico].
// Si sumás una especie en SPECIES (index.html), sumala también acá.
const CATALOGO = [
  ["potus", "Potus", "Epipremnum aureum"],
  ["monstera", "Costilla de Adán", "Monstera deliciosa"],
  ["sansevieria", "Lengua de suegra", "Dracaena trifasciata (Sansevieria)"],
  ["zamioculca", "Zamioculca", "Zamioculcas zamiifolia"],
  ["cinta", "Cinta", "Chlorophytum comosum"],
  ["espatifilo", "Espatifilo", "Spathiphyllum wallisii"],
  ["calathea", "Calathea", "Goeppertia spp. (Calathea)"],
  ["aloe", "Aloe vera", "Aloe vera"],
  ["ficus-lyrata", "Ficus lira", "Ficus lyrata"],
  ["gomero", "Gomero", "Ficus elastica"],
  ["helecho", "Helecho serrucho", "Nephrolepis exaltata"],
  ["areca", "Palmera areca", "Dypsis lutescens"],
  ["orquidea", "Orquídea mariposa", "Phalaenopsis spp."],
  ["peperomia", "Peperomia", "Peperomia spp."],
  ["pilea", "Pilea", "Pilea peperomioides"],
  ["filodendro", "Filodendro", "Philodendron spp."],
  ["hoya", "Flor de cera", "Hoya carnosa"],
  ["dracena", "Palo de agua", "Dracaena fragrans"],
  ["jade", "Árbol de jade", "Crassula ovata"],
  ["echeveria", "Echeveria", "Echeveria spp."],
  ["cactus", "Cactus", "Cactaceae (varias especies)"],
  ["albahaca", "Albahaca", "Ocimum basilicum"],
  ["romero", "Romero", "Salvia rosmarinus"],
  ["menta", "Menta", "Mentha spp."],
  ["tomate", "Tomate", "Solanum lycopersicum"],
  ["lavanda", "Lavanda", "Lavandula spp."],
  ["malvon", "Malvón", "Pelargonium spp."],
  ["otra", "Otra planta", "Especie no listada"],
];
export const IDS_CATALOGO = CATALOGO.map(([id]) => id);

const NIVELES = ["alta", "media", "baja"];
const ESTADOS = ["saludable", "leve", "moderado", "grave", "no_evaluable"];

const SYSTEM_PROMPT = `Sos especialista en sanidad vegetal y en el cultivo de plantas de interior, huerta y jardín. Analizás fotos que una persona saca con su celular para ayudarla a cuidar sus plantas. Escribí en español rioplatense (voseo), con lenguaje simple, concreto y amable.

La persona no sabe de plantas: usá palabras de todos los días ("tierra", no "sustrato"; "la parte de abajo de las hojas", no "envés"; "gajo", no "esqueje"). Si un término técnico es inevitable, explicalo entre paréntesis. Los pasos tienen que ser muy concretos: cuánto, cada cuánto y, si hace falta un producto, que se consigue en viveros.

Cómo trabajar:
- Basate en lo que realmente se ve en la foto y en el contexto que te pasan (especie cargada, riego, ubicación, estación, historial y comentarios). No inventes síntomas que no se ven.
- Priorizá las causas más comunes antes que las raras: exceso o falta de riego, mal drenaje, poca luz o demasiado sol directo, aire seco, frío, falta o exceso de fertilizante, y plagas frecuentes (cochinilla, pulgón, araña roja, trips, mosca blanca, mosquita del sustrato) u hongos.
- Cruzá lo que ves con el contexto. Por ejemplo, hojas amarillas y blandas en una planta que se riega muy seguido sugieren exceso de riego.
- Sé honesto con la incertidumbre. Si la foto no alcanza, decí qué foto conviene sacar (hojas de cerca, el envés, el tallo, el sustrato o la planta entera).
- Recomendá primero soluciones caseras y seguras: ajustar el riego y la luz, aislar la planta, limpiar las hojas, cortar partes dañadas, jabón potásico o aceite de neem. Si sugerís un producto, aclará que se use según la etiqueta y lejos de niños y mascotas.

Campos de la respuesta:
- es_planta: false si la foto no muestra una planta.
- calidad_foto: qué tan útil es la foto para diagnosticar.
- especie: lo que ves en la foto. En catalogo_id usá el id de la lista de abajo si coincide; si no, "otra". En confianza, qué tan seguro estás de la identificación.
- estado: "saludable" (sin problemas relevantes), "leve", "moderado", "grave" o "no_evaluable" (no es una planta o la foto no permite evaluarla).
- resumen: una o dos oraciones con la conclusión principal.
- observaciones: lo que se ve en la foto, en hasta 5 frases cortas.
- problemas: los problemas probables, del más al menos probable (lista vacía si está saludable). En tratamiento, pasos concretos.
- acciones_inmediatas: lo más importante para hacer ahora, en orden (hasta 4).
- riego_sugerido_dias: la nueva frecuencia de riego en días solo si recomendás cambiar la actual; si no, null.
- revisar_en_dias: en cuántos días conviene sacar otra foto para controlar la evolución (entre 3 y 30; si está saludable, 30).
- consultar_experto: true si es grave, si puede contagiar a otras plantas o si conviene llevar una muestra a un vivero.

Especies del catálogo de la app (id = nombre común, nombre científico):
${CATALOGO.map(([id, nombre, sci]) => `${id} = ${nombre}, ${sci}`).join("\n")}`;

// Formato fijo de la respuesta: la API ya no puede contestar con otra forma.
export const ESQUEMA = {
  type: "object",
  additionalProperties: false,
  required: ["es_planta", "calidad_foto", "especie", "estado", "resumen", "observaciones", "problemas",
    "acciones_inmediatas", "riego_sugerido_dias", "revisar_en_dias", "consultar_experto"],
  properties: {
    es_planta: { type: "boolean" },
    calidad_foto: { type: "string", enum: ["buena", "aceptable", "mala"] },
    especie: {
      type: "object",
      additionalProperties: false,
      required: ["nombre_comun", "nombre_cientifico", "catalogo_id", "confianza"],
      properties: {
        nombre_comun: { type: "string" },
        nombre_cientifico: { type: "string" },
        catalogo_id: { type: "string", enum: IDS_CATALOGO },
        confianza: { type: "string", enum: NIVELES },
      },
    },
    estado: { type: "string", enum: ESTADOS },
    resumen: { type: "string" },
    observaciones: { type: "array", items: { type: "string" } },
    problemas: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["nombre", "probabilidad", "senales", "causa", "tratamiento"],
        properties: {
          nombre: { type: "string" },
          probabilidad: { type: "string", enum: NIVELES },
          senales: { type: "string" },
          causa: { type: "string" },
          tratamiento: { type: "array", items: { type: "string" } },
        },
      },
    },
    acciones_inmediatas: { type: "array", items: { type: "string" } },
    riego_sugerido_dias: { anyOf: [{ type: "integer" }, { type: "null" }] },
    revisar_en_dias: { type: "integer" },
    consultar_experto: { type: "boolean" },
  },
};

// Arma el texto del pedido con los datos de la planta que manda la app,
// validados y recortados: el cliente nunca manda texto libre largo.
export function textoContexto(c) {
  c = c && typeof c === "object" ? c : {};
  const s = (v, max) => (typeof v === "string" ? v.replace(/\s+/g, " ").trim().slice(0, max) : "");
  const n = (v, min, max) => {
    const x = Number(v);
    return v !== null && v !== "" && Number.isFinite(x) ? Math.round(Math.min(max, Math.max(min, x))) : null;
  };
  const fecha = (v) => (typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : null);
  const L = [];
  if (c.planta_nueva === true) {
    L.push("Es una planta nueva que la persona todavía no cargó en la app: identificá la especie con cuidado.");
  } else {
    L.push(`Planta: "${s(c.nombre, 60) || "sin nombre"}"`);
    L.push(`Especie cargada en la app: ${s(c.especie, 120) || "no especificada"}`);
    const ubicacion = s(c.ubicacion, 40);
    if (ubicacion) L.push(`Ubicación: ${ubicacion}`);
    const cada = n(c.riego_cada_dias, 1, 365);
    const ultimo = fecha(c.ultimo_riego);
    const hace = n(c.dias_desde_riego, 0, 3650);
    if (cada) L.push(`Riego programado: cada ${cada} días. Último riego registrado: ${ultimo ? `${ultimo}${hace != null ? ` (hace ${hace} días)` : ""}` : "sin dato"}.`);
    const abono = n(c.abono_cada_dias, 0, 365);
    L.push(`Abono: ${abono ? `cada ${abono} días; último: ${fecha(c.ultimo_abono) || "sin dato"}` : "sin abono programado"}.`);
    const historial = (Array.isArray(c.historial) ? c.historial : [])
      .filter((x) => typeof x === "string").slice(-10).map((x) => `- ${s(x, 200)}`).filter((x) => x.length > 2);
    if (historial.length) L.push("Historial reciente:\n" + historial.join("\n"));
    const notas = s(c.notas, 600);
    if (notas) L.push(`Notas de la persona sobre la planta: ${notas}`);
  }
  const hoy = fecha(c.hoy);
  const estacion = ["primavera", "verano", "otoño", "invierno"].includes(c.estacion) ? c.estacion : null;
  if (hoy) L.push(`Hoy es ${hoy}.${estacion ? ` Estación: ${estacion} (hemisferio ${c.hemisferio === "norte" ? "norte" : "sur"}).` : ""}`);
  const nota = s(c.nota, 400);
  if (nota) L.push(`Lo que notó la persona: ${nota}`);
  L.push("Analizá la foto y devolvé el diagnóstico.");
  return L.join("\n");
}

const responder = (status, body) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

// `code` viaja a la app para poder distinguir los casos; `error` es el mensaje
// que se le muestra a la persona.
const error = (status, code, mensaje) => responder(status, { error: mensaje, code });

// Solo aceptamos pedidos que vengan del mismo sitio donde está publicada la app
// (cualquier dirección de Netlify: producción, previews o dominio propio).
// No frena a alguien decidido (curl no manda Origin), pero corta el abuso
// casual; el cierre real es APP_SHARED_TOKEN.
function origenPermitido(req) {
  const origin = req.headers.get("origin");
  if (!origin) return true; // pedidos same-origin que no mandan Origin
  let originHost;
  try { originHost = new URL(origin).host; } catch { return false; }
  let host = req.headers.get("host");
  try { host = host || new URL(req.url).host; } catch { /* sin host */ }
  if (host && originHost === host) return true;
  const extra = (process.env.ALLOWED_ORIGINS || "").split(",").map((x) => x.trim()).filter(Boolean);
  return extra.some((o) => { try { return new URL(o).host === originHost; } catch { return false; } });
}

export default async function handler(req) {
  if (req.method !== "POST") return error(405, "metodo_no_permitido", "Método no permitido.");
  if (!origenPermitido(req)) return error(403, "origen_no_permitido", "Origen no autorizado.");

  // Si configurás APP_SHARED_TOKEN en Netlify, la app tiene que mandarlo
  // (constante APP_TOKEN en index.html).
  const tokenEsperado = process.env.APP_SHARED_TOKEN;
  if (tokenEsperado && req.headers.get("x-app-token") !== tokenEsperado) {
    return error(403, "token_invalido", "Token de aplicación inválido.");
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return error(500, "sin_clave", "Falta configurar ANTHROPIC_API_KEY en Netlify (Project configuration → Environment variables).");
  }

  let payload;
  try { payload = await req.json(); } catch { return error(400, "body_invalido", "El pedido no es JSON válido."); }
  if (!payload || typeof payload !== "object") return error(400, "body_invalido", "El pedido no es JSON válido.");

  const foto = payload.photo;
  if (!foto || typeof foto.data !== "string" || !foto.data) return error(400, "sin_foto", "Falta la foto.");
  if (!TIPOS_FOTO.includes(foto.mediaType)) {
    return error(415, "formato_no_soportado", "Ese formato de imagen no se puede analizar. Sacá la foto en JPG o PNG.");
  }
  if (foto.data.length * 0.75 > MAX_FOTO_BYTES) return error(413, "foto_muy_grande", "La foto es demasiado grande.");
  if (!/^[A-Za-z0-9+/=]+$/.test(foto.data)) return error(400, "foto_invalida", "La foto llegó dañada.");

  const modelo = Object.prototype.hasOwnProperty.call(MODELOS, payload.modelo) ? payload.modelo : MODELO_POR_DEFECTO;
  const body = {
    model: modelo,
    max_tokens: MAX_TOKENS,
    system: SYSTEM_PROMPT,
    messages: [{
      role: "user",
      content: [
        // La imagen va antes del texto: así Claude la aprovecha mejor.
        { type: "image", source: { type: "base64", media_type: foto.mediaType, data: foto.data } },
        { type: "text", text: textoContexto(payload.contexto) },
      ],
    }],
    output_config: { effort: "medium", format: { type: "json_schema", schema: ESQUEMA } },
  };
  const headers = {
    "Content-Type": "application/json",
    "x-api-key": apiKey,
    "anthropic-version": API_VERSION,
  };
  if (MODELOS[modelo].fallback) {
    body.fallbacks = "default";
    headers["anthropic-beta"] = "server-side-fallback-2026-07-01";
  }

  let respuesta;
  try {
    respuesta = await fetch(API_URL, { method: "POST", headers, body: JSON.stringify(body) });
  } catch {
    return error(502, "sin_conexion", "No se pudo contactar a Claude. Probá de nuevo en un rato.");
  }

  let data;
  try { data = await respuesta.json(); } catch {
    return error(502, "respuesta_ilegible", "Claude devolvió una respuesta ilegible. Probá de nuevo.");
  }

  if (!respuesta.ok) {
    const detalle = data && data.error && data.error.message ? data.error.message : "Error desconocido";
    if (/credit balance|billing/i.test(detalle)) {
      return error(502, "sin_credito", "La cuenta de Claude no tiene crédito. Cargalo en platform.claude.com.");
    }
    if (respuesta.status === 401 || respuesta.status === 403) {
      return error(502, "clave_rechazada", "La clave de Claude fue rechazada. Revisá ANTHROPIC_API_KEY en Netlify.");
    }
    if (respuesta.status === 404) {
      return error(502, "modelo_no_disponible", "El modelo elegido no está disponible para tu cuenta. Probá con otro en Ajustes.");
    }
    if (respuesta.status === 429) {
      return error(429, "limite_alcanzado", "Se alcanzó el límite de pedidos. Probá de nuevo en un minuto.");
    }
    if (respuesta.status === 529 || respuesta.status >= 500) {
      return error(503, "saturado", "Los servidores de Claude están saturados. Probá de nuevo en unos minutos.");
    }
    return error(502, "error_api", detalle);
  }

  // Los filtros de seguridad pueden declinar un pedido devolviendo 200: hay
  // que mirar stop_reason antes de leer el contenido.
  if (data.stop_reason === "refusal") {
    return error(422, "rechazado", "Claude no pudo analizar esta foto (la consulta fue bloqueada por sus filtros de seguridad). Probá con otra foto.");
  }
  if (data.stop_reason === "max_tokens") {
    return error(502, "respuesta_cortada", "El diagnóstico quedó incompleto. Probá de nuevo.");
  }

  // Con el razonamiento activo la respuesta trae también bloques de thinking:
  // hay que quedarse con el bloque de texto, no asumir que es el primero.
  const bloque = (data.content || []).find((b) => b.type === "text");
  if (!bloque) return error(502, "sin_resultado", "El diagnóstico volvió vacío. Probá de nuevo.");
  let resultado;
  try { resultado = JSON.parse(bloque.text); } catch {
    return error(502, "json_invalido", "El diagnóstico volvió con un formato inesperado. Probá de nuevo.");
  }

  const uso = data.usage || {};
  return responder(200, {
    resultado,
    modelo: data.model || modelo,
    uso: { input_tokens: uso.input_tokens || 0, output_tokens: uso.output_tokens || 0 },
  });
}
