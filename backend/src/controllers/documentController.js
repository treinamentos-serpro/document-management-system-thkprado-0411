const path = require('node:path');
const documentService = require('../services/documentService');

const storageDirectory = path.resolve(__dirname, '../../storage');

async function uploadDocument(req, res) {
  if (!req.file) {
    return res.status(400).json({
      error: { code: 'FILE_REQUIRED', message: 'Envie um arquivo no campo file.' },
    });
  }

  res.status(201).json({ data: await documentService.createDocument(req.file) });
}

function listDocuments(req, res) {
  res.json({ data: documentService.listDocuments() });
}

function downloadDocument(req, res, next) {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(req.params.id)) {
    return res.status(400).json({
      error: { code: 'INVALID_DOCUMENT_ID', message: 'O identificador do documento é inválido.' },
    });
  }

  const document = documentService.getDocument(req.params.id);
  if (!document) {
    return res.status(404).json({
      error: { code: 'DOCUMENT_NOT_FOUND', message: 'Documento não encontrado.' },
    });
  }

  const filePath = path.resolve(document.path);
  if (!filePath.startsWith(`${storageDirectory}${path.sep}`)) {
    return next(new Error('Caminho de armazenamento inválido.'));
  }

  res.set('X-Content-Type-Options', 'nosniff');
  res.download(filePath, document.originalName, (error) => {
    if (!error) {
      return;
    }

    if (!res.headersSent && error.code === 'ENOENT') {
      return res.status(404).json({
        error: { code: 'DOCUMENT_NOT_FOUND', message: 'Documento não encontrado.' },
      });
    }

    next(error);
  });
}

module.exports = { uploadDocument, listDocuments, downloadDocument };
