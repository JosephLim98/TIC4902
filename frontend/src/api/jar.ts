import client from './client';

export interface Jar {
  id: number;
  name: string;
  objectName: string;
  sizeBytes: number;
  url: string;
  createdAt: string;
  uploadedBy?: number | null;
}

export interface ListJarsResponse {
  jars: Jar[];
  total: number;
}

export async function listJars(signal?: AbortSignal): Promise<ListJarsResponse> {
  const { data } = await client.get<ListJarsResponse>('/jars', { signal });
  return data;
}

export async function uploadJar(
  file: File,
  onProgress?: (percent: number) => void,
): Promise<Jar> {
  const formData = new FormData();
  formData.append('file', file);
  const { data } = await client.post<Jar>('/jars', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
    onUploadProgress: onProgress
      ? (event) => {
          if (event.total) onProgress(Math.round((event.loaded * 100) / event.total));
        }
      : undefined,
  });
  return data;
}

export async function deleteJar(id: number): Promise<void> {
  await client.delete(`/jars/${id}`);
}
