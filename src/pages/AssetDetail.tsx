import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { assetsService } from '../services/assetsService';
import { eventsService } from '../services/eventsService';
import { docFilesService } from '../services/docFilesService';
import { AssetDocumentSection } from '../components/AssetDocumentSection';
import type { Asset, AssetEvent, AssetDocument } from '../types/database';
import { ArrowLeft, Calendar, Tag, Wrench, FileText, Activity, ShieldAlert, Loader2, Plus, CheckCircle, Copy, Check } from 'lucide-react';
import { format } from 'date-fns';
import { useAuth } from '../contexts/AuthContext';
import { useToast, ToastContainer } from '../components/Toast';

export const AssetDetail: React.FC = () => {
    const { id: assetCode } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const { profile } = useAuth();
    const { toasts, addToast, dismiss } = useToast();

    const [asset, setAsset] = useState<Asset | null>(null);
    const [events, setEvents] = useState<AssetEvent[]>([]);
    const [documents, setDocuments] = useState<AssetDocument[]>([]);
    const [loading, setLoading] = useState(true);
    const [actionLoading, setActionLoading] = useState(false);
    const [copiedId, setCopiedId] = useState<string | null>(null);

    useEffect(() => {
        if (assetCode) {
            fetchAssetDetails(assetCode);
        }
    }, [assetCode]);

    const fetchAssetDetails = async (code: string) => {
        try {
            const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-/i.test(code);
            const assetData = isUUID
                ? await assetsService.getById(code)
                : await assetsService.getByCode(code);
            const [eventsData, docsData] = await Promise.all([
                eventsService.listByAsset(assetData.id),
                docFilesService.listByAsset(assetData.id),
            ]);
            setAsset(assetData);
            setEvents(eventsData);
            setDocuments(docsData);
        } catch (error) {
            console.error(error instanceof Error ? error.message : String(error));
            addToast('Không thể tải thông tin thiết bị.', 'error');
        } finally {
            setLoading(false);
        }
    };

    const handleCreatePlannedEvent = async () => {
        if (!asset) return;
        setActionLoading(true);
        try {
            await eventsService.createPlanned(
                asset.id,
                new Date().toISOString().split('T')[0],
                asset.interval_months || 6,
                profile?.id
            );
            await fetchAssetDetails(assetCode!);
            addToast('Tạo kế hoạch kiểm định thành công!', 'success');
        } catch (error) {
            addToast(error instanceof Error ? error.message : String(error), 'error');
        } finally {
            setActionLoading(false);
        }
    };

    const handleVerifyEvent = async (eventId: string) => {
        setActionLoading(true);
        try {
            await eventsService.verify(eventId);
            await fetchAssetDetails(assetCode!);
            addToast('Xác nhận kết quả kiểm định thành công!', 'success');
        } catch (error) {
            addToast(error instanceof Error ? error.message : String(error), 'error');
        } finally {
            setActionLoading(false);
        }
    };

    const handleCopy = (text: string, id: string) => {
        if (!text) return;
        navigator.clipboard.writeText(text);
        setCopiedId(id);
        setTimeout(() => setCopiedId(null), 2000);
    };

    if (loading) {
        return (
            <div className="flex justify-center items-center h-64">
                <Loader2 className="w-8 h-8 animate-spin text-primary-600" />
            </div>
        );
    }

    if (!asset) {
        return (
            <div className="text-center py-12">
                <ShieldAlert className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900">Thiết bị không tồn tại</h3>
                <button onClick={() => navigate('/thiet-bi')} className="mt-4 text-primary-600 hover:text-primary-700 font-medium">
                    Quay lại danh sách
                </button>
            </div>
        );
    }

    const canEditEvents = profile?.role === 'admin' || profile?.role === 'hse' || profile?.role === 'engineering';
    const canVerifyEvents = profile?.role === 'admin' || profile?.role === 'hse';
    const canUploadDocs = profile?.role === 'admin' || profile?.role === 'hse' || profile?.role === 'engineering';
    const canDeleteDocs = profile?.role === 'admin' || profile?.role === 'hse';

    const latestVerifiedEvent = events
        .filter(e => e.status === 'verified')
        .sort((a, b) => new Date(b.performed_date || b.created_at).getTime() - new Date(a.performed_date || a.created_at).getTime())[0];

    return (
        <div className="space-y-6 max-w-7xl mx-auto px-4 sm:px-6 pb-20">
            <ToastContainer toasts={toasts} onDismiss={dismiss} />
            <button
                onClick={() => navigate('/thiet-bi')}
                className="inline-flex items-center text-sm font-medium text-gray-500 hover:text-gray-900 transition-colors"
            >
                <ArrowLeft className="w-4 h-4 mr-1" /> Quay lại Danh sách
            </button>

            {/* Header Card */}
            <div className="bg-white rounded-3xl p-6 sm:p-8 shadow-sm border border-gray-100 flex flex-col md:flex-row justify-between items-start md:items-center gap-6 relative overflow-hidden">
                <div className="absolute top-0 right-0 w-64 h-64 bg-gradient-to-br from-primary-50 to-white rounded-bl-full opacity-50 pointer-events-none"></div>
                <div className="z-10 w-full flex flex-col md:flex-row justify-between items-start md:items-center">
                    <div>
                        <div className="flex flex-wrap items-center gap-2 mb-3">
                            <span className="px-3 py-1 bg-primary-50 text-primary-700 text-xs font-bold uppercase rounded-md tracking-wide border border-primary-100">
                                {asset.asset_code}
                            </span>
                            {asset.status === 'in_service' && (
                                <span className="px-3 py-1 bg-success-50 text-success-700 border border-success-200 text-xs font-bold uppercase rounded-md tracking-wide">
                                    Đang Hoạt động
                                </span>
                            )}
                            {asset.status === 'locked' && (
                                <span className="px-3 py-1 bg-danger-50 text-danger-700 border border-danger-200 text-xs font-bold uppercase rounded-md tracking-wide flex items-center">
                                    <ShieldAlert className="w-3 h-3 mr-1" /> Đã Khóa
                                </span>
                            )}
                        </div>
                        <h1 className="text-3xl font-bold text-gray-900 mb-2">{asset.equipment_name}</h1>
                        <p className="text-gray-500 max-w-2xl text-sm leading-relaxed">{asset.description_raw || 'Chưa có mô tả'}</p>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Info Sidebar */}
                <div className="space-y-6 lg:col-span-1 border-r border-gray-100 pr-0 lg:pr-6">
                    <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 h-full">
                        <h3 className="text-lg font-bold text-gray-900 mb-6 flex items-center border-b border-gray-100 pb-4">
                            <Tag className="w-5 h-5 mr-2 text-primary-500" /> Hồ Sơ Thiết Bị
                        </h3>

                        <div className="space-y-5">
                            <div className="grid grid-cols-2 gap-4">
                                <div className="flex flex-col">
                                    <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Vị trí sử dụng</span>
                                    <span className="text-gray-900 font-bold">{asset.location || asset.site_id}</span>
                                </div>
                                <div className="flex flex-col">
                                    <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Loại Thiết bị</span>
                                    <span className="text-gray-900 font-bold">{asset.equipment_category || asset.equipment_type}</span>
                                </div>
                            </div>

                            <div className="flex flex-col">
                                <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Tên Thiết bị</span>
                                <span className="text-gray-900 font-bold text-base">{asset.equipment_name}</span>
                            </div>

                            <div className="flex flex-col">
                                <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Số serial / Mã hiệu</span>
                                <span className="text-gray-900 font-mono font-bold bg-gray-50 px-2 py-1 rounded inline-block w-fit">
                                    {asset.serial_or_model || asset.serial || asset.model || <span className="text-gray-400 font-sans italic">-</span>}
                                </span>
                            </div>

                            <div className="flex flex-col bg-gray-50 p-3 rounded-xl border border-gray-100 relative group">
                                <div className="flex justify-between items-start mb-1.5">
                                    <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">Miêu tả chi tiết</span>
                                    {asset.description_raw && (
                                        <button
                                            onClick={() => handleCopy(asset.description_raw || '', 'desc')}
                                            className="text-gray-400 hover:text-primary-600 transition-colors"
                                            title="Copy miêu tả"
                                        >
                                            {copiedId === 'desc' ? <Check className="w-4 h-4 text-success-500" /> : <Copy className="w-4 h-4" />}
                                        </button>
                                    )}
                                </div>
                                <div className="text-gray-700 text-sm whitespace-pre-line">
                                    {asset.description_raw || <span className="text-gray-400 italic">Chưa có mô tả</span>}
                                </div>
                            </div>

                            <hr className="border-gray-100" />

                            <div className="flex flex-col">
                                <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Chu kỳ Kiểm định</span>
                                <span className="text-gray-900 font-bold">
                                    {asset.interval_months
                                        ? <span className="bg-primary-50 text-primary-700 px-2 py-0.5 rounded border border-primary-100">{asset.interval_months} tháng</span>
                                        : <span className="text-gray-400 italic bg-gray-50 px-2 py-0.5 rounded border border-gray-100">- Tự động -</span>}
                                </span>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div className="flex flex-col">
                                    <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Ngày KĐ gần nhất</span>
                                    <span className="text-gray-900 font-bold">
                                        {latestVerifiedEvent?.performed_date
                                            ? format(new Date(latestVerifiedEvent.performed_date), 'dd/MM/yyyy')
                                            : (asset.last_inspection_date ? format(new Date(asset.last_inspection_date), 'dd/MM/yyyy') : '-')}
                                    </span>
                                </div>
                                <div className="flex flex-col">
                                    <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Hạn KĐ Tiếp theo</span>
                                    <span className={`font-bold text-lg flex items-center ${!asset.next_due_date ? 'text-gray-900' :
                                        new Date(asset.next_due_date) < new Date() ? 'text-danger-600' : 'text-primary-600'}`}>
                                        <Calendar className="w-4 h-4 mr-1" />
                                        {asset.next_due_date ? format(new Date(asset.next_due_date), 'dd/MM/yyyy') : '-'}
                                    </span>
                                </div>
                            </div>

                            <div className="bg-blue-50/50 p-4 rounded-xl border border-blue-100">
                                <h4 className="text-xs font-bold text-blue-800 uppercase tracking-wider mb-3 flex items-center">
                                    <CheckCircle className="w-4 h-4 mr-1.5 text-blue-500" /> Dữ liệu Lần KĐ cuối
                                </h4>
                                <div className="grid grid-cols-2 gap-2 text-sm">
                                    <span className="text-gray-500">Số Tem KĐ:</span>
                                    <strong className="text-gray-900 font-mono">{latestVerifiedEvent?.stamp_no || asset.stamp_no || '-'}</strong>
                                    <span className="text-gray-500">Đơn vị KĐ:</span>
                                    <strong className="text-gray-900 text-xs">{latestVerifiedEvent?.agency || asset.inspection_agency || '-'}</strong>
                                </div>
                            </div>

                            <hr className="border-gray-100" />

                            <div className="grid grid-cols-2 gap-4">
                                <div className="flex flex-col">
                                    <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Khai báo Sở</span>
                                    {asset.declared_status === 'declared' ? (
                                        <span className="bg-success-50 border border-success-200 text-success-700 px-2 py-0.5 rounded text-xs font-bold w-fit">Đã Khai Báo</span>
                                    ) : asset.declared_status === 'not_declared' ? (
                                        <span className="bg-warning-50 border border-warning-200 text-warning-700 px-2 py-0.5 rounded text-xs font-bold w-fit">Chưa Khai Báo</span>
                                    ) : (
                                        <span className="bg-gray-100 border border-gray-200 text-gray-600 px-2 py-0.5 rounded text-xs font-medium w-fit">Không Yêu Cầu</span>
                                    )}
                                </div>
                                <div className="flex flex-col">
                                    <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Số CV Xác nhận</span>
                                    {asset.declaration_doc_no ? (
                                        <span className="text-gray-900 font-mono font-bold bg-gray-50 px-2 py-1 rounded inline-block w-fit text-sm">{asset.declaration_doc_no}</span>
                                    ) : (
                                        <span className="text-gray-400 italic text-sm">-</span>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Main Content */}
                <div className="lg:col-span-2 space-y-6">

                    {/* Kế hoạch & Lịch sử Kiểm định */}
                    <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
                        <div className="flex justify-between items-center mb-6 border-b border-gray-100 pb-4">
                            <h3 className="text-lg font-bold text-gray-900 flex items-center">
                                <Activity className="w-5 h-5 mr-2 text-primary-500" /> Kế hoạch &amp; Lịch sử Kiểm định
                            </h3>
                            {canEditEvents && (
                                <button
                                    onClick={handleCreatePlannedEvent}
                                    disabled={actionLoading}
                                    className="text-sm bg-primary-600 border border-transparent text-white shadow-sm hover:shadow-md hover:bg-primary-700 px-4 py-2.5 rounded-xl font-bold transition-all disabled:opacity-50 flex items-center"
                                >
                                    {actionLoading ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> : <Plus className="w-4 h-4 mr-1.5" />} Tạo Kế hoạch KĐ
                                </button>
                            )}
                        </div>

                        {events.length > 0 ? (
                            <div className="space-y-4 relative before:absolute before:inset-0 before:ml-5 before:-translate-x-px md:before:mx-auto md:before:translate-x-0 before:h-full before:w-0.5 before:bg-gradient-to-b before:from-transparent before:via-gray-200 before:to-transparent">
                                {events.map((evt) => (
                                    <div key={evt.id} className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group is-active">
                                        <div className={`flex items-center justify-center w-10 h-10 rounded-full border-4 border-white shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2 shadow-sm z-10 ${evt.status === 'verified' ? 'bg-success-500 text-white' : evt.status === 'done' ? 'bg-primary-500 text-white' : 'bg-gray-200 text-gray-500'}`}>
                                            {evt.status === 'verified' ? <CheckCircle className="w-5 h-5" /> : <Wrench className="w-5 h-5" />}
                                        </div>
                                        <div className="w-[calc(100%-4rem)] md:w-[calc(50%-2.5rem)] bg-white p-4 rounded-xl border border-gray-100 shadow-sm group-hover:shadow-md group-hover:border-primary-200 transition-all">
                                            <div className="flex items-center justify-between mb-2">
                                                <span className={`text-[10px] px-2 py-0.5 rounded uppercase font-bold tracking-wide border ${evt.status === 'verified' ? 'bg-success-50 text-success-700 border-success-200' :
                                                    evt.status === 'done' ? 'bg-info-50 text-info-700 border-info-200' :
                                                        'bg-warning-50 text-warning-700 border-warning-200'
                                                    }`}>
                                                    {evt.status === 'verified' ? 'Đã duyệt' : evt.status === 'done' ? 'Đã hoàn thành' : 'Đang Kế hoạch'}
                                                </span>
                                                <time className="text-xs font-bold text-gray-400">
                                                    {evt.performed_date
                                                        ? format(new Date(evt.performed_date), 'dd/MM/yyyy')
                                                        : evt.planned_date
                                                            ? `Dự kiến: ${format(new Date(evt.planned_date), 'dd/MM/yyyy')}`
                                                            : 'Chưa xếp lịch'}
                                                </time>
                                            </div>
                                            <h4 className="font-bold text-gray-900 mb-1">
                                                {evt.event_type === 'periodic' ? 'KĐ Định kỳ' : evt.event_type === 'planned' ? 'KĐ Kế hoạch' : evt.event_type}
                                            </h4>
                                            {evt.notes && <div className="text-sm text-gray-500 bg-gray-50 p-2 rounded-lg mt-2">{evt.notes}</div>}
                                            <div className="flex flex-wrap gap-2 mt-3 pt-3 border-t border-gray-50">
                                                {evt.status === 'planned' && canEditEvents && (
                                                    <button className="text-xs px-3 py-1.5 border border-primary-200 text-primary-700 bg-primary-50 rounded-lg font-bold hover:bg-primary-100">
                                                        Sửa BC/Kết quả
                                                    </button>
                                                )}
                                                {evt.status === 'done' && canVerifyEvents && (
                                                    <button
                                                        onClick={() => handleVerifyEvent(evt.id)}
                                                        disabled={actionLoading}
                                                        className="flex items-center justify-center text-xs px-3 py-1.5 bg-success-600 text-white rounded-lg font-bold shadow-sm hover:shadow hover:bg-success-700 transition-all disabled:opacity-50"
                                                    >
                                                        <CheckCircle className="w-3.5 h-3.5 mr-1" /> Duyệt Kết Quả
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="text-center py-10 text-gray-500 text-sm bg-gray-50 rounded-xl border border-dashed border-gray-200">
                                Chưa có sự kiện nào được ghi nhận
                            </div>
                        )}
                    </div>

                    {/* Hồ sơ Tài liệu */}
                    <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
                        <h3 className="text-lg font-bold text-gray-900 mb-6 flex items-center border-b border-gray-100 pb-4">
                            <FileText className="w-5 h-5 mr-2 text-primary-500" /> Hồ sơ Tài liệu
                            {documents.length > 0 && (
                                <span className="ml-2 text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full font-normal">
                                    {documents.length} tài liệu
                                </span>
                            )}
                        </h3>
                        <AssetDocumentSection
                            assetId={asset.id}
                            siteId={asset.site_id}
                            assetCode={asset.asset_code}
                            declaredStatus={asset.declared_status}
                            canUpload={canUploadDocs}
                            canDelete={canDeleteDocs}
                            documents={documents}
                            onRefresh={() => fetchAssetDetails(assetCode!)}
                            addToast={addToast}
                        />
                    </div>
                </div>
            </div>
        </div>
    );
};
