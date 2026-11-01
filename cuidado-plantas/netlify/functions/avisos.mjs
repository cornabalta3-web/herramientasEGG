// Función serverless de Netlify — avisos de Brote (Web Push).
// La app guarda acá su suscripción, la hora elegida y el plan de cuidados.
// La lógica está en ../lib/avisos.mjs.
import { getStore } from '@netlify/blobs';
import webpush from 'web-push';
import { crearManejadorAvisos, STORE_NAME } from '../lib/avisos.mjs';

export default crearManejadorAvisos({
  abrirAlmacen: () => getStore({ name: STORE_NAME, consistency: 'strong' }),
  webpush,
});
