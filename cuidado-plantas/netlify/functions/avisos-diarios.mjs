// Función programada de Netlify — corre sola cada hora (solo en el sitio
// publicado, no en las vistas previas) y manda a cada celular el aviso del
// día a la hora que eligió, si alguna planta necesita agua, abono o una foto.
// La lógica está en ../lib/avisos.mjs.
import { getStore } from '@netlify/blobs';
import webpush from 'web-push';
import { crearManejadorDiario, STORE_NAME } from '../lib/avisos.mjs';

export default crearManejadorDiario({
  abrirAlmacen: () => getStore({ name: STORE_NAME, consistency: 'strong' }),
  webpush,
});

export const config = { schedule: '@hourly' };
