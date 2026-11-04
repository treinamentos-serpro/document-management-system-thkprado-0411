# Especificação — Document Management System

> Especificação funcional e técnica do MVP. Este documento orienta a
> implementação futura; sua criação não implementa nem executa os arquivos de
> backend ou frontend descritos no plano.

## 1. Objetivo

Disponibilizar uma aplicação web que permita ao usuário de demonstração enviar,
listar e baixar documentos armazenados no filesystem local da aplicação.

## 2. Escopo

### Dentro do escopo

- Enviar um arquivo por requisição, com limite de 10 MB.
- Gravar o conteúdo no diretório local `backend/storage`.
- Manter em memória os metadados necessários para identificar o documento e
  seu owner durante a execução do processo.
- Listar os documentos do owner identificado para a instância.
- Baixar um documento pelo identificador, somente quando associado ao owner
  identificado.
- Interface React para upload, listagem, feedback de estado e download.
- Respostas de erro previsíveis e validação nos limites HTTP.

### Fora do escopo

- Autenticação, cadastro, edição ou administração de usuários.
- Isolamento seguro entre múltiplos usuários reais.
- Armazenamento externo, banco de dados ou persistência dos metadados após
  reiniciar o processo.
- Versionamento, exclusão, edição, busca, compartilhamento ou pré-visualização
  de documentos.
- Restrições de tipo de arquivo por extensão ou MIME.
- Upload múltiplo, pastas, paginação e ordenação solicitada pelo cliente.

### Premissas e identidade do usuário

- O MVP não autentica usuários. Cada instância usa um único owner configurado
  por `DMS_DEFAULT_OWNER`, com valor padrão `demo-user`.
- Todas as requisições da instância são tratadas como feitas por esse owner.
  `owner` é um atributo de metadados e uma regra lógica de listagem/download,
  não uma barreira de autorização contra clientes não confiáveis.
- Não aceitar `owner` fornecido livremente no corpo, query string ou cabeçalho
  da requisição. Isso evita que o cliente selecione outro owner, sem sugerir
  que a aplicação oferece autenticação.
- Um reinício perde os metadados mantidos em memória. Arquivos remanescentes no
  disco não são reindexados e ficam indisponíveis pela API; esta é uma limitação
  conhecida do MVP.

## 3. Requisitos funcionais

| ID    | Requisito |
| ----- | --------- |
| RF-01 | O usuário pode enviar exatamente um arquivo no campo multipart `file`. |
| RF-02 | O upload aceita qualquer tipo de arquivo, sem confiar em extensão ou MIME para validar segurança, respeitando o limite de 10 MB (10.485.760 bytes). |
| RF-03 | Em upload válido, a aplicação gera um identificador único e um nome interno de armazenamento que não deriva do nome ou caminho enviado pelo cliente. |
| RF-04 | Em upload válido, a aplicação grava o arquivo em `backend/storage`, cria os metadados em memória e responde com os metadados públicos do documento. |
| RF-05 | Se a gravação ou o registro dos metadados falhar, a aplicação informa erro; quando um arquivo tiver sido criado no disco, tenta removê-lo para evitar arquivo órfão. |
| RF-06 | O usuário pode listar os metadados dos documentos associados ao owner configurado. |
| RF-07 | A listagem é ordenada por data de upload decrescente; em empate, usa o identificador em ordem lexicográfica para manter resultado determinístico. |
| RF-08 | O usuário pode baixar o conteúdo de um documento pelo identificador, se ele existir nos metadados e pertencer ao owner configurado. |
| RF-09 | Um identificador inexistente e um identificador associado a outro owner resultam na mesma resposta 404, sem revelar a existência de documentos de terceiros. |
| RF-10 | A interface permite selecionar e enviar um arquivo, exibir o resultado ou erro, listar documentos e iniciar o download de um documento. |
| RF-11 | A interface apresenta estados de carregamento e lista vazia e atualiza a lista após upload concluído. |
| RF-12 | A aplicação mantém o endpoint de saúde existente `GET /health`, independente dos endpoints de documentos. |

