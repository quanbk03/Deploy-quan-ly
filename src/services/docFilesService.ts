/**
 * docFilesService.ts — Service layer cho hồ sơ tài liệu thiết bị
 *
 * Tích hợp Supabase Storage (bucket: equipment-docs) + bảng asset_documents.
 * - Upload thực tế lên Storage với signed path
 * - Signed URL tải / preview (không có public link trực tiếp)
 * - Soft delete (ghi deleted_at, không xóa file Storage ngay)
 * - Error messages tiếng Việt
 */
import { supabase } from '../lib/supabase';
import type { AssetDocument } from '../types/database';

// -------------------------------------------------------
// Types
// -------------------------------------------------------

export const STORAGE_BUCKET = 'equipment-docs';

export const DOC_TYPES = [
    { value: 'certificate', label: 'Chứng nhận KĐ', color: 'emerald' },
    { value: 'inspection_report', label: 'Biên bản KĐ', color: 'blue' },
    { value: 'legal_confirmation', label: 'Xác nhận pháp lý', color: 'violet' },
    { value: 'declaration_letter', label: 'Hồ sơ khai báo', color: 'amber' },
    { value: 'maintenance_record', label: 'Biên bản bảo trì', color: 'sky' },
    { value: 'checklist', label: 'Checklist kiểm tra', color: 'orange' },
    { value: 'invoice', label: 'Hóa đơn / Hợp đồng', color: 'gray' },
    { value: 'other', label: 'Tài liệu khác', color: 'slate' },
] as const;

export type DocTypeValue = typeof DOC_TYPES[number]['value'];

export function getDocTypeLabel(value: string): string {
    return DOC_TYPES.find(d => d.value === value)?.label ?? value;
}

export function getDocTypeColor(value: string): string {
    return DOC_TYPES.find(d => d.value === value)?.color ?? 'gray';
}

/** Trạng thái hiệu lực của tài liệu dựa trên expiry_date */
export type DocValidityStatus = 'valid' | 'expiring_soon' | 'expired' | 'no_expiry';

export function getDocValidityStatus(expiryDate: string | null, warnDays = 30): DocValidityStatus {
    if (!expiryDate) return 'no_expiry';
    const now = new Date();
    const exp = new Date(expiryDate);
    const diffDays = Math.floor((exp.getTime() - now.getTime()) / 86_400_000);
    if (diffDays < 0) return 'expired';
    if (diffDays <= warnDays) return 'expiring_soon';
    return 'valid';
}

export interface UploadDocumentMeta {
    assetId: string;
    siteId: string;
    docType: DocTypeValue;
    docNo?: string;
    title?: string;
    description?: string;
    issueDate?: string;
    expiryDate?: string;
    eventId?: string | null;
}

export interface UploadResult {
    success: boolean;
    document?: AssetDocument;
    error?: string;
}

// Giới hạn file
const MAX_FILE_SIZE_MB = 50;
const ALLOWED_MIME_TYPES = [
    'application/pdf',
    'image/jpeg', 'image/png', 'image/webp', 'image/gif',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
];

function validateFile(file: File): string | null {
    if (file.size > MAX_FILE_SIZE_MB * 1024 * 1024) {
        return `File "${file.name}" vượt quá ${MAX_FILE_SIZE_MB}MB.`;
    }
    if (!ALLOWED_MIME_TYPES.includes(file.type)) {
        return `Loại file "${file.name}" không được hỗ trợ. Chỉ chấp nhận PDF, ảnh, Word, Excel.`;
    }
    return null;
}

// -------------------------------------------------------
// Service
// -------------------------------------------------------

