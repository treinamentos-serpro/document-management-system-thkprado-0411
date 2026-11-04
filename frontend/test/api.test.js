import { afterEach, test } from 'node:test';
import assert from 'node:assert/strict';
import { mock } from 'node:test';
import { downloadDocument, listDocuments, uploadDocument } from '../src/services/api.js';

afterEach(() => mock.restoreAll());

test('lista documentos via /api e encaminha o sinal de cancelamento', async () => {
  const documents = [{ id: '123', originalName: 'documento.txt' }];
  const signal = new AbortController().signal;
  const fetchMock = mock.method(globalThis, 'fetch', async (url, options) => {
    assert.equal(url, '/api/documents');
    assert.equal(options.signal, signal);
    return Response.json({ data: documents });
  });

  assert.deepEqual(await listDocuments(signal), documents);
  assert.equal(fetchMock.mock.callCount(), 1);
});

test('envia multipart com um arquivo no campo file sem definir Content-Type', async () => {
  const file = new File(['conteúdo'], 'documento.txt', { type: 'text/plain' });
  const document = { id: '123', originalName: file.name, size: file.size };
  mock.method(globalThis, 'fetch', async (url, options) => {
    assert.equal(url, '/api/upload');
    assert.equal(options.method, 'POST');
    assert.equal(options.headers, undefined);
    assert.ok(options.body instanceof FormData);
    assert.deepEqual([...options.body.keys()], ['file']);
    assert.equal(options.body.get('file').name, file.name);
    assert.equal(await options.body.get('file').text(), 'conteúdo');
    return Response.json({ data: document }, { status: 201 });
  });

  assert.deepEqual(await uploadDocument(file), document);
});

test('baixa bytes via /api com ID codificado', async () => {
  const bytes = new Uint8Array([0, 1, 128, 255]);
  mock.method(globalThis, 'fetch', async (url) => {
    assert.equal(url, '/api/documents/id%2Fcom%20espa%C3%A7o/download');
    return new Response(bytes);
  });

  const blob = await downloadDocument('id/com espaço');
  assert.ok(blob instanceof Blob);
  assert.deepEqual(new Uint8Array(await blob.arrayBuffer()), bytes);
});

test('propaga a mensagem de erro do backend em todas as operações', async () => {
  mock.method(globalThis, 'fetch', async () =>
    Response.json({
      error: { code: 'INVALID_DOCUMENT_ID', message: 'Erro informado pelo backend.' },
    }, { status: 400 }));

  for (const operation of [
    () => listDocuments(),
    () => uploadDocument(new File(['x'], 'arquivo.txt')),
    () => downloadDocument('inexistente'),
  ]) {
    await assert.rejects(operation, { message: 'Erro informado pelo backend.' });
  }
});

test('informa falhas HTTP não JSON sem exibir HTML do proxy', async () => {
  mock.method(globalThis, 'fetch', async () =>
    new Response('<html>Bad gateway</html>', { status: 502 }));

  await assert.rejects(listDocuments, { message: 'A solicitação falhou (HTTP 502).' });
});

test('informa falhas de conexão em português e preserva a causa', async () => {
  const cause = new TypeError('Failed to fetch');
  mock.method(globalThis, 'fetch', async () => { throw cause; });

  await assert.rejects(listDocuments, (error) => {
    assert.equal(error.message, 'Não foi possível conectar ao servidor. Tente novamente.');
    assert.equal(error.cause, cause);
    return true;
  });
});

test('preserva cancelamento para a limpeza do efeito React', async () => {
  const error = new DOMException('Cancelado', 'AbortError');
  mock.method(globalThis, 'fetch', async () => { throw error; });

  await assert.rejects(listDocuments, (received) => received === error);
});
