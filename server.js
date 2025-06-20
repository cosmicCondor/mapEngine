// server.js
const express = require('express');
const cors = require('cors');
const app = express();

app.use(cors({
  origin: ['http://localhost:*', 'http://192.168.*.*'] // Ajusta según tu red
}));

// Resto de configuración del servidor...
app.listen(3000, '0.0.0.0', () => {
  console.log('Servidor escuchando en http://:3000');
});

