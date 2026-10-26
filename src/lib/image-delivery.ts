// Delivery only: the caller owns ONE reservation and completes it only after
// either clipboard or download initiation succeeds. Fallback never re-renders
// or creates a second quota operation.
export async function copyOrDownload(blob: Blob, delivery: {
  copy: (blob: Blob) => Promise<void>;
  download: (blob: Blob) => void;
}) {
  try { await delivery.copy(blob); return 'copied' as const; }
  catch { delivery.download(blob); return 'download_requested' as const; }
}

export function downloadPng(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url; link.download = filename;
  document.body.appendChild(link);
  try { link.click(); }
  finally { link.remove(); setTimeout(() => URL.revokeObjectURL(url), 60000); }
}
