const express = require('express');
const axios = require('axios');
const app = express();
app.use(express.json());

// ==== Variables de entorno (configurar en Render → Environment) ====
const VERIFY_TOKEN = process.env.VERIFY_TOKEN || "mi_token_secreto_123";
const PAGE_ACCESS_TOKEN = process.env.PAGE_ACCESS_TOKEN;   // token de la página, para leer el lead
const WHATSAPP_TOKEN = process.env.WHATSAPP_TOKEN;         // token del sistema/business para enviar WhatsApp
const PHONE_NUMBER_ID = process.env.PHONE_NUMBER_ID;       // ID del número de WhatsApp Business
const TEMPLATE_NAME = process.env.TEMPLATE_NAME || "aviso_nuevo_lead"; // nombre del template aprobado
const NOTIFICATION_PHONE = process.env.NOTIFICATION_PHONE || "5491130798961"; // número fijo que recibe el aviso (Yesica)
const GRAPH_VERSION = "v26.0";

// === 1. Verificación del webhook (GET) ===
app.get('/webhook', (req, res) => {
  if (req.query['hub.mode'] && req.query['hub.verify_token'] === VERIFY_TOKEN) {
    res.status(200).send(req.query['hub.challenge']);
  } else {
    res.sendStatus(403);
  }
});

// === 2. Recepción de eventos (POST) ===
app.post('/webhook', async (req, res) => {
  res.status(200).send('EVENT_RECEIVED'); // responder rápido a Meta, siempre

  try {
    const entry = req.body.entry?.[0];
    const change = entry?.changes?.[0];
    const leadgenId = change?.value?.leadgen_id;

    if (!leadgenId) {
      console.log('Evento recibido sin leadgen_id, se ignora:', JSON.stringify(req.body));
      return;
    }

    console.log('Nuevo lead recibido, leadgen_id:', leadgenId);

    // === 2a. Pedir los datos del lead a la Graph API ===
    const leadResp = await axios.get(
      `https://graph.facebook.com/${GRAPH_VERSION}/${leadgenId}`,
      { params: { fields: 'field_data', access_token: PAGE_ACCESS_TOKEN } }
    );

    const fieldData = leadResp.data.field_data || [];
    const getField = (name) =>
      fieldData.find(f => f.name.toLowerCase() === name.toLowerCase())?.values?.[0] || '';

    // Ajustar estos nombres a como se llaman los campos reales en tu formulario
    // (podés verlos con el GET de arriba en Graph API Explorer)
    const nombre = getField('nombre_y_apellidos') || getField('full_name') || 'Sin nombre';
    const telefono = getField('número_de_teléfono') || getField('phone_number') || 'Sin teléfono';
    const email = getField('correo_electrónico') || getField('email') || 'Sin email';

    // Hora del lead en formato Argentina (hh:mm)
    const hora = new Date().toLocaleTimeString('es-AR', {
      timeZone: 'America/Argentina/Buenos_Aires',
      hour: '2-digit',
      minute: '2-digit'
    });

    // === 2b. Enviar el AVISO INTERNO por WhatsApp a Yesica (no al lead) ===
    await axios.post(
      `https://graph.facebook.com/${GRAPH_VERSION}/${PHONE_NUMBER_ID}/messages`,
      {
        messaging_product: 'whatsapp',
        to: NOTIFICATION_PHONE,
        type: 'template',
        template: {
          name: TEMPLATE_NAME,
          language: { code: 'es_AR' },
          components: [
            {
              type: 'body',
              parameters: [
                { type: 'text', text: hora },
                { type: 'text', text: nombre },
                { type: 'text', text: telefono },
                { type: 'text', text: email }
              ]
            }
          ]
        }
      },
      { headers: { Authorization: `Bearer ${WHATSAPP_TOKEN}` } }
    );

    console.log(`Aviso enviado a Yesica sobre el lead: ${nombre} (${telefono})`);
  } catch (err) {
    console.error('Error procesando el lead:', err.response?.data || err.message);
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Servidor activo en el puerto ${PORT}`));
