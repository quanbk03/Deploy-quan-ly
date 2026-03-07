/**
 * AssetDocumentSection.tsx
 *
 * Component hoàn chỉnh cho tab "Hồ sơ thiết bị" tại trang chi tiết thiết bị.
 * Bao gồm:
 * - Danh sách tài liệu với badge trạng thái hiệu lực
 * - Cảnh báo hồ sơ sắp hết hạn / hết hạn / thiếu hồ sơ pháp lý
 * - Upload modal: upload nhiều file, nhập đầy đủ metadata
 * - Xem trước / tải file qua signed URL
 * - Xóa theo quyền (soft delete)
 * - Toast notification, không dùng alert()
 */
import React, { useState, useRef, useCallback } from 'react';
import { format, differenceInDays } from 'date-fns';
import {
    Upload, FileText, Download, Eye, Trash2, RefreshCw,
    AlertCircle, CheckCircle2, Clock, Plus, X, Loader2,
    FileCheck, ShieldCheck, File
} from 'lucide-react';
import type { AssetDocument } from '../types/database';
import {
    docFilesService, DOC_TYPES, getDocTypeLabel, getDocTypeColor,
    getDocValidityStatus, type DocTypeValue, type UploadDocumentMeta,
} from '../services/docFilesService';

// -------------------------------------------------------
// Helpers UI
// -------------------------------------------------------

const DOC_TYPE_BADGE: Record<string, string> = {
    emerald: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    blue: 'bg-blue-50 text-blue-700 border-blue-200',
    violet: 'bg-violet-50 text-violet-700 border-violet-200',
    amber: 'bg-amber-50 text-amber-700 border-amber-200',
    sky: 'bg-sky-50 text-sky-700 border-sky-200',
    orange: 'bg-orange-50 text-orange-700 border-orange-200',
    gray: 'bg-gray-50 text-gray-600 border-gray-200',
    slate: 'bg-slate-50 text-slate-600 border-slate-200',
};

function DocTypeBadge({ docType }: { docType: string }) {
    const color = getDocTypeColor(docType);
    const label = getDocTypeLabel(docType);
    const cls = DOC_TYPE_BADGE[color] ?? DOC_TYPE_BADGE.gray;
    return (
        <span className={`inline-flex items-center px-2 py-0.5 text-xs font-semibold rounded-md border ${cls}`}>
            {label}
        </span>
    );
}

function ValidityBadge({ expiryDate }: { expiryDate: string | null }) {
    const status = getDocValidityStatus(expiryDate);
    if (status === 'no_expiry') return null;
    const days = expiryDate ? differenceInDays(new Date(expiryDate), new Date()) : 0;
    if (status === 'expired') {
        return (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-bold rounded-md bg-red-50 text-red-700 border border-red-200">
                <AlertCircle className="w-3 h-3" /> Hết hạn {Math.abs(days)} ngày
            </span>
        );
    }
    if (status === 'expiring_soon') {
        return (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-bold rounded-md bg-amber-50 text-amber-700 border border-amber-200">
                <Clock className="w-3 h-3" /> Còn {days} ngày
            </span>
        );
    }
    return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200">
            <CheckCircle2 className="w-3 h-3" /> Còn hạn
        </span>
    );
}

