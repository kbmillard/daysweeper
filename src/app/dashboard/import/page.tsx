"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { FileUploader } from "@/components/file-uploader";
import PageContainer from "@/components/layout/page-container";
import { toast } from "sonner";

export default function ImportPage() {
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState<{ processed: number; created: number; message: string } | null>(null);

  const handleUpload = async (files: File[]) => {
    if (files.length === 0) return;
    
    const file = files[0];
    if (!file.name.endsWith(".csv")) {
      toast.error("Please upload a CSV file");
      return;
    }

    setUploading(true);
    setResult(null);

    try {
      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch("/api/import/warehouse", {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Upload failed");
      }

      const data = await res.json();
      setResult(data);
      toast.success(data.message || "Import completed successfully");
    } catch (error: any) {
      toast.error(error.message || "Failed to import CSV");
    } finally {
      setUploading(false);
    }
  };

  return (
    <PageContainer>
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Import Warehouse Items</h2>
          <p className="text-muted-foreground">
            Upload a CSV file to import warehouse items. The system will automatically detect columns and match them to part numbers, descriptions, bins, quantities, and prices.
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>CSV Upload</CardTitle>
            <CardDescription>
              Upload a CSV file with warehouse items. Any columns will be accepted - the system will automatically match:
              <ul className="list-disc list-inside mt-2 space-y-1 text-sm">
                <li><strong>Part Number/SKU/Item</strong> → partNumber (required, unique identifier)</li>
                <li><strong>Description/Name/Title</strong> → description</li>
                <li><strong>Bin/Location/Shelf</strong> → bin</li>
                <li><strong>Quantity/Qty/Stock/Count</strong> → quantity</li>
                <li><strong>Price/Cost/Amount</strong> → price</li>
                <li>All other columns → stored in meta JSON</li>
              </ul>
            </CardDescription>
          </CardHeader>
          <CardContent>
            <FileUploader
              accept={{ "text/csv": [".csv"], "application/vnd.ms-excel": [".csv"] }}
              maxSize={10 * 1024 * 1024} // 10MB
              maxFiles={1}
              onUpload={handleUpload}
              disabled={uploading}
            />
          </CardContent>
        </Card>

        {result && (
          <Card>
            <CardHeader>
              <CardTitle>Import Results</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <p className="text-sm">
                  <strong>Processed:</strong> {result.processed} rows
                </p>
                <p className="text-sm">
                  <strong>Upserted:</strong> {result.created} items (by partNumber)
                </p>
                <p className="text-sm text-muted-foreground">{result.message}</p>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </PageContainer>
  );
}
