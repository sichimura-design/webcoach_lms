export type DataType = 'courses' | 'enrollments' | 'categories' | 'moodle-courses' | 'users' | 'ai-applications' | 'avatars' | 'coach-mapping';

export interface UploadHistory {
  id: string;
  dataType: DataType;
  filename: string;
  uploadedAt: Date;
  status: 'success' | 'failed' | 'processing';
  recordsProcessed: number;
  recordsFailed: number;
  errorMessage?: string;
}

export interface UploadResult {
  success: boolean;
  recordsProcessed: number;
  recordsFailed: number;
  errors?: Array<{
    row: number;
    message: string;
  }>;
  message?: string;
}

export interface CsvUploadRequest {
  dataType: DataType;
  file: File;
}