function formatFileSize(bytes: number | null): string {
    if (!bytes) return '—';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

// -------------------------------------------------------
// Props
// -------------------------------------------------------

interface Props {
    assetId: string;
    siteId: string;
    assetCode: string;
    declaredStatus?: string | null;
    canUpload: boolean;
    canDelete: boolean;
    documents: AssetDocument[];
    onRefresh: () => void;
    addToast: (msg: string, type: 'success' | 'error' | 'warning' | 'info') => void;
}

// -------------------------------------------------------
// Upload Modal
// -------------------------------------------------------

interface UploadMeta {
    docType: DocTypeValue;
    docNo: string;
    title: string;
    description: string;
    issueDate: string;
    expiryDate: string;
}

function UploadModal({
    assetId, siteId, onClose, onSuccess, addToast
}: {
    assetId: string;
    siteId: string;
    onClose: () => void;
    onSuccess: () => void;
    addToast: Props['addToast'];
}) {
    const dropRef = useRef<HTMLDivElement>(null);
    const [files, setFiles] = useState<File[]>([]);
    const [dragging, setDragging] = useState(false);
    const [uploading, setUploading] = useState(false);
    const [meta, setMeta] = useState<UploadMeta>({
        docType: 'certificate',
        docNo: '',
        title: '',
        description: '',
        issueDate: '',
        expiryDate: '',
    });
    const [errors, setErrors] = useState<string[]>([]);

    const addFiles = (incoming: FileList | null) => {
        if (!incoming) return;
        setFiles(prev => [...prev, ...Array.from(incoming)]);
    };

    const removeFile = (idx: number) =>
        setFiles(prev => prev.filter((_, i) => i !== idx));

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        setDragging(false);
        addFiles(e.dataTransfer.files);
    };

    const handleUpload = async () => {
        setErrors([]);
        if (files.length === 0) {
            setErrors(['Vui lòng chọn ít nhất 1 file.']);
            return;
        }

        setUploading(true);
        const uploadMeta: UploadDocumentMeta = {
            assetId,
            siteId,
            docType: meta.docType,
            docNo: meta.docNo || undefined,
            title: meta.title || undefined,
            description: meta.description || undefined,
            issueDate: meta.issueDate || undefined,
            expiryDate: meta.expiryDate || undefined,
        };

        const results = await docFilesService.uploadFiles(files, uploadMeta);
        const succeeded = results.filter(r => r.success).length;
        const failed = results.filter(r => !r.success);

        if (succeeded > 0) {
            addToast(`Tải lên thành công ${succeeded} file.`, 'success');
            onSuccess();
        }
        if (failed.length > 0) {
            setErrors(failed.map(r => r.error ?? 'Lỗi không xác định'));
            addToast(`${failed.length} file không thể upload.`, 'error');
        }

        setUploading(false);
        if (succeeded > 0 && failed.length === 0) onClose();
    };

    return (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={onClose}>
            <div
                className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto"
                onClick={e => e.stopPropagation()}
            >
                {/* Header */}
                <div className="flex items-center justify-between p-5 border-b border-gray-100">
                    <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                        <Upload className="w-5 h-5 text-primary-500" />
                        Tải lên hồ sơ
                    </h2>
                    <button onClick={onClose} className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors">
                        <X className="w-4 h-4 text-gray-500" />
                    </button>
                </div>

                <div className="p-5 space-y-4">
                    {/* Drop zone */}
                    <div
                        ref={dropRef}
                        onDragOver={e => { e.preventDefault(); setDragging(true); }}
                        onDragLeave={() => setDragging(false)}
                        onDrop={handleDrop}
                        className={`border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-colors ${dragging ? 'border-primary-500 bg-primary-50' : 'border-gray-200 hover:border-primary-400 hover:bg-gray-50'
                            }`}
                        onClick={() => document.getElementById('doc-file-input')?.click()}
                    >
                        <Upload className="w-8 h-8 text-gray-400 mx-auto mb-2" />
                        <p className="text-sm font-medium text-gray-700">Kéo thả file hoặc click để chọn</p>
                        <p className="text-xs text-gray-400 mt-1">PDF, ảnh, Word, Excel — tối đa 50MB mỗi file</p>
                        <input
                            id="doc-file-input"
                            type="file"
                            multiple
                            className="hidden"
                            accept=".pdf,.jpg,.jpeg,.png,.webp,.doc,.docx,.xls,.xlsx"
                            onChange={e => addFiles(e.target.files)}
                        />
                    </div>

                    {/* File list */}
                    {files.length > 0 && (
                        <div className="space-y-1.5">
                            {files.map((f, i) => (
                                <div key={i} className="flex items-center gap-2 p-2.5 bg-gray-50 rounded-lg border border-gray-100">
                                    <File className="w-4 h-4 text-gray-400 shrink-0" />
                                    <span className="text-xs text-gray-700 flex-1 truncate">{f.name}</span>
                                    <span className="text-xs text-gray-400 whitespace-nowrap">{formatFileSize(f.size)}</span>
                                    <button onClick={() => removeFile(i)} className="text-gray-400 hover:text-red-500">
                                        <X className="w-3.5 h-3.5" />
                                    </button>
                                </div>
                            ))}
                        </div>
                    )}

                    {/* Metadata */}
                    <div className="grid grid-cols-2 gap-3">
                        <div className="col-span-2">
                            <label className="block text-xs font-semibold text-gray-700 mb-1">Loại tài liệu *</label>
                            <select
                                value={meta.docType}
                                onChange={e => setMeta(m => ({ ...m, docType: e.target.value as DocTypeValue }))}
                                className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none"
                            >
                                {DOC_TYPES.map(d => (
                                    <option key={d.value} value={d.value}>{d.label}</option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <label className="block text-xs font-semibold text-gray-700 mb-1">Số tài liệu</label>
                            <input
                                type="text"
                                placeholder="VD: CN-2024-001"
                                value={meta.docNo}
                                onChange={e => setMeta(m => ({ ...m, docNo: e.target.value }))}
                                className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:ring-2 focus:ring-primary-500 outline-none"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-semibold text-gray-700 mb-1">Ngày cấp</label>
                            <input
                                type="date"
                                value={meta.issueDate}
                                onChange={e => setMeta(m => ({ ...m, issueDate: e.target.value }))}
                                className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:ring-2 focus:ring-primary-500 outline-none"
                            />
                        </div>
                        <div className="col-span-2">
                            <label className="block text-xs font-semibold text-gray-700 mb-1">Tiêu đề hồ sơ</label>
                            <input
                                type="text"
                                placeholder="VD: Chứng nhận KĐ Bình chứa khí nén 2024"
                                value={meta.title}
                                onChange={e => setMeta(m => ({ ...m, title: e.target.value }))}
                                className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:ring-2 focus:ring-primary-500 outline-none"
                            />
                        </div>
                        <div className="col-span-2">
                            <label className="block text-xs font-semibold text-gray-700 mb-1">Ngày hết hạn</label>
                            <input
                                type="date"
                                value={meta.expiryDate}
                                onChange={e => setMeta(m => ({ ...m, expiryDate: e.target.value }))}
                                className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:ring-2 focus:ring-primary-500 outline-none"
                            />
                        </div>
                        <div className="col-span-2">
                            <label className="block text-xs font-semibold text-gray-700 mb-1">Ghi chú</label>
                            <textarea
                                rows={2}
                                placeholder="Ghi chú thêm..."
                                value={meta.description}
                                onChange={e => setMeta(m => ({ ...m, description: e.target.value }))}
                                className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:ring-2 focus:ring-primary-500 outline-none resize-none"
                            />
                        </div>
                    </div>

                    {/* Errors */}
                    {errors.length > 0 && (
                        <div className="bg-red-50 border border-red-200 rounded-lg p-3 space-y-1">
                            {errors.map((e, i) => (
                                <p key={i} className="text-xs text-red-700 flex items-start gap-1">
                                    <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" /> {e}
                                </p>
                            ))}
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="flex gap-3 p-5 border-t border-gray-100">
                    <button
                        onClick={onClose}
                        disabled={uploading}
                        className="flex-1 px-4 py-2.5 border border-gray-200 text-gray-700 rounded-xl hover:bg-gray-50 transition-colors text-sm font-medium disabled:opacity-50"
                    >
                        Hủy
                    </button>
                    <button
                        onClick={handleUpload}
                        disabled={uploading || files.length === 0}
                        className="flex-1 px-4 py-2.5 bg-primary-600 text-white rounded-xl hover:bg-primary-700 transition-colors text-sm font-semibold disabled:opacity-50 flex items-center justify-center gap-2"
                    >
                        {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                        {uploading ? 'Đang tải lên...' : `Tải lên ${files.length > 0 ? `(${files.length} file)` : ''}`}
                    </button>
                </div>
            </div>
        </div>
    );
}

// -------------------------------------------------------
// Document Row
// -------------------------------------------------------

function DocumentRow({
    doc, canDelete, addToast, onDelete
}: {
    doc: AssetDocument;
    canDelete: boolean;
    addToast: Props['addToast'];
    onDelete: (id: string) => void;
}) {
    const [actionLoading, setActionLoading] = useState<'preview' | 'download' | 'delete' | null>(null);

    const handlePreview = async () => {
        if (!doc.file_path || doc.file_path === '#') {
            addToast('File chưa được upload lên Storage. Chức năng xem trước chưa khả dụng.', 'warning');
            return;
        }
        setActionLoading('preview');
        try {
            await docFilesService.previewFile(doc.file_path);
        } catch (err) {
            addToast((err as Error).message, 'error');
        } finally {
            setActionLoading(null);
        }
    };

    const handleDownload = async () => {
        if (!doc.file_path || doc.file_path === '#') {
            addToast('File chưa được upload lên Storage.', 'warning');
            return;
        }
        setActionLoading('download');
        try {
            await docFilesService.downloadFile(doc.file_path, doc.original_file_name ?? doc.file_name ?? 'file');
        } catch (err) {
            addToast((err as Error).message, 'error');
        } finally {
            setActionLoading(null);
        }
    };

    const handleDelete = async () => {
        if (!canDelete) return;
        if (!window.confirm(`Bạn có chắc muốn xóa tài liệu "${doc.title ?? doc.file_name}"?`)) return;
        setActionLoading('delete');
        try {
            await docFilesService.softDelete(doc.id);
            onDelete(doc.id);
            addToast('Đã xóa tài liệu.', 'success');
        } catch (err) {
            addToast((err as Error).message, 'error');
        } finally {
            setActionLoading(null);
        }
    };

    const isPlaceholder = !doc.file_path || doc.file_path === '#';

    return (
        <div className="flex items-start gap-3 p-4 bg-white border border-gray-100 rounded-xl hover:border-gray-200 transition-colors group">
            {/* Icon */}
            <div className="p-2 bg-gray-50 rounded-lg shrink-0">
                {doc.mime_type?.includes('pdf') ? (
                    <FileText className="w-5 h-5 text-red-500" />
                ) : doc.mime_type?.includes('image') ? (
                    <Eye className="w-5 h-5 text-blue-500" />
                ) : (
                    <File className="w-5 h-5 text-gray-400" />
                )}
            </div>

            {/* Info */}
            <div className="flex-1 min-w-0">
                <div className="flex flex-wrap items-center gap-1.5 mb-1">
                    <DocTypeBadge docType={doc.doc_type} />
                    <ValidityBadge expiryDate={doc.expiry_date} />
                    {isPlaceholder && (
                        <span className="text-xs text-gray-400 italic">(chưa có file)</span>
                    )}
                </div>
                <p className="text-sm font-semibold text-gray-800 truncate">
                    {doc.title ?? doc.file_name ?? '—'}
                </p>
                <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-1 text-xs text-gray-500">
                    {doc.doc_no && <span>Số: {doc.doc_no}</span>}
                    {doc.issue_date && <span>Cấp: {format(new Date(doc.issue_date), 'dd/MM/yyyy')}</span>}
                    {doc.expiry_date && <span>HH: {format(new Date(doc.expiry_date), 'dd/MM/yyyy')}</span>}
                    <span>{formatFileSize(doc.file_size)}</span>
                    <span>{format(new Date(doc.created_at), 'dd/MM/yyyy HH:mm')}</span>
                </div>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-1 shrink-0">
                <button
                    onClick={handlePreview}
                    disabled={!!actionLoading}
                    title="Xem trước"
                    className="p-1.5 text-gray-400 hover:text-primary-600 hover:bg-primary-50 rounded-lg transition-colors disabled:opacity-50"
                >
                    {actionLoading === 'preview' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Eye className="w-4 h-4" />}
                </button>
                <button
                    onClick={handleDownload}
                    disabled={!!actionLoading}
                    title="Tải xuống"
                    className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors disabled:opacity-50"
                >
                    {actionLoading === 'download' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                </button>
                {canDelete && (
                    <button
                        onClick={handleDelete}
                        disabled={!!actionLoading}
                        title="Xóa tài liệu"
                        className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50"
                    >
                        {actionLoading === 'delete' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                    </button>
                )}
            </div>
        </div>
    );
}

// -------------------------------------------------------
// Main Component
// -------------------------------------------------------

export const AssetDocumentSection: React.FC<Props> = ({
    assetId, siteId, assetCode, declaredStatus,
    canUpload, canDelete,
    documents: initialDocs,
    onRefresh, addToast,
}) => {
    const [docs, setDocs] = useState<AssetDocument[]>(initialDocs);
    const [showUpload, setShowUpload] = useState(false);
    const [filterType, setFilterType] = useState<string>('all');
    const [refreshing, setRefreshing] = useState(false);
    const [showExpiredOnly, setShowExpiredOnly] = useState(false);

    // Sync khi props thay đổi
    React.useEffect(() => { setDocs(initialDocs); }, [initialDocs]);

    const handleRefresh = async () => {
        setRefreshing(true);
        try {
            const fresh = await docFilesService.listByAsset(assetId);
            setDocs(fresh);
        } catch {
            addToast('Không thể tải lại danh sách hồ sơ.', 'error');
        } finally {
            setRefreshing(false);
        }
    };

    const handleDelete = useCallback((id: string) => {
        setDocs(prev => prev.filter(d => d.id !== id));
    }, []);

    const handleUploadSuccess = () => {
        handleRefresh();
        onRefresh();
    };

    // Filters
    const filteredDocs = docs.filter(d => {
        if (filterType !== 'all' && d.doc_type !== filterType) return false;
        if (showExpiredOnly) {
            const status = getDocValidityStatus(d.expiry_date);
            if (status !== 'expired' && status !== 'expiring_soon') return false;
        }
        return true;
    });

    // Alerts
    const hasExpired = docs.some(d => getDocValidityStatus(d.expiry_date) === 'expired');
    const hasExpiringSoon = docs.some(d => getDocValidityStatus(d.expiry_date) === 'expiring_soon');
    const needsLegalDoc = declaredStatus === 'declared' &&
        !docs.some(d => d.doc_type === 'declaration_letter' || d.doc_type === 'legal_confirmation');

    return (
        <div className="space-y-4">
            {/* Alert banners */}
            {hasExpired && (
                <div className="flex items-start gap-3 p-3 bg-red-50 border border-red-200 rounded-xl">
                    <AlertCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
                    <p className="text-sm text-red-700 font-medium">
                        Có tài liệu đã <strong>hết hạn hiệu lực</strong>. Cần cập nhật ngay để đảm bảo tuân thủ.
                    </p>
                </div>
            )}
            {!hasExpired && hasExpiringSoon && (
                <div className="flex items-start gap-3 p-3 bg-amber-50 border border-amber-200 rounded-xl">
                    <Clock className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                    <p className="text-sm text-amber-700 font-medium">
                        Có tài liệu <strong>sắp hết hạn</strong>. Lên kế hoạch gia hạn hoặc thay thế.
                    </p>
                </div>
            )}
            {needsLegalDoc && (
                <div className="flex items-start gap-3 p-3 bg-violet-50 border border-violet-200 rounded-xl">
                    <ShieldCheck className="w-4 h-4 text-violet-500 shrink-0 mt-0.5" />
                    <p className="text-sm text-violet-700 font-medium">
                        Thiết bị có trạng thái <strong>Đã khai báo</strong> nhưng chưa có hồ sơ khai báo/pháp lý đính kèm.
                    </p>
                </div>
            )}

            {/* Toolbar */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                <div className="flex items-center gap-2 flex-wrap">
                    <select
                        value={filterType}
                        onChange={e => setFilterType(e.target.value)}
                        className="text-sm border border-gray-200 rounded-lg px-3 py-1.5 focus:ring-2 focus:ring-primary-500 outline-none"
                    >
                        <option value="all">Tất cả loại ({docs.length})</option>
                        {DOC_TYPES.map(d => {
                            const count = docs.filter(x => x.doc_type === d.value).length;
                            if (count === 0) return null;
                            return <option key={d.value} value={d.value}>{d.label} ({count})</option>;
                        })}
                    </select>
                    <button
                        onClick={() => setShowExpiredOnly(v => !v)}
                        className={`text-xs px-3 py-1.5 rounded-lg border font-medium transition-colors ${showExpiredOnly
                            ? 'bg-amber-50 text-amber-700 border-amber-200'
                            : 'border-gray-200 text-gray-500 hover:bg-gray-50'
                            }`}
                    >
                        {hasExpired || hasExpiringSoon ? '⚠ Sắp/Đã hết hạn' : 'Hết hạn'}
                    </button>
                </div>

                <div className="flex items-center gap-2">
                    <button
                        onClick={handleRefresh}
                        disabled={refreshing}
                        className="p-2 border border-gray-200 text-gray-500 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
                        title="Làm mới"
                    >
                        <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
                    </button>
                    {canUpload && (
                        <button
                            onClick={() => setShowUpload(true)}
                            className="flex items-center gap-1.5 px-4 py-2 bg-primary-600 text-white rounded-xl hover:bg-primary-700 transition-colors text-sm font-semibold shadow-sm"
                        >
                            <Plus className="w-4 h-4" /> Thêm hồ sơ
                        </button>
                    )}
                </div>
            </div>

            {/* Document list */}
            {filteredDocs.length === 0 ? (
                <div className="text-center py-12 bg-gray-50 rounded-xl border border-dashed border-gray-200">
                    <FileCheck className="w-10 h-10 text-gray-300 mx-auto mb-3" />
                    <p className="text-sm font-medium text-gray-500">
                        {filterType !== 'all' || showExpiredOnly
                            ? 'Không có hồ sơ nào khớp bộ lọc.'
                            : 'Chưa có hồ sơ nào. Nhấn "Thêm hồ sơ" để tải lên tài liệu đầu tiên.'}
                    </p>
                    {canUpload && docs.length === 0 && (
                        <button
                            onClick={() => setShowUpload(true)}
                            className="mt-3 inline-flex items-center gap-1.5 px-4 py-2 text-primary-600 hover:text-primary-700 font-medium text-sm"
                        >
                            <Plus className="w-4 h-4" /> Tải lên hồ sơ đầu tiên
                        </button>
                    )}
                </div>
            ) : (
                <div className="space-y-2">
                    {filteredDocs.map(doc => (
                        <DocumentRow
                            key={doc.id}
                            doc={doc}
                            canDelete={canDelete}
                            addToast={addToast}
                            onDelete={handleDelete}
                        />
                    ))}
                </div>
            )}

            {/* Upload Modal */}
            {showUpload && (
                <UploadModal
                    assetId={assetId}
                    siteId={siteId}
                    onClose={() => setShowUpload(false)}
                    onSuccess={handleUploadSuccess}
                    addToast={addToast}
                />
            )}
        </div>
    );
};
