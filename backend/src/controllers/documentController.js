const documentService = require('../services/documentService');

function uploadDocument(req, res) {
  if (!req.file) {
    return res.status(400).json({ error: 'Envie um arquivo no campo file.' });
  }

  res.status(201).json(documentService.createDocument(req.file));
}

function listDocuments(req, res) {
  res.json(documentService.listDocuments());
}

function downloadDocument(req, res, next) {
  const document = documentService.getDocument(req.params.id);
  if (!document) {
    return res.status(404).json({ error: 'Documento não encontrado.' });
  }

  res.download(document.path, document.originalName, (error) => {
    if (!error) {
      return;
    }

    if (!res.headersSent && error.code === 'ENOENT') {
      return res.status(404).json({ error: 'Arquivo do documento não encontrado.' });
    }

    next(error);
  });
}

module.exports = { uploadDocument, listDocuments, downloadDocument };
