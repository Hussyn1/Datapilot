import { PYTHON_URL } from "./config";

export async function labelImagesBatch(files, candidateLabels, token) {
  const formData = new FormData();
  for (const file of files) {
    formData.append("files", file);
  }
  if (candidateLabels && candidateLabels.trim()) {
    formData.append("candidate_labels", candidateLabels.trim());
  }

  const res = await fetch(`${PYTHON_URL}/image/label-batch`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
    },
    body: formData,
  });

  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`Auto-labeling failed (${res.status}): ${errorText}`);
  }

  return res.json();
}

export async function exportLabeledDataset(sessionId, exportFormat, records, token) {
  const res = await fetch(`${PYTHON_URL}/image/export-dataset`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      session_id: sessionId,
      export_format: exportFormat,
      records: records,
    }),
  });

  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`Export failed (${res.status}): ${errorText}`);
  }

  const blob = await res.blob();
  const blobUrl = window.URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = blobUrl;

  const ext = exportFormat === "zip" ? "zip" : exportFormat === "csv" ? "csv" : "json";
  a.download = `datapilot_labeled_dataset_${sessionId.slice(0, 8)}.${ext}`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.URL.revokeObjectURL(blobUrl);
}
