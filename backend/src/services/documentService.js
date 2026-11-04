const { randomUUID } = require('node:crypto');
const documentRepository = require('../repositories/documentRepository');

function toMetadata(document) {
  const { path, ...metadata } = document;
  return metadata;
}

function createDocument(file) {
  const document = documentRepository.save({
    id: randomUUID(),
    originalName: file.originalname,
    size: file.size,
    createdAt: new Date().toISOString(),
    owner: 'anonymous',
    path: file.path,
  });

  return toMetadata(document);
}

function listDocuments() {
  return documentRepository.findAll().map(toMetadata);
}

function getDocument(id) {
  return documentRepository.findById(id);
}

module.exports = { createDocument, listDocuments, getDocument };