## 4. Requisitos não funcionais

| ID     | Requisito |
| ------ | --------- |
| RNF-01 | O backend usa Node.js e Express em CommonJS; o frontend usa React e Vite em ESM, sem TypeScript nesta fase. |
| RNF-02 | O upload usa Multer com `diskStorage`; o destino é o filesystem local em `backend/storage`. Não integrar serviços de armazenamento externos. |
| RNF-03 | Os metadados são mantidos em memória nesta fase. A persistência de arquivos não implica persistência de seus registros. |
| RNF-04 | O fluxo de dependência do backend é `routes -> controllers -> services -> repositories`. Camadas internas não dependem de Express nem de React. |
| RNF-05 | O repositório de documentos coordena os metadados em memória e a localização dos arquivos locais, sem expor caminhos internos na API. |
| RNF-06 | Configuração de ambiente deve seguir 12-Factor. `PORT` define a porta (padrão `3000`) e `DMS_DEFAULT_OWNER` define o owner (padrão `demo-user`). O diretório permanece `backend/storage` no MVP. |
| RNF-07 | O servidor cria o diretório de armazenamento local quando necessário. Falhas de filesystem devem ser tratadas explicitamente e não podem produzir resposta de sucesso. |
| RNF-08 | O nome original do arquivo é apenas metadado de apresentação. O caminho salvo não pode ser construído a partir de entrada do cliente; o download deve enviar o nome original como anexo com tratamento seguro de cabeçalho. |
| RNF-09 | O limite de tamanho deve ser aplicado pelo Multer antes da conclusão do upload. Não armazenar o corpo do arquivo integralmente em memória. |
| RNF-10 | Erros HTTP têm formato JSON consistente, exceto respostas de download bem-sucedidas, que são binárias. |
| RNF-11 | A interface consome a API por `fetch` usando o prefixo `/api`; o proxy de desenvolvimento do Vite encaminha `/api` ao backend e remove o prefixo antes de enviar a requisição. |
| RNF-12 | Mensagens ao usuário são em português; nomes de símbolos e código são em inglês. |
| RNF-13 | O backend deve ser testado com o runner nativo `node:test`. O frontend deve passar pelo build configurado do Vite. |

## 5. Modelo de dados

### 5.1 Metadados públicos do documento

| Campo        | Tipo   | Obrigatório | Descrição |
| ------------ | ------ | ----------- | --------- |
| `id`         | string | Sim | UUID gerado pelo servidor; identificador opaco do documento. |
| `originalName` | string | Sim | Nome original fornecido no upload, usado somente para apresentação e nome do download. |
| `size`       | number | Sim | Tamanho do conteúdo em bytes, informado pelo arquivo gravado. |
| `uploadedAt` | string | Sim | Data e hora UTC no formato ISO 8601, por exemplo `2026-11-04T19:04:40.064Z`. |
| `owner`      | string | Sim | Identificador do owner configurado para a instância. |

Exemplo:

```json
{
  "id": "41fc50f6-59ab-4c3f-a5cf-a63a729c570a",
  "originalName": "relatorio.pdf",
  "size": 153204,
  "uploadedAt": "2026-11-04T19:04:40.064Z",
  "owner": "demo-user"
}
```

### 5.2 Registro interno de persistência

O repositório pode manter campos internos adicionais, como o nome aleatório
gerado para o arquivo no disco ou seu caminho resolvido. Esses campos:

- não fazem parte do contrato JSON público;
- não são aceitos do cliente;
- não podem conter caminhos derivados de `originalName`;
- devem permanecer confinados ao diretório `backend/storage`.

O armazenamento em memória deve permitir localizar metadados e arquivo por
`id`, e filtrar os registros por `owner`. O registro é removido da memória se o
arquivo não puder ser mantido no disco; remoção de documentos pela API está
fora do escopo.

