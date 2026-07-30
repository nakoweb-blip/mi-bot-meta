const express = require('express');
const app = express();
app.use(express.json());

const VERIFY_TOKEN = "mi_token_secreto_123";

app.get('/webhook', (req, res) => {
  if (req.query['hub.mode'] && req.query['hub.verify_token'] === VERIFY_TOKEN) {
    res.status(200).send(req.query['hub.challenge']);
  } else {
    res.sendStatus(403);
  }
});

app.post('/webhook', (req, res) => {
  res.status(200).send('EVENT_RECEIVED');
  console.log('¡Nuevo evento recibido de Meta!', JSON.stringify(req.body, null, 2));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Servidor activo en el puerto ${PORT}`));
