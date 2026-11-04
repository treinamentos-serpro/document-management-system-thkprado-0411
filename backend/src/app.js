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
    if (error.code === 'LIMIT_FILE_SIZE') {
      return res.status(413).json({
        error: { code: 'FILE_TOO_LARGE', message: 'O arquivo excede o limite de 10 MB.' },
      });
    }

    return res.status(400).json({
      error: { code: 'UNEXPECTED_FILE', message: 'Envie apenas um arquivo no campo file.' },
    });
  }

  if (error.status === 400) {
    const code = req.path === '/upload' ? 'FILE_REQUIRED' : 'INVALID_REQUEST';
    return res.status(400).json({
      error: { code, message: 'Requisição inválida.' },
    });
  }

  console.error('Erro ao processar documento:', error);
  let code = 'INTERNAL_SERVER_ERROR';
  if (req.path === '/upload') {
    code = 'UPLOAD_FAILED';
  } else if (req.path === '/documents') {
    code = 'DOCUMENT_LIST_FAILED';
  } else if (/^\/documents\/[^/]+\/download$/.test(req.path)) {
    code = 'DOWNLOAD_FAILED';
  }
  res.status(500).json({
    error: { code, message: 'Não foi possível processar a solicitação.' },
  });
});

if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`DMS backend ouvindo na porta ${PORT}`);
  });
}

module.exports = app;
