import { PYTHON_URL } from "./config";

export async function uploadCsv(file, token) {
  const formData = new FormData();
  formData.append("file", file);

  const res = await fetch(`${PYTHON_URL}/csv/upload`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body: formData,
  });
  if (!res.ok) throw new Error(`Upload failed (${res.status}): ${await res.text()}`);
  return res.json();
}

export async function getAiSuggestions(fileId, token) {
  const res = await fetch(`${PYTHON_URL}/csv/ai-suggest?file_id=${fileId}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error(`AI suggestion failed (${res.status}): ${await res.text()}`);
  return res.json();
}

export async function sendAiChat(fileId, message, history, token) {
  const res = await fetch(`${PYTHON_URL}/csv/chat`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ file_id: fileId, message, history }),
  });
  if (!res.ok) throw new Error(`AI chat failed (${res.status}): ${await res.text()}`);
  return res.json();
}

export async function cleanCsv(fileId, operations, token) {
  const res = await fetch(`${PYTHON_URL}/csv/clean`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ file_id: fileId, operations }),
  });
  if (!res.ok) throw new Error(`Clean failed (${res.status}): ${await res.text()}`);
  return res.json();
}

export async function getDatasetComparison(originalFileId, cleanedFileId, token) {
  const res = await fetch(`${PYTHON_URL}/csv/comparison/${originalFileId}/${cleanedFileId}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error(`Failed to fetch comparison (${res.status}): ${await res.text()}`);
  return res.json();
}

export async function downloadCsvFile(fileId, token) {
  const url = `${PYTHON_URL}/csv/download/${fileId}`;
  const res = await fetch(url, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!res.ok) throw new Error(`Download failed (${res.status}): ${await res.text()}`);
  
  const blob = await res.blob();
  const blobUrl = window.URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = blobUrl;
  a.download = `datapilot_cleaned_${fileId.slice(0, 8)}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.URL.revokeObjectURL(blobUrl);
}

export function getDownloadUrl(fileId) {
  return `${PYTHON_URL}/csv/download/${fileId}`;
}