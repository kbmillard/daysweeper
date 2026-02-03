'use client';

import { Button } from '@/components/ui/button';
import { FileUploader } from '@/components/file-uploader';
import { toast } from 'sonner';

export function BinsUploadButton() {
  const handleUpload = async (files: File[]) => {
    const file = files[0];
    if (!file) return;

    const formData = new FormData();
    formData.append('file', file);

    try {
      const res = await fetch('/api/import/bins', {
        method: 'POST',
        body: formData
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || 'Failed to import bins');
      }

      const data = await res.json();
      toast.success(`Successfully imported ${data.upserted} items`);
      window.location.reload();
    } catch (error: unknown) {
      toast.error(
        error instanceof Error ? error.message : 'Failed to import bins'
      );
      throw error;
    }
  };

  return (
    <FileUploader
      accept={{
        'text/csv': ['.csv'],
        'application/vnd.ms-excel': ['.xls', '.xlsx'],
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': [
          '.xlsx'
        ]
      }}
      maxFiles={1}
      onUpload={handleUpload}
    >
      <Button>Import CSV / Excel</Button>
    </FileUploader>
  );
}
