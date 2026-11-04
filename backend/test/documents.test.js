const { after, before, test } = require('node:test');
const assert = require('node:assert/strict');
const { once } = require('node:events');
const { readFile, readdir, unlink } = require('node:fs/promises');
const path = require('node:path');
const app = require('../src/app');
const documentRepository = require('../src/repositories/documentRepository');
const documentService = require('../src/services/documentService');

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
  await Promise.all(Array.from(uploadedPaths, (filePath) => (
    unlink(path.join(storageDirectory, path.basename(filePath)))
  )));
});

async function uploadFile(content, name = 'documento.txt') {
  const form = new FormData();
  form.append('file', new Blob([content]), name);
  const response = await fetch(`${baseUrl}/upload`, { method: 'POST', body: form });
  assert.equal(response.status, 201);
  const { data: document } = await response.json();
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
  assert.deepEqual(await response.json(), { data: [] });
});

test('grava em storage, lista metadados e baixa os mesmos bytes', async () => {
  const content = Buffer.from([0, 1, 2, 127, 128, 255]);
  const { document, storedDocument } = await uploadFile(content);
  assert.deepEqual(Object.keys(document).sort(), [
    'id', 'originalName', 'owner', 'size', 'uploadedAt',
  ]);
  assert.match(document.id, /^[0-9a-f-]{36}$/);
  assert.equal(document.originalName, 'documento.txt');
  assert.equal(document.size, content.length);
  assert.equal(document.owner, 'demo-user');
  assert.equal(new Date(document.uploadedAt).toISOString(), document.uploadedAt);
  assert.equal(path.dirname(storedDocument.path), storageDirectory);
  assert.deepEqual(await readFile(storedDocument.path), content);

  const listing = await fetch(`${baseUrl}/documents`);
  assert.deepEqual(await listing.json(), { data: [document] });

  const download = await fetch(`${baseUrl}/documents/${document.id}/download`);
  assert.equal(download.status, 200);
  assert.equal(download.headers.get('x-content-type-options'), 'nosniff');
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
  assert.deepEqual(await response.json(), {
    error: { code: 'FILE_REQUIRED', message: 'Envie um arquivo no campo file.' },
  });
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
    assert.deepEqual(await response.json(), {
      error: { code: 'UNEXPECTED_FILE', message: 'Envie apenas um arquivo no campo file.' },
    });
  }

  assert.deepEqual((await readdir(storageDirectory)).sort(), filesBefore.sort());
  assert.equal(documentRepository.findAll().length, documentsBefore);
});

test('distingue identificador inválido de documento inexistente', async () => {
  const invalid = await fetch(`${baseUrl}/documents/inexistente/download`);
  assert.equal(invalid.status, 400);
  assert.deepEqual(await invalid.json(), {
    error: {
      code: 'INVALID_DOCUMENT_ID',
      message: 'O identificador do documento é inválido.',
    },
  });

  const response = await fetch(`${baseUrl}/documents/41fc50f6-59ab-4c3f-a5cf-a63a729c570a/download`);
  assert.equal(response.status, 404);
  assert.deepEqual(await response.json(), {
    error: { code: 'DOCUMENT_NOT_FOUND', message: 'Documento não encontrado.' },
  });
});

test('retorna 404 quando o arquivo físico não existe mais', async () => {
  const { document, storedDocument } = await uploadFile('removido');
  await unlink(storedDocument.path);
  uploadedPaths.delete(storedDocument.path);

  const response = await fetch(`${baseUrl}/documents/${document.id}/download`);
  assert.equal(response.status, 404);
  assert.deepEqual(await response.json(), {
    error: { code: 'DOCUMENT_NOT_FOUND', message: 'Documento não encontrado.' },
  });
});

test('não baixa um documento com caminho fora do armazenamento local', async () => {
  const originalFindById = documentRepository.findById;
  documentRepository.findById = (id) => ({
    id,
    owner: 'demo-user',
    originalName: 'fora.txt',
    path: path.resolve(storageDirectory, '../fora.txt'),
  });

  try {
    const response = await fetch(
      `${baseUrl}/documents/41fc50f6-59ab-4c3f-a5cf-a63a729c570a/download`,
    );
    assert.equal(response.status, 500);
    assert.deepEqual(await response.json(), {
      error: { code: 'DOWNLOAD_FAILED', message: 'Não foi possível processar a solicitação.' },
    });
  } finally {
    documentRepository.findById = originalFindById;
  }
});

test('rejeita arquivos maiores que 10 MiB com erro 413', async () => {
  const filesBefore = (await readdir(storageDirectory)).sort();
  const form = new FormData();
  form.append('file', new Blob([new Uint8Array(10 * 1024 * 1024 + 1)]), 'grande.bin');

  const response = await fetch(`${baseUrl}/upload`, { method: 'POST', body: form });
  assert.equal(response.status, 413);
  assert.deepEqual(await response.json(), {
    error: { code: 'FILE_TOO_LARGE', message: 'O arquivo excede o limite de 10 MB.' },
  });
  assert.deepEqual((await readdir(storageDirectory)).sort(), filesBefore);
});

test('remove o arquivo se o registro dos metadados falhar', async () => {
  const originalSave = documentRepository.save;
  const filesBefore = (await readdir(storageDirectory)).sort();
  documentRepository.save = () => {
    throw new Error('Falha simulada no repositório');
  };

  try {
    const form = new FormData();
    form.append('file', new Blob(['conteúdo']), 'falha.txt');
    const response = await fetch(`${baseUrl}/upload`, { method: 'POST', body: form });
    assert.equal(response.status, 500);
    assert.deepEqual(await response.json(), {
      error: { code: 'UPLOAD_FAILED', message: 'Não foi possível processar a solicitação.' },
    });
    assert.deepEqual((await readdir(storageDirectory)).sort(), filesBefore);
  } finally {
    documentRepository.save = originalSave;
  }
});

test('usa o owner configurado e ordena por data decrescente com ID como desempate', async () => {
  const previousOwner = process.env.DMS_DEFAULT_OWNER;
  process.env.DMS_DEFAULT_OWNER = 'configured-user';

  try {
    const { document } = await uploadFile('owner configurado');
    assert.equal(document.owner, 'configured-user');
  } finally {
    if (previousOwner === undefined) {
      delete process.env.DMS_DEFAULT_OWNER;
    } else {
      process.env.DMS_DEFAULT_OWNER = previousOwner;
    }
  }

  const originalFindAll = documentRepository.findAll;
  documentRepository.findAll = () => [
    { id: 'tie-b', owner: 'demo-user', uploadedAt: '2026-01-01T00:00:00.000Z' },
    { id: 'older', owner: 'demo-user', uploadedAt: '2025-01-01T00:00:00.000Z' },
    { id: 'tie-a', owner: 'demo-user', uploadedAt: '2026-01-01T00:00:00.000Z' },
    { id: 'newer', owner: 'demo-user', uploadedAt: '2027-01-01T00:00:00.000Z' },
  ];

  try {
    assert.deepEqual(
      documentService.listDocuments().map(({ id }) => id),
      ['newer', 'tie-a', 'tie-b', 'older'],
    );
  } finally {
    documentRepository.findAll = originalFindAll;
  }
});