## 6. Contratos de API

### Convenções

- Os caminhos abaixo são os caminhos recebidos pelo backend. No frontend, usar
  `/api/upload`, `/api/documents` e `/api/documents/:id/download`; o proxy Vite
  remove `/api`.
- JSON usa UTF-8. Upload usa `multipart/form-data`.
- Respostas JSON de sucesso usam o envelope `{ "data": ... }`. Respostas JSON
  de erro usam `{ "error": { "code": "...", "message": "..." } }`.
- `message` é uma mensagem segura para exibição ao usuário, em português, sem
  stack trace ou caminho local. Detalhes técnicos devem ser registrados apenas
  no servidor.
- O owner vem da configuração da instância, não de parâmetro enviado pelo
  cliente.

### `POST /upload`

Envia um arquivo para o owner configurado.

**Entrada**

- `Content-Type: multipart/form-data`
- Um único campo de arquivo chamado `file`.
- Tamanho máximo: 10.485.760 bytes.
- Nenhum campo de texto é necessário. Outros campos não alteram `owner`.

**Sucesso — `201 Created`**

```json
{
  "data": {
    "id": "41fc50f6-59ab-4c3f-a5cf-a63a729c570a",
    "originalName": "relatorio.pdf",
    "size": 153204,
    "uploadedAt": "2026-11-04T19:04:40.064Z",
    "owner": "demo-user"
  }
}
```

**Erros**

| HTTP | `error.code` | Condição |
| ---- | ------------ | -------- |
| 400 | `FILE_REQUIRED` | Campo `file` ausente ou requisição multipart inválida. |
| 400 | `UNEXPECTED_FILE` | Campo de arquivo diferente de `file` ou mais de um arquivo. |
| 413 | `FILE_TOO_LARGE` | Arquivo excede 10.485.760 bytes. |
| 500 | `UPLOAD_FAILED` | Falha ao criar diretório, gravar arquivo ou registrar metadados. |

Em falha após a gravação, tentar remover o arquivo gerado. A resposta não deve
expor caminhos locais nem apresentar sucesso se a gravação ou o registro não
for concluído.

### `GET /documents`

Lista metadados dos documentos associados ao owner configurado, ordenados por
`uploadedAt` decrescente e, em empate, por `id` crescente.

**Sucesso — `200 OK`**

```json
{
  "data": [
    {
      "id": "41fc50f6-59ab-4c3f-a5cf-a63a729c570a",
      "originalName": "relatorio.pdf",
      "size": 153204,
      "uploadedAt": "2026-11-04T19:04:40.064Z",
      "owner": "demo-user"
    }
  ]
}
```

Uma lista vazia é sucesso e retorna `{ "data": [] }`. O endpoint não aceita
filtros de owner fornecidos pelo cliente.

**Erros**

| HTTP | `error.code` | Condição |
| ---- | ------------ | -------- |
| 500 | `DOCUMENT_LIST_FAILED` | Falha inesperada ao consultar o repositório. |

### `GET /documents/:id/download`

Retorna o conteúdo binário de um documento identificado por UUID, somente se
seus metadados estiverem presentes e associados ao owner configurado.

**Sucesso — `200 OK`**

- Corpo: bytes originais do arquivo.
- `Content-Type: application/octet-stream`.
- `Content-Disposition: attachment` com o nome original codificado/escapado
  com segurança.
- `X-Content-Type-Options: nosniff`.

**Erros**

| HTTP | `error.code` | Condição |
| ---- | ------------ | -------- |
| 400 | `INVALID_DOCUMENT_ID` | Identificador malformado. |
| 404 | `DOCUMENT_NOT_FOUND` | Metadados inexistentes, owner diferente ou arquivo local ausente. |
| 500 | `DOWNLOAD_FAILED` | Erro de leitura do arquivo não classificado como inexistente. |

