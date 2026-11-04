import DownloadButton from './DownloadButton';

export default function DocumentList({ documents, isLoading, error, onRetry }) {
  return (
    <section aria-labelledby="documents-heading" aria-busy={isLoading}>
      <h2 id="documents-heading">Documentos</h2>
      {isLoading ? (
        <p role="status">Carregando documentos...</p>
      ) : error ? (
        <>
          <p role="alert">{error}</p>
          <button type="button" onClick={onRetry}>Tentar novamente</button>
        </>
      ) : documents.length === 0 ? (
        <p>Nenhum documento enviado.</p>
      ) : (
        <ul>
          {documents.map((document) => (
            <li key={document.id}>
              <p>
                <strong>{document.originalName}</strong>
                {' — '}{document.size.toLocaleString('pt-BR')} bytes
                {' — '}{new Date(document.uploadedAt).toLocaleString('pt-BR')}
                {' — '}Proprietário: {document.owner}
              </p>
              <DownloadButton document={document} />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
