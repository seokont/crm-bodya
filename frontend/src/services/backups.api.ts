import { http } from './http';

function filenameFromDisposition(disposition?: string) {
  const match = disposition?.match(/filename="?([^";]+)"?/i);
  return match?.[1] || `bodya-crm-backup-${new Date().toISOString().slice(0, 10)}.sql`;
}

export const backupsApi = {
  async downloadDatabase() {
    const response = await http.get<Blob>('/backups/database', {
      responseType: 'blob',
    });
    const filename = filenameFromDisposition(
      response.headers['content-disposition'],
    );
    const url = URL.createObjectURL(response.data);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    return filename;
  },
};
