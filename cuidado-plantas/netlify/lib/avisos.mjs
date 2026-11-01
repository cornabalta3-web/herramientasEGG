// Lógica de los avisos de Brote, compartida por dos funciones de Netlify:
//
//  - avisos.mjs: la app guarda acá su suscripción a avisos (Web Push), la hora
//    elegida y el plan de cuidados (qué planta necesita qué y qué día).
//  - avisos-diarios.mjs: corre sola cada hora y, a la hora que eligió cada
//    persona, le manda un aviso si alguna planta necesita algo.
//
// Todo se guarda en Netlify Blobs, que viene con el sitio. La clave de cada
// registro es el hash del identificador del celular, como en la nube de
// Déficit Tracker. Las claves VAPID (las que firman los avisos) se generan
// solas la primera vez y quedan guardadas: no hay que configurar nada.
//
// Las dependencias (el almacén y web-push) entran por parámetro para poder
// probar esta lógica sin Netlify.

import { createHash } from 'node:crypto';

export const STORE_NAME = 'brote-avisos';
const VAPID_KEY = 'config/vapid';
const SUB_PREFIX = 'sub/';
const TIPOS = ['riego', 'abono', 'revision'];
const MAX_PLAN = 300;
const ID_VALIDO = /^[A-Za-z0-9_-]{20,64}$/;
const ZONA_POR_DEFECTO = 'America/Argentina/Buenos_Aires';
// Si una corrida se atrasa, el aviso igual sale dentro de estas horas.
const VENTANA_HORAS = 3;

const json = (status, body) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
const error = (status, code, mensaje) => json(status, { error: mensaje, code });
const esFecha = (s) => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s);
export const claveDe = (id) => SUB_PREFIX + createHash('sha256').update(id).digest('hex');

export function validarSuscripcion(s) {
  if (!s || typeof s !== 'object') return null;
  const { endpoint, keys } = s;
  if (typeof endpoint !== 'string' || endpoint.length > 1000) return null;
  let url;
  try { url = new URL(endpoint); } catch { return null; }
  if (url.protocol !== 'https:') return null;
  if (!keys || typeof keys.p256dh !== 'string' || typeof keys.auth !== 'string'
    || !keys.p256dh || !keys.auth || keys.p256dh.length > 200 || keys.auth.length > 100) return null;
  return { endpoint, keys: { p256dh: keys.p256dh, auth: keys.auth } };
}

export function normalizarPlan(plan) {
  if (!Array.isArray(plan)) return [];
  return plan
    .filter((x) => x && typeof x === 'object' && TIPOS.includes(x.t) && esFecha(x.d) && typeof x.n === 'string' && x.n.trim())
    .slice(0, MAX_PLAN)
    .map((x) => ({ n: x.n.trim().slice(0, 60), t: x.t, d: x.d }));
}

export function zonaValida(tz) {
  if (typeof tz !== 'string' || !tz || tz.length > 60) return false;
  try { new Intl.DateTimeFormat('es-AR', { timeZone: tz }); return true; } catch { return false; }
}
const horaValida = (h) => Number.isInteger(h) && h >= 0 && h <= 23;

// Fecha y hora locales de una zona horaria (por ejemplo, America/Argentina/Cordoba).
export function horaLocal(tz, ahora) {
  const partes = Object.fromEntries(new Intl.DateTimeFormat('en-CA', {
    timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', hourCycle: 'h23',
  }).formatToParts(ahora).map((p) => [p.type, p.value]));
  return { fecha: `${partes.year}-${partes.month}-${partes.day}`, hora: Number(partes.hour) };
}

export const pendientes = (plan, hoy) => plan.filter((x) => x.d <= hoy);
const nombres = (items) => {
  const n = [...new Set(items.map((x) => x.n))];
  return n.length <= 2 ? n.join(' y ') : `${n.slice(0, 2).join(', ')} y ${n.length - 2} más`;
};
const diasEntre = (a, b) => Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86400000);

