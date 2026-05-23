/**
 * Upload Page — Receipt & Document Upload.
 *
 * Provides drag-and-drop file upload and camera capture for receipts
 * and invoices. Files are uploaded to Supabase Storage and queued
 * for AI extraction.
 */

import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Upload',
}

export default function UploadRoute(): JSX.Element {
  return (
    <div className="app-container py-6">
      <div className="page-header">
        <h1>Upload Receipt</h1>
        <p>Drag and drop or snap a photo of your receipt</p>
      </div>

      {/* UploadDropzone and CameraCapture are mounted here */}
      <div className="card">
        <p className="text-sm text-grey">
          Upload functionality — dropzone and camera capture components
          to be mounted here.
        </p>
      </div>
    </div>
  )
}
