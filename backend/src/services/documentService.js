const { randomUUID } = require('node:crypto');
const documentRepository = require('../repositories/documentRepository');
const documentStorageService = require('./documentStorageService');

function toMetadata(document) {
  const { path, ...metadata } = document;
  return metadata;
}

function getCurrentOwner() {
  return process.env.DMS_DEFAULT_OWNER || 'demo-user';
}

async function createDocument(file) {
  try {
    const document = documentRepository.save({
      id: randomUUID(),
      originalName: file.originalname,
      size: file.size,
      uploadedAt: new Date().toISOString(),
      owner: getCurrentOwner(),
      path: file.path,
    });

    return toMetadata(document);
  } catch (error) {
    try {
      await documentStorageService.removeUploadedFile(file.path);
    } catch (cleanupError) {
      throw new AggregateError(
        [error, cleanupError],
        'Não foi possível registrar o documento nem remover o arquivo enviado.',
        { cause: error },
      );
    }
    throw error;
  }
}

function listDocuments() {
  return documentRepository.findAll()
    .filter((document) => document.owner === getCurrentOwner())
    .sort((first, second) => (
      second.uploadedAt.localeCompare(first.uploadedAt) || first.id.localeCompare(second.id)
    ))
    .map(toMetadata);
}

function getDocument(id) {
  const document = documentRepository.findById(id);
  return document?.owner === getCurrentOwner()
    ? document
    : undefined;
}

module.exports = { createDocument, listDocuments, getDocument };
