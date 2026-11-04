const express = require('express');
const multer = require('multer');
const documentRoutes = require('./routes/documentRoutes');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

app.use(documentRoutes);

app.use((error, req, res, next) => {
  if (res.headersSent) {
    return next(error);
  }

  if (error instanceof multer.MulterError) {
    return res.status(400).json({ error: 'Envie apenas um arquivo no campo file.' });
  }

  if (error.status === 400) {
    return res.status(400).json({ error: 'Requisição inválida.' });
  }

  console.error('Erro ao processar documento:', error);
  res.status(500).json({ error: 'Não foi possível processar a solicitação.' });
});

if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`DMS backend ouvindo na porta ${PORT}`);
  });
}

module.exports = app;
