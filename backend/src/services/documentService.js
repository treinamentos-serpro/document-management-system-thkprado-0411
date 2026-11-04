const { randomUUID } = require('node:crypto');
const { unlink } = require('node:fs/promises');
const documentRepository = require('../repositories/documentRepository');

function toMetadata(document) {
  const { path, ...metadata } = document;
  return metadata;
}

async function createDocument(file) {
  try {
    const document = documentRepository.save({
      id: randomUUID(),
      originalName: file.originalname,
      size: file.size,
      uploadedAt: new Date().toISOString(),
      owner: process.env.DMS_DEFAULT_OWNER || 'demo-user',
      path: file.path,
    });

    return toMetadata(document);
  } catch (error) {
    await unlink(file.path).catch(() => {});
    throw error;
  }
}

function listDocuments() {
  return documentRepository.findAll()
    .filter((document) => document.owner === (process.env.DMS_DEFAULT_OWNER || 'demo-user'))
    .sort((first, second) => (
      second.uploadedAt.localeCompare(first.uploadedAt) || first.id.localeCompare(second.id)
    ))
    .map(toMetadata);
}

function getDocument(id) {
  const document = documentRepository.findById(id);
  return document?.owner === (process.env.DMS_DEFAULT_OWNER || 'demo-user')
    ? document
    : undefined;
}

module.exports = { createDocument, listDocuments, getDocument };