A mesma resposta 404 é usada para documento inexistente e documento de outro
owner. O servidor não deve enviar o caminho interno nem conteúdo parcial como
resposta de erro. Se o arquivo desaparecer após a consulta ao repositório, a
resposta continua sendo 404 quando essa condição puder ser detectada.

### `GET /health`

Mantém o endpoint existente:

**Sucesso — `200 OK`**

```json
{ "status": "ok" }
```

### Formato de erro

Exemplo:

```json
{
  "error": {
    "code": "FILE_TOO_LARGE",
    "message": "O arquivo excede o limite de 10 MB."
  }
}
```

O middleware de erro deve converter erros conhecidos do Multer e de validação
para os códigos documentados. Erros desconhecidos retornam `500` com código
genérico apropriado ao endpoint; detalhes internos não são retornados ao
cliente.

## 7. Decisões arquiteturais

### Backend

- `routes/`: registra caminhos HTTP, middleware de upload e delegação aos
  controllers. Não contém regras de negócio ou persistência.
- `controllers/`: valida parâmetros/entrada HTTP, chama services e converte
  resultados e erros em status e respostas HTTP.
- `services/`: implementa regras de upload, owner, listagem, ordenação e
  download sem depender de Express.
- `repositories/`: mantém metadados em memória e realiza acesso aos arquivos no
  filesystem local.
- A configuração do Multer usa `diskStorage`, limite de um arquivo e limite de
  10 MB. O nome físico é gerado pelo servidor; `originalName` nunca é usado
  como caminho.
- A criação dos metadados ocorre somente depois que o arquivo é gravado. Se o
  registro em memória falhar, remover o arquivo quando possível.
- O backend preserva `GET /health`. Os demais endpoints são integrados sem
  mover regras de negócio para `app.js`.

### Frontend

- Componentes funcionais com React Hooks, organizados em `components/`,
  `pages/` e `services/`.
- Um serviço centraliza chamadas `fetch` ao backend via prefixo `/api` e
  normaliza a leitura de respostas de erro.
- Componentes previstos: formulário de upload, lista de documentos e ação de
  download. A página coordena estado de carregamento, erro e atualização da
  lista.
- A UI exibe somente os metadados públicos; não tenta acessar paths do
  filesystem nem atribuir owner.

### Erros e segurança operacional

- Validar que o ID usado para construir uma localização interna é gerado pelo
  servidor e que o path resolvido permanece dentro de `backend/storage`.
- Usar nome físico aleatório gerado pelo servidor. Não permitir path traversal
  por nome de arquivo fornecido.
- Não confiar em MIME nem extensão para autorizar o upload; downloads são
  anexos binários para reduzir interpretação pelo navegador.
- A falha de I/O deve resultar em resposta não-success e log técnico no
  servidor; não usar fallback silencioso.
- O modo sem autenticação é adequado apenas para demonstração e ambiente
  controlado. A especificação não afirma proteção contra acesso de usuários
  externos.

## 8. Plano de execução

As etapas abaixo descrevem implementação futura e não fazem parte da alteração
deste documento. Cada etapa deve preservar as anteriores e ser validada antes
de avançar.

### Etapa 1 — Base do backend e armazenamento local

**Arquivos previstos**

- `backend/src/app.js`
- `backend/src/config/` (configuração de porta e owner, se necessária)
- `backend/src/routes/documentRoutes.js`
- `backend/src/repositories/documentRepository.js`
- `backend/test/` (testes do armazenamento/repositório)

**Atividades**

- Definir o repositório em memória e a localização local `backend/storage`.
- Preparar geração de identificador/nome físico e criação do diretório local.
- Configurar Multer com `diskStorage`, um arquivo no campo `file` e limite de
  10 MB.
- Integrar rotas de documentos mantendo `GET /health`.

**Critérios de aceite**

- Arquivo enviado válido é gravado no filesystem local com nome físico gerado
  pelo servidor.
