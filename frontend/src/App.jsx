import { useEffect, useState } from 'react';
import UploadComponent from './components/UploadComponent';
import DocumentList from './components/DocumentList';
import { listDocuments } from './services/api';

export default function App() {
  const [documents, setDocuments] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    setIsLoading(true);
    setError('');

    async function loadDocuments() {
      try {
        const data = await listDocuments(controller.signal);
        if (!controller.signal.aborted) {
          setDocuments(data);
        }
      } catch (error) {
        if (!controller.signal.aborted) {
          setError(error.message);
        }
      } finally {
        if (!controller.signal.aborted) {
          setIsLoading(false);
        }
      }
    }

    loadDocuments();
    return () => controller.abort();
  }, [refreshKey]);

  function refreshDocuments() {
    setRefreshKey((key) => key + 1);
  }

  return (
    <main style={{ fontFamily: 'system-ui, sans-serif', padding: '2rem' }}>
      <h1>Document Management System</h1>
      <UploadComponent onUploadSuccess={refreshDocuments} />
      <DocumentList
        documents={documents}
        isLoading={isLoading}
        error={error}
        onRetry={refreshDocuments}
      />
    </main>
  );
}
