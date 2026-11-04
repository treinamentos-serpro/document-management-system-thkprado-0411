import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createServer } from 'vite';

let server;
let DocumentList;
let App;

before(async () => {
  server = await createServer({
    server: { middlewareMode: true },
    appType: 'custom',
  });
  DocumentList = (await server.ssrLoadModule('/src/components/DocumentList.jsx')).default;
  App = (await server.ssrLoadModule('/src/App.jsx')).default;
});

after(async () => {
  await server?.close();
});

function renderList(props = {}) {
  return renderToStaticMarkup(createElement(DocumentList, { documents: [], ...props }));
}

test('monta upload e listagem com estado inicial de carregamento', () => {
  const html = renderToStaticMarkup(createElement(App));
  assert.match(html, /Enviar documento/);
  assert.match(html, /type="file"/);
  assert.match(html, /type="submit" disabled=""/);
  assert.match(html, /Carregando documentos/);
});

test('distingue lista vazia, carregamento e falha com nova tentativa', () => {
  assert.match(renderList(), /Nenhum documento enviado/);
  const loading = renderList({ isLoading: true });
  assert.match(loading, /role="status"/);
  assert.doesNotMatch(loading, /Nenhum documento enviado/);
  const failed = renderList({ error: 'Falha ao listar' });
  assert.match(failed, /role="alert">Falha ao listar/);
  assert.match(failed, /Tentar novamente/);
  assert.doesNotMatch(failed, /Nenhum documento enviado/);
});

test('exibe metadados e botão de download por documento escapando nomes', () => {
  const html = renderList({
    documents: [{
      id: '123',
      originalName: '<arquivo>.txt',
      size: 1024,
      uploadedAt: '2026-11-04T12:00:00Z',
      owner: 'anonymous',
    }],
  });
  assert.match(html, /&lt;arquivo&gt;\.txt/);
  assert.match(html, /1\.024 bytes/);
  assert.match(html, /anonymous/);
  assert.match(html, /aria-label="Baixar &lt;arquivo&gt;\.txt"/);
  assert.match(html, />Baixar<\/button>/);
});