- Metadados não dependem de banco externo e não incluem caminho interno na
  resposta pública.
- Arquivo maior que 10 MB ou campo inválido não gera resposta de sucesso.
- As rotas não implementam regras de negócio diretamente.

### Etapa 2 — Casos de uso, contratos HTTP e testes do backend

**Arquivos previstos**

- `backend/src/controllers/documentController.js`
- `backend/src/services/documentService.js`
- `backend/src/repositories/documentRepository.js`
- `backend/src/routes/documentRoutes.js`
- `backend/src/middleware/errorHandler.js` (ou mecanismo equivalente integrado
  à aplicação)
- `backend/test/` (testes dos contratos e casos de uso)

**Atividades**

- Implementar upload, listagem por owner e download por ID nas camadas
  controller/service/repository.
- Padronizar erros do Multer, validação, filesystem e documento não encontrado.
- Implementar a limpeza do arquivo em caso de falha ao registrar metadados.
- Cobrir o formato e os status documentados com `node:test`.

**Critérios de aceite**

- `POST /upload` retorna `201` e metadados completos para upload válido.
- `GET /documents` retorna lista vazia ou documentos do owner em ordem
  determinística.
- `GET /documents/:id/download` transmite bytes e não revela existência de
  documentos de outro owner.
- Entradas inválidas, limite excedido e erros de filesystem retornam os códigos
  e status especificados, sem caminhos ou stack traces na resposta.
- Reiniciar o processo remove a disponibilidade dos metadados, conforme a
  limitação documentada.

### Etapa 3 — Serviço de API e configuração do frontend

**Arquivos previstos**

- `frontend/src/services/documentService.js`
- `frontend/vite.config.js`
- `frontend/src/App.jsx`

**Atividades**

- Centralizar requisições `fetch` para upload, listagem e download.
- Configurar o proxy de desenvolvimento `/api` para o backend, removendo o
  prefixo antes do encaminhamento.
- Tratar status não-success sem converter falhas em respostas vazias de
  sucesso.

**Critérios de aceite**

- O frontend chama somente URLs com prefixo `/api`.
- Os três fluxos alcançam os endpoints correspondentes sem duplicar a lógica
  de transporte nos componentes.
- Erros da API permanecem disponíveis para feedback em português na UI.

### Etapa 4 — Interface de documentos

**Arquivos previstos**

- `frontend/src/pages/DocumentsPage.jsx`
- `frontend/src/components/UploadComponent.jsx`
- `frontend/src/components/DocumentList.jsx`
- `frontend/src/components/DownloadButton.jsx`
- `frontend/src/App.jsx`

**Atividades**

- Substituir o conteúdo placeholder por uma página para gerenciar documentos.
- Implementar seleção/envio de um arquivo, listagem de metadados e download.
- Exibir estados de carregamento, lista vazia e erros; atualizar a lista após
  upload concluído.

**Critérios de aceite**

- Um usuário consegue concluir upload, ver o novo documento na lista e iniciar
  seu download pela interface.
- Estados de erro e lista vazia são compreensíveis e não simulam sucesso.
- A UI não expõe paths internos nem permite escolher o owner.

### Etapa 5 — Verificação integrada e documentação final

**Arquivos previstos**

- Testes relevantes em `backend/test/`
- `docs/specs/dms-spec.md` (este contrato, atualizado somente se uma decisão de
  implementação aprovada exigir ajuste)

**Atividades**

- Executar testes backend com `node --test` e build frontend com o script Vite.
- Validar manualmente upload válido, upload acima do limite, listagem, download,
  ausência de documento e persistência de metadados após reinício.
- Confirmar que arquivos são escritos exclusivamente no armazenamento local
  especificado e que não há regressões no health check.

**Critérios de aceite**

- Testes backend e build frontend passam.
- Os contratos HTTP desta especificação são atendidos no fluxo integrado.
- Nenhum armazenamento externo ou persistência de metadados não aprovada foi
  introduzida.