// Arma el texto del aviso del día con todo lo que está pendiente.
export function armarMensaje(items, hoy) {
  const riego = items.filter((x) => x.t === 'riego');
  const abono = items.filter((x) => x.t === 'abono');
  const revision = items.filter((x) => x.t === 'revision');
  const extra = [];
  if (abono.length) extra.push(`abono para ${nombres(abono)}`);
  if (revision.length) extra.push(`foto de control de ${nombres(revision)}`);
  let title;
  let body;
  if (riego.length === 1) {
    const atraso = diasEntre(riego[0].d, hoy);
    title = `💧 ${riego[0].n} tiene sed`;
    body = atraso > 0
      ? `Le tocaba agua hace ${atraso} ${atraso === 1 ? 'día' : 'días'}. Tocá la tierra y, si está seca, regá.`
      : 'Hoy le toca agua. Antes de regar, tocá la tierra.';
  } else if (riego.length > 1) {
    title = `💧 ${riego.length} plantas tienen sed`;
    body = `${nombres(riego)}. Antes de regar, tocá la tierra.`;
  } else if (abono.length) {
    title = '🧪 Hoy toca abonar';
    body = `${nombres(abono)} ${new Set(abono.map((x) => x.n)).size === 1 ? 'necesita' : 'necesitan'} sus vitaminas.`;
    extra.shift();
  } else {
    title = '📷 Foto de control';
    body = `Sacale una foto a ${nombres(revision)} para ver cómo sigue.`;
    extra.length = 0;
  }
  if (extra.length) body += ` También: ${extra.join('; ')}.`;
  return { title, body, tag: 'brote-diario', url: './#hoy' };
}

export async function clavesVapid(store, webpush) {
  let claves = await store.get(VAPID_KEY, { type: 'json' });
  if (!claves || !claves.publicKey || !claves.privateKey) {
    claves = webpush.generateVAPIDKeys();
    await store.setJSON(VAPID_KEY, claves);
  }
  return claves;
}
// Los servicios de avisos piden un contacto (una dirección https o un mailto).
const sujeto = (rec) => (typeof rec.sitio === 'string' && rec.sitio.startsWith('https://') ? rec.sitio : 'mailto:avisos@brote.invalid');
const vapid = (rec, claves) => ({ subject: sujeto(rec), publicKey: claves.publicKey, privateKey: claves.privateKey });

// Mismo criterio que diagnostico.mjs: solo pedidos del mismo sitio.
function origenPermitido(req) {
  const origin = req.headers.get('origin');
  if (!origin) return true;
  let originHost;
  try { originHost = new URL(origin).host; } catch { return false; }
  let host = req.headers.get('host');
  try { host = host || new URL(req.url).host; } catch { /* sin host */ }
  if (host && originHost === host) return true;
  const extra = (process.env.ALLOWED_ORIGINS || '').split(',').map((x) => x.trim()).filter(Boolean);
  return extra.some((o) => { try { return new URL(o).host === originHost; } catch { return false; } });
}
function sitioDe(req) {
  try { const u = new URL(req.url); return u.protocol === 'https:' ? `https://${u.host}` : null; } catch { return null; }
}

