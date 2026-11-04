const { unlink } = require('node:fs/promises');
const path = require('node:path');

const storageDirectory = path.resolve(__dirname, '../../storage');
const storageDirectoryPrefix = `${storageDirectory}${path.sep}`;

function getStoredPath(filePath) {
  const resolvedPath = path.resolve(filePath);
  return resolvedPath.startsWith(storageDirectoryPrefix) ? resolvedPath : undefined;
}

function resolveStoredPath(filePath) {
  const resolvedPath = getStoredPath(filePath);
  if (!resolvedPath) {
    throw new Error('Caminho de armazenamento inválido.');
  }
  return resolvedPath;
}

async function removeUploadedFile(filePath) {
  const resolvedPath = getStoredPath(filePath);
  if (!resolvedPath) {
    return;
  }

  try {
    await unlink(resolvedPath);
  } catch (error) {
    if (error.code !== 'ENOENT') {
      throw error;
    }
  }
}

module.exports = { removeUploadedFile, resolveStoredPath };
