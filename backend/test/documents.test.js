const { after, before, test } = require('node:test');
const assert = require('node:assert/strict');
const { once } = require('node:events');
const { readFile, readdir, unlink } = require('node:fs/promises');
const path = require('node:path');
const app = require('../src/app');
const documentRepository = require('../src/repositories/documentRepository');

const storageDirectory = path.resolve(__dirname, '../storage');
const uploadedPaths = new Set();
let server;
let baseUrl;

before(async () => {
  server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
  await new Promise((resolve, reject) => {
    server.close((error) => error ? reject(error) : resolve());
    server.closeIdleConnections();
  });
  await Promise.all(Array.from(uploadedPaths, (filePath) => unlink(filePath)));
});

async function uploadFile(content, name = 'documento.txt') {
  const form = new FormData();
  form.append('file', new Blob([content]), name);
  const response = await fetch(`${baseUrl}/upload`, { method: 'POST', body: form });
  assert.equal(response.status, 201);
  const document = await response.json();
  const storedDocument = documentRepository.findById(document.id);
  uploadedPaths.add(storedDocument.path);
  return { document, storedDocument };
}

test('preserva a rota de saúde e inicia com a lista vazia', async () => {
  const health = await fetch(`${baseUrl}/health`);
  assert.equal(health.status, 200);
  assert.deepEqual(await health.json(), { status: 'ok' });

  const response = await fetch(`${baseUrl}/documents`);
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), []);
});

test('grava em storage, lista metadados e baixa os mesmos bytes', async () => {
  const content = Buffer.from([0, 1, 2, 127, 128, 255]);
  const { document, storedDocument } = await uploadFile(content);
  assert.deepEqual(Object.keys(document).sort(), [
    'createdAt', 'id', 'originalName', 'owner', 'size',
  ]);
  assert.match(document.id, /^[0-9a-f-]{36}$/);
  assert.equal(document.originalName, 'documento.txt');
  assert.equal(document.size, content.length);
  assert.equal(document.owner, 'anonymous');
  assert.equal(new Date(document.createdAt).toISOString(), document.createdAt);
  assert.equal(path.dirname(storedDocument.path), storageDirectory);
  assert.deepEqual(await readFile(storedDocument.path), content);

  const listing = await fetch(`${baseUrl}/documents`);
  assert.deepEqual(await listing.json(), [document]);

  const download = await fetch(`${baseUrl}/documents/${document.id}/download`);
  assert.equal(download.status, 200);
  assert.match(download.headers.get('content-disposition'), /attachment; filename="documento.txt"/);
  assert.deepEqual(Buffer.from(await download.arrayBuffer()), content);
});

test('arquivos com o mesmo nome não sobrescrevem uploads anteriores', async () => {
  const first = await uploadFile('primeiro');
  const second = await uploadFile('segundo');
  assert.notEqual(first.document.id, second.document.id);
  assert.notEqual(first.storedDocument.path, second.storedDocument.path);
  assert.equal(await readFile(first.storedDocument.path, 'utf8'), 'primeiro');
  assert.equal(await readFile(second.storedDocument.path, 'utf8'), 'segundo');
});

test('rejeita upload sem arquivo', async () => {
  const response = await fetch(`${baseUrl}/upload`, { method: 'POST' });
  assert.equal(response.status, 400);
  assert.deepEqual(await response.json(), { error: 'Envie um arquivo no campo file.' });
});

test('rejeita campo de arquivo inesperado e múltiplos arquivos sem deixar resíduos', async () => {
  const filesBefore = await readdir(storageDirectory);
  const documentsBefore = documentRepository.findAll().length;

  for (const fields of [['other'], ['file', 'file']]) {
    const form = new FormData();
    for (const field of fields) {
      form.append(field, new Blob(['inválido']), 'invalido.txt');
    }
    const response = await fetch(`${baseUrl}/upload`, { method: 'POST', body: form });
    assert.equal(response.status, 400);
    assert.deepEqual(await response.json(), { error: 'Envie apenas um arquivo no campo file.' });
  }

  assert.deepEqual((await readdir(storageDirectory)).sort(), filesBefore.sort());
  assert.equal(documentRepository.findAll().length, documentsBefore);
});

test('retorna 404 para documento inexistente', async () => {
  const response = await fetch(`${baseUrl}/documents/inexistente/download`);
  assert.equal(response.status, 404);
  assert.deepEqual(await response.json(), { error: 'Documento não encontrado.' });
});

test('retorna 404 quando o arquivo físico não existe mais', async () => {
  const { document, storedDocument } = await uploadFile('removido');
  await unlink(storedDocument.path);
  uploadedPaths.delete(storedDocument.path);

  const response = await fetch(`${baseUrl}/documents/${document.id}/download`);
  assert.equal(response.status, 404);
  assert.deepEqual(await response.json(), { error: 'Arquivo do documento não encontrado.' });
});