// Función avisos: { accion: 'clave' | 'guardar' | 'plan' | 'probar' | 'borrar', id, ... }
export function crearManejadorAvisos({ abrirAlmacen, webpush }) {
  return async function avisos(req) {
    if (req.method !== 'POST') return error(405, 'metodo_no_permitido', 'Método no permitido.');
    if (!origenPermitido(req)) return error(403, 'origen_no_permitido', 'Origen no autorizado.');
    const token = process.env.APP_SHARED_TOKEN;
    if (token && req.headers.get('x-app-token') !== token) return error(403, 'token_invalido', 'Token de aplicación inválido.');
    let p;
    try { p = await req.json(); } catch { return error(400, 'body_invalido', 'El pedido no es JSON válido.'); }
    if (!p || typeof p !== 'object') return error(400, 'body_invalido', 'El pedido no es JSON válido.');

    let store;
    try { store = abrirAlmacen(); } catch { return error(500, 'sin_almacen', 'No se pudo abrir el almacenamiento de Netlify.'); }
    try {
      if (p.accion === 'clave') {
        const claves = await clavesVapid(store, webpush);
        return json(200, { publicKey: claves.publicKey });
      }
      if (typeof p.id !== 'string' || !ID_VALIDO.test(p.id)) return error(400, 'id_invalido', 'Identificador inválido.');
      const clave = claveDe(p.id);

      if (p.accion === 'guardar') {
        const subscription = validarSuscripcion(p.subscription);
        if (!subscription) return error(400, 'suscripcion_invalida', 'La suscripción a avisos llegó incompleta.');
        if (!zonaValida(p.tz)) return error(400, 'zona_invalida', 'Zona horaria inválida.');
        if (!horaValida(p.hora)) return error(400, 'hora_invalida', 'Hora inválida.');
        const previo = await store.get(clave, { type: 'json' });
        const mismo = previo && previo.subscription && previo.subscription.endpoint === subscription.endpoint;
        await store.setJSON(clave, {
          subscription, plan: normalizarPlan(p.plan), hora: p.hora, tz: p.tz, sitio: sitioDe(req),
          enviado: mismo ? previo.enviado || null : null, actualizado: new Date().toISOString(),
        });
        return json(200, { ok: true });
      }

      const rec = await store.get(clave, { type: 'json' });
      if (p.accion === 'plan') {
        if (!rec) return error(404, 'sin_suscripcion', 'Los avisos no están activados en este celular.');
        rec.plan = normalizarPlan(p.plan);
        if (horaValida(p.hora)) rec.hora = p.hora;
        if (zonaValida(p.tz)) rec.tz = p.tz;
        rec.actualizado = new Date().toISOString();
        await store.setJSON(clave, rec);
        return json(200, { ok: true });
      }
      if (p.accion === 'probar') {
        if (!rec) return error(404, 'sin_suscripcion', 'Los avisos no están activados en este celular.');
        const claves = await clavesVapid(store, webpush);
        const aviso = { title: '🌱 ¡Los avisos funcionan!', body: `Te vamos a avisar a las ${rec.hora} h cuando alguna planta necesite algo.`, tag: 'brote-prueba', url: './#hoy' };
        try {
          await webpush.sendNotification(rec.subscription, JSON.stringify(aviso), { vapidDetails: vapid(rec, claves), TTL: 600, urgency: 'high' });
        } catch (e) {
          if (e && (e.statusCode === 404 || e.statusCode === 410)) {
            await store.delete(clave);
            return error(410, 'suscripcion_vencida', 'El celular dio de baja los avisos. Activalos de nuevo.');
          }
          return error(502, 'no_envio', 'No se pudo mandar el aviso de prueba. Probá de nuevo en un rato.');
        }
        return json(200, { ok: true });
      }
      if (p.accion === 'borrar') {
        await store.delete(clave);
        return json(200, { ok: true });
      }
      return error(400, 'accion_invalida', 'Acción desconocida.');
    } catch {
      return error(502, 'error_almacen', 'No se pudo guardar la configuración de los avisos. Probá de nuevo.');
    }
  };
}

// Función programada: revisa cada registro y manda el aviso del día.
export function crearManejadorDiario({ abrirAlmacen, webpush, ahora = () => new Date() }) {
  return async function avisosDiarios() {
    let store;
    let claves;
    let blobs;
    try {
      store = abrirAlmacen();
      claves = await store.get(VAPID_KEY, { type: 'json' });
      if (!claves) return json(200, { enviados: 0, motivo: 'sin_claves' });
      ({ blobs } = await store.list({ prefix: SUB_PREFIX }));
    } catch (e) {
      console.error('avisos-diarios: no se pudo leer el almacenamiento', e);
      return error(500, 'error_almacen', 'No se pudo leer el almacenamiento.');
    }
    const res = { enviados: 0, borrados: 0, fallidos: 0 };
    for (const { key } of blobs) {
      let rec;
      try { rec = await store.get(key, { type: 'json' }); } catch { res.fallidos++; continue; }
      if (!rec || !rec.subscription || !horaValida(rec.hora)) continue;
      const { fecha, hora } = horaLocal(zonaValida(rec.tz) ? rec.tz : ZONA_POR_DEFECTO, ahora());
      if (rec.enviado === fecha || hora < rec.hora || hora > rec.hora + VENTANA_HORAS) continue;
      const items = pendientes(rec.plan || [], fecha);
      if (!items.length) continue;
      try {
        await webpush.sendNotification(rec.subscription, JSON.stringify(armarMensaje(items, fecha)),
          { vapidDetails: vapid(rec, claves), TTL: 6 * 3600, urgency: 'normal', topic: 'brote-diario' });
        rec.enviado = fecha;
        await store.setJSON(key, rec);
        res.enviados++;
      } catch (e) {
        // 404/410: el celular dio de baja la suscripción, así que se borra.
        if (e && (e.statusCode === 404 || e.statusCode === 410)) {
          try { await store.delete(key); res.borrados++; } catch { res.fallidos++; }
        } else res.fallidos++;
      }
    }
    if (res.fallidos) console.warn('avisos-diarios:', res);
    return json(200, res);
  };
}