export const docFilesService = {

    /** Lấy danh sách tài liệu của thiết bị (chỉ active, chưa bị soft-delete) */
    async listByAsset(assetId: string): Promise<AssetDocument[]> {
        try {
            const { data, error } = await supabase
                .from('asset_documents')
                .select('*')
                .eq('asset_id', assetId)
                .is('deleted_at', null)
                .order('created_at', { ascending: false });
            if (error) throw error;
            return data as AssetDocument[];
        } catch (err: unknown) {
            console.error('Lỗi lấy danh sách hồ sơ:', err);
            throw new Error('Không thể tải danh sách hồ sơ thiết bị.');
        }
    },

    /**
     * Upload một file lên Supabase Storage và lưu metadata vào asset_documents.
     * Path: {siteId}/{assetId}/{timestamp}_{fileName}
     */
    async uploadFile(file: File, meta: UploadDocumentMeta): Promise<UploadResult> {
        // Validate
        const validationError = validateFile(file);
        if (validationError) return { success: false, error: validationError };

        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return { success: false, error: 'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.' };

        const timestamp = Date.now();
        const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
        const filePath = `${meta.siteId}/${meta.assetId}/${timestamp}_${safeName}`;

        try {
            // 1. Upload lên Storage
            const { error: storageError } = await supabase.storage
                .from(STORAGE_BUCKET)
                .upload(filePath, file, {
                    cacheControl: '3600',
                    upsert: false,
                    contentType: file.type,
                });
            if (storageError) throw new Error(`Lỗi upload file: ${storageError.message}`);

            // 2. Lưu metadata vào asset_documents
            const { data: doc, error: dbError } = await supabase
                .from('asset_documents')
                .insert([{
                    asset_id: meta.assetId,
                    event_id: meta.eventId ?? null,
                    site_id: meta.siteId,
                    doc_type: meta.docType,
                    doc_no: meta.docNo ?? null,
                    title: meta.title || file.name,
                    description: meta.description ?? null,
                    original_file_name: file.name,
                    file_name: safeName,
                    file_path: filePath,
                    file_size: file.size,
                    mime_type: file.type,
                    issue_date: meta.issueDate ?? null,
                    expiry_date: meta.expiryDate ?? null,
                    uploaded_by: user.id,
                    deleted_at: null,
                }])
                .select()
                .single();

            if (dbError) {
                // Nếu ghi DB fail → xóa file vừa upload để tránh orphan
                await supabase.storage.from(STORAGE_BUCKET).remove([filePath]);
                throw new Error(`Lỗi lưu metadata: ${dbError.message}`);
            }

            return { success: true, document: doc as AssetDocument };
        } catch (err: unknown) {
            console.error('Lỗi upload hồ sơ:', err);
            return { success: false, error: (err as Error).message || 'Lỗi không xác định khi upload.' };
        }
    },

    /** Upload nhiều file cùng metadata */
    async uploadFiles(files: File[], meta: UploadDocumentMeta): Promise<UploadResult[]> {
        return Promise.all(files.map(f => this.uploadFile(f, meta)));
    },

    /**
     * Lấy signed URL để preview hoặc tải file (hết hạn sau 60 phút).
     * Không trả về public URL để đảm bảo access control.
     */
    async getSignedUrl(filePath: string, expiresInSeconds = 3600): Promise<string | null> {
        try {
            const { data, error } = await supabase.storage
                .from(STORAGE_BUCKET)
                .createSignedUrl(filePath, expiresInSeconds);
            if (error) throw error;
            return data.signedUrl;
        } catch (err) {
            console.error('Lỗi tạo signed URL:', err);
            return null;
        }
    },

    /**
     * Mở file trong tab mới (preview).
     * Tự lấy signed URL → không cần public bucket.
     */
    async previewFile(filePath: string): Promise<void> {
        const url = await this.getSignedUrl(filePath);
        if (!url) throw new Error('Không thể tạo link xem trước. Kiểm tra quyền truy cập.');
        window.open(url, '_blank', 'noopener,noreferrer');
    },

    /**
     * Tải file xuống máy.
     */
    async downloadFile(filePath: string, originalName: string): Promise<void> {
        const url = await this.getSignedUrl(filePath, 300); // 5 phút đủ để tải
        if (!url) throw new Error('Không thể tạo link tải file. Kiểm tra quyền truy cập.');
        const a = document.createElement('a');
        a.href = url;
        a.download = originalName;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
    },

    /**
     * Soft delete: ghi deleted_at vào DB, không xóa file Storage ngay.
     * Admin có thể xóa Storage riêng sau.
     * Ghi lại deleted_by cho audit trail.
     */
    async softDelete(documentId: string): Promise<void> {
        const { data: { user } } = await supabase.auth.getUser();
        const { error } = await supabase
            .from('asset_documents')
            .update({
                deleted_at: new Date().toISOString(),
                deleted_by: user?.id ?? null,
            })
            .eq('id', documentId);
        if (error) throw new Error(`Không thể xóa tài liệu: ${error.message}`);
    },

    /**
     * Hard delete: xóa hẳn khỏi Storage và DB.
     * Chỉ dùng cho admin.
     */
    async hardDelete(documentId: string, filePath: string): Promise<void> {
        try {
            await supabase.storage.from(STORAGE_BUCKET).remove([filePath]);
        } catch {
            // Nếu Storage fail vẫn tiếp tục xóa DB record
            console.warn('Xóa file Storage thất bại, tiếp tục xóa DB record.');
        }
        const { error } = await supabase
            .from('asset_documents')
            .delete()
            .eq('id', documentId);
        if (error) throw new Error(`Không thể xóa hồ sơ: ${error.message}`);
    },
};
