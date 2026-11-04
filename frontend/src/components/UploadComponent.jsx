import { useId, useState } from 'react';
import { uploadDocument } from '../services/api';

export default function UploadComponent({ onUploadSuccess }) {
  const inputId = useId();
  const [file, setFile] = useState(null);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  async function handleSubmit(event) {
    event.preventDefault();
    setError('');
    setMessage('');
    if (!file) {
      setError('Selecione um arquivo para enviar.');
      return;
    }

    const form = event.currentTarget;
    setIsUploading(true);
    try {
      const document = await uploadDocument(file);
      form.reset();
      setFile(null);
      setMessage('Documento enviado com sucesso.');
      onUploadSuccess(document);
    } catch (error) {
      setError(error.message);
    } finally {
      setIsUploading(false);
    }
  }

  return (
    <section aria-labelledby={`${inputId}-heading`}>
      <h2 id={`${inputId}-heading`}>Enviar documento</h2>
      <form onSubmit={handleSubmit} aria-busy={isUploading}>
        <label htmlFor={inputId}>Arquivo</label>{' '}
        <input
          id={inputId}
          name="file"
          type="file"
          required
          disabled={isUploading}
          onChange={(event) => {
            setFile(event.target.files[0] ?? null);
            setError('');
            setMessage('');
          }}
        />{' '}
        <button type="submit" disabled={!file || isUploading}>
          {isUploading ? 'Enviando...' : 'Enviar'}
        </button>
      </form>
      {error && <p role="alert">{error}</p>}
      {message && <p role="status">{message}</p>}
    </section>
  );
}
