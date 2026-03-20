"use client";

import { useEffect, useMemo, useState } from "react";

type StoredFile = {
  name: string;
  size: number;
  updatedAt: string;
  url: string;
};

function formatSize(value: number) {
  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`;
  return `${(value / (1024 * 1024)).toFixed(1)} MB`;
}

export default function Home() {
  const [files, setFiles] = useState<StoredFile[]>([]);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [deletingName, setDeletingName] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const totalSize = useMemo(
    () => files.reduce((accumulator, current) => accumulator + current.size, 0),
    [files],
  );

  async function loadFiles() {
    setLoading(true);
    setErrorMessage(null);

    try {
      const response = await fetch("/api/files", { cache: "no-store" });
      if (!response.ok) {
        throw new Error("Could not load files.");
      }

      const data = (await response.json()) as { files: StoredFile[] };
      setFiles(data.files);
    } catch (error) {
      console.error(error);
      setErrorMessage("Could not load files from the server.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadFiles();
  }, []);

  async function handleUpload(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    setStatusMessage(null);
    setErrorMessage(null);

    if (!selectedFile) {
      setErrorMessage("Please choose a file first.");
      return;
    }

    setUploading(true);

    try {
      const formData = new FormData();
      formData.append("file", selectedFile);

      const response = await fetch("/api/files", {
        method: "POST",
        body: formData,
      });

      const payload = (await response.json()) as {
        error?: string;
        message?: string;
        files?: StoredFile[];
      };

      if (!response.ok) {
        throw new Error(payload.error || "Upload failed.");
      }

      setFiles(payload.files ?? []);
      setStatusMessage(payload.message || "Upload completed.");
      setSelectedFile(null);
      form.reset();
    } catch (error) {
      console.error(error);
      setErrorMessage(error instanceof Error ? error.message : "Upload failed.");
    } finally {
      setUploading(false);
    }
  }

  async function handleDelete(fileName: string) {
    setStatusMessage(null);
    setErrorMessage(null);

    const shouldDelete = window.confirm(`Delete ${fileName}?`);
    if (!shouldDelete) {
      return;
    }

    setDeletingName(fileName);

    try {
      const response = await fetch(`/api/files?name=${encodeURIComponent(fileName)}`, {
        method: "DELETE",
      });

      const payload = (await response.json()) as {
        error?: string;
        message?: string;
        files?: StoredFile[];
      };

      if (!response.ok) {
        throw new Error(payload.error || "Delete failed.");
      }

      setFiles(payload.files ?? []);
      setStatusMessage(payload.message || "File deleted.");
    } catch (error) {
      console.error(error);
      setErrorMessage(error instanceof Error ? error.message : "Delete failed.");
    } finally {
      setDeletingName(null);
    }
  }

  return (
    <main className="storage-page">
      <section className="storage-shell">
        <header className="hero-panel">
          <p className="eyebrow">Secure File Storage</p>
          <h1>Upload and manage server files</h1>
          <p>
            Keep your files in one place with fast uploads and a clean, searchable
            list that your team can review anytime.
          </p>
          <div className="hero-stats">
            <article>
              <span>Total Files</span>
              <strong>{files.length}</strong>
            </article>
            <article>
              <span>Storage Used</span>
              <strong>{formatSize(totalSize)}</strong>
            </article>
          </div>
        </header>

        <section className="card-grid">
          <article className="panel upload-panel">
            <h2>Upload File</h2>
            <p>Select one file and send it directly to your server storage.</p>

            <form onSubmit={handleUpload} className="upload-form">
              <label className="file-input-wrap">
                <span>Choose file</span>
                <input
                  type="file"
                  onChange={(event) => {
                    const incoming = event.target.files?.[0] ?? null;
                    setSelectedFile(incoming);
                  }}
                />
              </label>

              <button type="submit" disabled={uploading}>
                {uploading ? "Uploading..." : "Upload to Server"}
              </button>
            </form>

            {selectedFile && (
              <p className="helper-text">
                Selected: <strong>{selectedFile.name}</strong> ({formatSize(selectedFile.size)})
              </p>
            )}

            {statusMessage && <p className="success-text">{statusMessage}</p>}
            {errorMessage && <p className="error-text">{errorMessage}</p>}
          </article>

          <article className="panel list-panel">
            <div className="panel-heading">
              <h2>Stored Files</h2>
              <button type="button" onClick={() => void loadFiles()} disabled={loading}>
                {loading ? "Refreshing..." : "Refresh"}
              </button>
            </div>

            {loading ? (
              <p className="helper-text">Loading files...</p>
            ) : files.length === 0 ? (
              <p className="helper-text">No files uploaded yet.</p>
            ) : (
              <ul className="file-list">
                {files.map((file) => (
                  <li key={file.name}>
                    <div className="file-meta">
                      <strong>{file.name}</strong>
                      <span>
                        {formatSize(file.size)} · {new Date(file.updatedAt).toLocaleString()}
                      </span>
                    </div>
                    <div className="file-actions">
                      <a href={file.url} target="_blank" rel="noreferrer">
                        View
                      </a>
                      <a href={file.url} download>
                        Download
                      </a>
                      <button
                        type="button"
                        className="delete-button"
                        disabled={deletingName === file.name}
                        onClick={() => void handleDelete(file.name)}
                      >
                        {deletingName === file.name ? "Deleting..." : "Delete"}
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </article>
        </section>
      </section>
    </main>
  );
}
