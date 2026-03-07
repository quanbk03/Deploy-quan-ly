import React, { useState, useEffect, useRef } from 'react';
import * as XLSX from 'xlsx';
import { UploadCloud, FileSpreadsheet, AlertCircle, ArrowRight, CheckCircle2, Loader2, Settings2, Download, Save, Info, RefreshCw, Layers, Eye, ArrowLeft, FileText, List, ShieldCheck } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { assetsService } from '../services/assetsService';
import { eventsService } from '../services/eventsService';

import type { Asset } from '../types/database';
import { useNavigate } from 'react-router-dom';
import { useSiteScope } from '../hooks/useSiteScope';
import { useToast, ToastContainer } from '../components/Toast';

// DEV-only controlled logger — silent in production
const debugLog = (...args: unknown[]) => {
    if (import.meta.env.DEV) console.debug('[ImportData]', ...args);
};

type Step = 1 | 2 | 3 | 4;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyRecord = Record<string, any>;

interface DataIssue {
    type: 'error' | 'warning';
    msg: string;
}

const TARGET_FIELDS = [
    { key: 'location', label: 'Vị trí sử dụng / Department', regex: /department|vị trí|vi tri|location/i, required: true },
    { key: 'type', label: 'Loại Thiết bị / Equipment', regex: /equipment|thiết bị|thiet bi|type/i, required: true },
    { key: 'description', label: 'Miêu tả / Brand name / Model', regex: /brand name|model|miêu tả|mieu ta|description/i, required: true },
    { key: 'interval', label: 'Chu kỳ KĐ (tháng)', regex: /interval|chu kỳ|chu ky/i, required: false },
    { key: 'last_inspection_date', label: 'Ngày KĐ (Calibration Date)', regex: /calibration date|ngày kđ|ngay kd/i, required: false },
    { key: 'next_due_date', label: 'Hạn KĐ (Next due date)', regex: /next due|hạn kđ|han kd/i, required: true },
    { key: 'stamp_no', label: 'Số Tem (Stamp No)', regex: /stamp|số tem|so tem/i, required: false },
    { key: 'agency', label: 'Đơn vị KĐ (Agency)', regex: /agency|đơn vị|don vi/i, required: false },
    { key: 'remark', label: 'Ghi chú (Remark)', regex: /remark|ghi chú|ghi chu/i, required: false },
    { key: 'document_number', label: 'Số CV', regex: /số cv|so cv|legal/i, required: false }
];

export const ImportData: React.FC = () => {
    const { profile } = useAuth();
    const navigate = useNavigate();
    const fileInputRef = useRef<HTMLInputElement>(null);
    const { selectedSiteId, setSelectedSiteId } = useSiteScope();
    const { toasts, addToast, dismiss } = useToast();

    // File state
    const [currentStep, setCurrentStep] = useState<Step>(1);
    const [file, setFile] = useState<File | null>(null);
    const [sheetName, setSheetName] = useState<string>('');
    const [rawHeaders, setRawHeaders] = useState<string[]>([]);
    const [rawData, setRawData] = useState<AnyRecord[]>([]);

    const [importModeType, setImportModeType] = useState<string>(() => {
        const params = new URLSearchParams(window.location.search);
        return params.get('mode') === 'ycnn' ? 'ycnn' : 'standard';
    });

    const [mapping, setMapping] = useState<Record<string, string>>({});

    const [normalizedData, setNormalizedData] = useState<AnyRecord[]>([]);
    const [dataIssues, setDataIssues] = useState<(AnyRecord & { _issues: DataIssue[] })[]>([]);
    const [isNormalizing, setIsNormalizing] = useState(false);

    const [existingAssets, setExistingAssets] = useState<Asset[]>([]);

    const [importMode, setImportMode] = useState<'add_only' | 'overwrite'>('add_only');
    const [isImporting, setIsImporting] = useState(false);
    const [importResults, setImportResults] = useState<{ success: number, error: number, codes: string[] } | null>(null);
    const [importProgress, setImportProgress] = useState<{ done: number; total: number } | null>(null);
    const [expandedCodes, setExpandedCodes] = useState(false);

    const [globalError, setGlobalError] = useState<string>('');

    useEffect(() => {
        assetsService.list().then(data => {
            setExistingAssets(data);
            debugLog('Loaded existing assets:', data.length);
        }).catch(console.error);
    }, []);

    // Helpers cho điều hướng sau import
    const resetImportFlow = (resetMode = true) => {
        setCurrentStep(1);
        setFile(null);
        setSheetName('');
        setRawHeaders([]);
        setRawData([]);
        setMapping({});
        setNormalizedData([]);
        setDataIssues([]);
        setImportResults(null);
        setIsNormalizing(false);
        setIsImporting(false);
        setGlobalError('');
        if (resetMode) {
            setImportMode('add_only');
        }
        if (fileInputRef.current) {
            fileInputRef.current.value = '';
        }
    };

    const handleReturnToMapping = () => {
        setImportResults(null);
        setCurrentStep(2);
    };

    const goToImportedAssets = () => {
        // Force refetch by appending a timestamp query param — Assets page will re-fetch on mount
        if (importResults?.codes && importResults.codes.length > 0) {
            navigate(`/thiet-bi?search=${encodeURIComponent(importResults.codes[0])}&refresh=${Date.now()}`);
        } else {
            navigate(`/thiet-bi?refresh=${Date.now()}`);
        }
    };

    const goToDashboardAfterImport = () => {
        navigate(`/tong-quan?refresh=${Date.now()}`);
    };

    const autoDetectMapping = (headers: string[]) => {
        const initialMapping: Record<string, string> = {};
        TARGET_FIELDS.forEach(tf => {
            const found = headers.find(h => tf.regex.test(h));
            initialMapping[tf.key] = found || '';
        });
        setMapping(initialMapping);
    };

    const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        setGlobalError('');
        const selectedFile = e.target.files?.[0];
        if (!selectedFile) return;

        setFile(selectedFile);
        const reader = new FileReader();
        reader.onload = (evt) => {
            try {
                const bstr = evt.target?.result;
                const wb = XLSX.read(bstr, { type: 'binary', cellDates: true });
                const wsname = wb.SheetNames[0];
                const ws = wb.Sheets[wsname];
                setSheetName(wsname);

                const data = XLSX.utils.sheet_to_json(ws, { defval: '' }) as AnyRecord[];
                if (data.length > 0) {
                    const headers = Object.keys(data[0]);
                    setRawHeaders(headers);
                    setRawData(data);
                    autoDetectMapping(headers);
                    setCurrentStep(2);
                } else {
                    setGlobalError('File không có dữ liệu để nhập.');
                    setFile(null);
                }
            } catch (error) {
                console.error('Error reading file:', error);
                setGlobalError('Lỗi đọc file. Vui lòng kiểm tra định dạng Excel/CSV.');
                setFile(null);
            }
        };
        reader.readAsBinaryString(selectedFile);

        // Reset file input so same file can be selected again
        e.target.value = '';
    };

    const handleMappingChange = (key: string, value: string) => {
        setMapping(prev => ({ ...prev, [key]: value }));
    };

    const normalizeDate = (dateVal: unknown): string | null => {
        if (!dateVal) return null;
        if (dateVal instanceof Date) return dateVal.toISOString().split('T')[0];
        const str = String(dateVal).trim();
        const match = str.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})$/);
        if (match) {
            const d = match[1].padStart(2, '0');
            const m = match[2].padStart(2, '0');
            let y = match[3];
            if (y.length === 2) {
                const yNum = parseInt(y, 10);
                y = yNum <= 40 ? `20${y}` : `19${y}`;
            }
            return `${y}-${m}-${d}`;
        }
        const parsed = Date.parse(str);
        if (!isNaN(parsed)) return new Date(parsed).toISOString().split('T')[0];
        return null;
    };

    const parseDescription = (desc: string) => {
        const result = { model: '', serial: '', year_made: '', manufacturer: '', working_pressure: '', capacity_or_rating: '' };
        if (!desc) return result;
        const lines = desc.split('\n');
        lines.forEach(line => {
            const lowerLine = line.toLowerCase();
            if (lowerLine.includes('model')) result.model = line.split(/model[:-]?/i)[1]?.trim() || '';
            if (lowerLine.includes('serial') || lowerLine.includes('s/n')) result.serial = line.split(/serial[:-]?|s\/n[:-]?/i)[1]?.trim() || '';
            if (lowerLine.includes('year') || lowerLine.includes('năm sx')) result.year_made = line.split(/year made[:-]?|year[:-]?|năm sx[:-]?/i)[1]?.trim() || '';
            if (lowerLine.includes('manufacturer') || lowerLine.includes('hãng')) result.manufacturer = line.split(/manufacturer[:-]?|hãng sx[:-]?|hãng[:-]?/i)[1]?.trim() || '';
            if (lowerLine.includes('pressure') || lowerLine.includes('áp suất')) result.working_pressure = line.split(/pressure[:-]?|áp suất[:-]?/i)[1]?.trim() || '';
            if (lowerLine.includes('capacity') || lowerLine.includes('rating') || lowerLine.includes('công suất')) result.capacity_or_rating = line.split(/capacity[:-]?|rating[:-]?|công suất[:-]?/i)[1]?.trim() || '';
        });
        return result;
    };

    const getAbbr = (loc: string) => {
        const l = loc.toLowerCase();
        if (l.includes('bckn')) return 'BCKN';
        if (l.includes('tm')) return 'TM';
        if (l.includes('xn')) return 'XN';
        if (l.includes('odh')) return 'ODH';
        return 'TB';
    };

    const processNormalization = async () => {
        const missingReq = TARGET_FIELDS.filter(f => f.required && !mapping[f.key]);
        if (missingReq.length > 0) {
            setGlobalError(`Vui lòng ghép đủ cột trường bắt buộc: ${missingReq.map(f => f.label).join(', ')}`);
            window.scrollTo({ top: 0, behavior: 'smooth' });
            return;
        }
        setGlobalError('');
        setIsNormalizing(true);
        setCurrentStep(3);

        // Use selectedSiteId (from SiteDropdown/useSiteScope) as primary source,
        // fall back to profile.site_id, then 'RG1' as last resort
        const siteId = selectedSiteId || profile?.site_id || 'RG1';
        console.debug('[ImportData] Normalizing with siteId:', siteId, 'rawData rows:', rawData.length);

        const maxRunning: Record<string, number> = {};
        existingAssets.forEach(a => {
            if (a.asset_code?.startsWith(`${siteId}-`)) {
                const parts = a.asset_code.split('-');
                if (parts.length >= 3) {
                    const abbr = parts[1];
                    const num = parseInt(parts[2], 10);
                    if (!isNaN(num)) maxRunning[abbr] = Math.max(maxRunning[abbr] || 0, num);
                }
            }
        });

        await new Promise(resolve => setTimeout(resolve, 100));

        const normalized: AnyRecord[] = [];
        const issues: (AnyRecord & { _issues: DataIssue[] })[] = [];

        rawData.forEach((row, index) => {
            const rowIndex = index + 2;
            const rowIssues: DataIssue[] = [];

            const location = row[mapping.location]?.toString() || '';
            const type = row[mapping.type]?.toString() || '';
            const description = row[mapping.description]?.toString() || '';
            const intervalStr = mapping.interval ? row[mapping.interval]?.toString() : '';
            const interval = intervalStr ? parseInt(intervalStr, 10) : null;

            const lastInspectionDate = mapping.last_inspection_date ? normalizeDate(row[mapping.last_inspection_date]) : null;
            const nextDueDate = mapping.next_due_date ? normalizeDate(row[mapping.next_due_date]) : null;

            const stampNo = mapping.stamp_no ? row[mapping.stamp_no]?.toString() : '';
            const agency = mapping.agency ? row[mapping.agency]?.toString() : '';
            const remark = mapping.remark ? row[mapping.remark]?.toString() : '';
            const documentNumber = mapping.document_number ? row[mapping.document_number]?.toString() : '';

            if (!location) rowIssues.push({ type: 'error', msg: 'Thiếu vị trí sử dụng' });
            if (!type) rowIssues.push({ type: 'error', msg: 'Thiếu loại thiết bị' });
            if (!nextDueDate) rowIssues.push({ type: 'error', msg: 'Thiếu Hạn KĐ (hoặc sai định dạng ngày)' });

            const parsedDesc = parseDescription(description);

            let assetCode = String(row['Mã Thiết bị'] || row['Asset Code'] || '');
            if (!assetCode && location) {
                const abbr = getAbbr(location);
                const nextNum = (maxRunning[abbr] || 0) + 1;
                maxRunning[abbr] = nextNum;
                assetCode = `${siteId}-${abbr}-${nextNum.toString().padStart(3, '0')}`;
            }

            const isDuplicateCode = existingAssets.some(a => a.asset_code === assetCode);
            if (isDuplicateCode) {
                rowIssues.push({ type: 'warning', msg: `Trùng mã thiết bị ${assetCode} trên hệ thống.` });
            }

            if (parsedDesc.serial && parsedDesc.model) {
                const isDuplicateSerial = existingAssets.some(a =>
                    a.description_raw?.toLowerCase().includes(parsedDesc.serial.toLowerCase()) &&
                    a.description_raw?.toLowerCase().includes(parsedDesc.model.toLowerCase())
                );
                if (isDuplicateSerial) {
                    rowIssues.push({ type: 'warning', msg: `Trùng Serial (${parsedDesc.serial}). Có thể là lỗi nhập liệu.` });
                }
            }

            const name = type ? type : 'Thiết bị mới';
            const description_raw = row[mapping.description] ? String(row[mapping.description]).replace(/\r\n/g, '\n').trim() : '';

            const record = {
                _rowIndex: rowIndex,
                asset_code: assetCode,
                name,
                description,
                description_raw,
                type,
                location,
                site_id: siteId,
                status: 'active',
                last_inspection_date: lastInspectionDate,
                next_due_date: nextDueDate,
                parsed_extras: parsedDesc,
                interval_months: interval,
                stamp_no: stampNo,
                agency: agency,
                notes: remark,
                document_number: documentNumber,
                _issues: rowIssues
            };

            normalized.push(record);
            if (rowIssues.length > 0) {
                issues.push(record);
            }
        });

        setNormalizedData(normalized);
        setDataIssues(issues);
        setIsNormalizing(false);
    };

    const downloadIssues = () => {
        if (dataIssues.length === 0) return;
        const wb = XLSX.utils.book_new();
        const wsData = dataIssues.map(e => ({
            'Dòng File Gốc': e._rowIndex,
            'Phân loại': e._issues.some(i => i.type === 'error') ? 'LỖI' : 'CẢNH BÁO',
            'Mã Thiết Bị': e.asset_code,
            'Miêu Tả': e.description,
            'Chi Tiết': e._issues.map(i => `[${i.type.toUpperCase()}] ${i.msg}`).join(' | ')
        }));
        const ws = XLSX.utils.json_to_sheet(wsData);
        XLSX.utils.book_append_sheet(wb, ws, "Issues");
        XLSX.writeFile(wb, "danh_sach_loi_cbo.xlsx");
    };

    const getRowClass = (issues: DataIssue[]) => {
        if (issues.some(i => i.type === 'error')) return 'text-danger-600 bg-danger-50 border border-danger-100';
        if (issues.some(i => i.type === 'warning')) return 'text-amber-600 bg-amber-50 border border-amber-100';
        return 'text-gray-500 bg-gray-50 border border-gray-100';
    };

    // Calculate valid records
    const validDataForImport = normalizedData.filter(d => {
        const rowIssues = dataIssues.find(iss => iss._rowIndex === d._rowIndex);
        if (!rowIssues) return true; // No issues, 100% valid
        // Only valid if no ERRORs (warnings are fine)
        return !rowIssues._issues.some(i => i.type === 'error');
    });

    const rowsWithErrors = dataIssues.filter(i => i._issues.some(err => err.type === 'error')).length;
    const rowsWithWarnings = dataIssues.filter(i => i._issues.some(warn => warn.type === 'warning') && !i._issues.some(err => err.type === 'error')).length;
    const pureValidRows = normalizedData.length - rowsWithErrors - rowsWithWarnings;

    let preImportSummary = { add: 0, update: 0, skip: rowsWithErrors, error: rowsWithErrors };
    if (importMode === 'add_only') {
        const addingRows = validDataForImport.filter(d => !existingAssets.some(ea => ea.asset_code === d.asset_code));
        const duplicateRows = validDataForImport.length - addingRows.length;
        preImportSummary = { add: addingRows.length, update: 0, skip: rowsWithErrors + duplicateRows, error: rowsWithErrors };
    } else {
        const addingRows = validDataForImport.filter(d => !existingAssets.some(ea => ea.asset_code === d.asset_code));
        const updateRows = validDataForImport.length - addingRows.length;
        preImportSummary = { add: addingRows.length, update: updateRows, skip: rowsWithErrors, error: rowsWithErrors };
    }

    const BATCH_SIZE = 10; // 10 concurrent — an toàn với Supabase free tier connection pool

    /** Yield control để React có thể re-render progress bar giữa các batch */
    const yieldToUI = () => new Promise<void>(resolve => setTimeout(resolve, 0));

    const executeImport = async () => {
        setIsImporting(true);
        let dataToProcess = validDataForImport;

        if (importMode === 'add_only') {
            dataToProcess = validDataForImport.filter(d => !existingAssets.some(ea => ea.asset_code === d.asset_code));
        }

        const importSiteId = selectedSiteId || profile?.site_id || 'RG1';
        debugLog(`Starting import: ${dataToProcess.length} records, site=${importSiteId}, mode=${importMode}`);

        let successCount = 0;
        let errorCount = 0;
        const createdCodes: string[] = [];

        // Reset progress counter
        setImportProgress({ done: 0, total: dataToProcess.length });

        // Helper: build asset payload from normalized record
        const buildPayload = (record: AnyRecord) => ({
            asset_code: record.asset_code,
            equipment_name: record.name,
            description_raw: record.description_raw,
            equipment_type: record.type,
            site_id: record.site_id,
            location: record.location,
            status: 'in_service' as const,
            last_inspection_date: record.last_inspection_date || null,
            next_due_date: record.next_due_date,
            model: record.parsed_extras?.model || null,
            serial: record.parsed_extras?.serial || null,
            year_made: record.parsed_extras?.year_made || null,
            manufacturer: record.parsed_extras?.manufacturer || null,
            working_pressure: record.parsed_extras?.working_pressure || null,
            capacity_or_rating: record.parsed_extras?.capacity_or_rating || null,
            is_strict_required: importModeType === 'ycnn',
            interval_months: record.interval_months || 0,
            inspection_agency: record.agency || null,
            stamp_no: record.stamp_no || null,
            created_by: profile?.id || null,
            equipment_category: record.type,
            serial_or_model: record.parsed_extras?.serial || record.parsed_extras?.model || null,
            interval_text: record.interval_months ? record.interval_months.toString() : null,
            declared_status: 'not_declared' as const,
            declaration_doc_no: null
        });

        // Batch import: mỗi record chỉ chờ asset upsert.
        // Event creation là FIRE-AND-FORGET — không await, không chặn batch.
        for (let i = 0; i < dataToProcess.length; i += BATCH_SIZE) {
            const batch = dataToProcess.slice(i, i + BATCH_SIZE);

            const batchResults = await Promise.allSettled(
                batch.map(async (record) => {
                    // Bước quan trọng duy nhất: upsert asset
                    const asset = await assetsService.upsertByAssetCode(buildPayload(record));

                    // Fire-and-forget: tạo event KHÔNG chờ, KHÔNG chặn batch
                    eventsService.createPlanned(
                        asset.id,
                        record.next_due_date,
                        record.interval_months || 0
                    ).catch(evtErr => {
                        console.warn(`[ImportData] Event skipped ${record.asset_code}:`, evtErr);
                    });

                    return record.asset_code;
                })
            );

            batchResults.forEach((result, idx) => {
                if (result.status === 'fulfilled') {
                    successCount++;
                    createdCodes.push(result.value);
                } else {
                    console.error('[ImportData] Upsert FAILED row:', batch[idx]._rowIndex,
                        batch[idx].asset_code, result.reason);
                    errorCount++;
                }
            });

            // Cập nhật progress + yield để React render thanh tiến trình
            setImportProgress({ done: Math.min(i + BATCH_SIZE, dataToProcess.length), total: dataToProcess.length });
            await yieldToUI(); // ← cho phép React flush state update và vẽ lại UI
        }

        debugLog(`Import done — success:${successCount} errors:${errorCount} site:${importSiteId}`);

        // Sync selectedSiteId so Assets/Dashboard immediately queries the correct site
        if (successCount > 0) {
            setSelectedSiteId(importSiteId);
            addToast(
                `✅ Import thành công ${successCount} thiết bị vào site ${importSiteId}.${errorCount > 0 ? ` ${errorCount} bản ghi bị lỗi upsert.` : ''
                }`,
                successCount > 0 && errorCount === 0 ? 'success' : 'warning'
            );
        } else {
            addToast('Không có thiết bị nào được import thành công. Kiểm tra Console để biết thêm chi tiết.', 'error');
        }

        setImportProgress(null);
        setImportResults({ success: successCount, error: errorCount, codes: createdCodes });
        setIsImporting(false);
    };

    return (
        <div className="space-y-6 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            {/* Toast notifications */}
            <ToastContainer toasts={toasts} onDismiss={dismiss} />

            <h1 className="text-2xl font-bold text-gray-900 py-4">Nhập Dữ Liệu Hàng Loạt</h1>

            {globalError && (
                <div className="bg-danger-50 text-danger-700 p-4 rounded-xl border border-danger-100 flex items-start animate-fade-in shadow-sm">
                    <AlertCircle className="w-5 h-5 mr-3 flex-shrink-0 mt-0.5" />
                    <p className="font-semibold text-sm">{globalError}</p>
                </div>
            )}

            {/* Stepper overview */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 mb-6">
                <nav aria-label="Progress">
                    <ol role="list" className="flex items-center w-full justify-between sm:justify-start">
                        <li className={`relative flex-1 sm:pr-20 ${currentStep >= 1 ? 'text-primary-600' : 'text-gray-400'}`}>
                            <div className="absolute inset-0 flex items-center" aria-hidden="true">
                                <div className={`h-0.5 w-full ${currentStep >= 2 ? 'bg-primary-600' : 'bg-gray-200'}`}></div>
                            </div>
                            <div className={`relative flex h-8 w-8 items-center justify-center rounded-full bg-white ring-2 ${currentStep >= 1 ? 'ring-primary-600' : 'ring-gray-300'}`}>
                                <span className="text-sm font-semibold">1</span>
                            </div>
                            <span className="absolute -bottom-6 -left-2 sm:left-1/2 sm:-translate-x-1/2 text-[11px] sm:text-xs font-semibold whitespace-nowrap">Tải file</span>
                        </li>
                        <li className={`relative flex-1 sm:pr-20 ${currentStep >= 2 ? 'text-primary-600' : 'text-gray-400'}`}>
                            <div className="absolute inset-0 flex items-center" aria-hidden="true">
                                <div className={`h-0.5 w-full ${currentStep >= 3 ? 'bg-primary-600' : 'bg-gray-200'}`}></div>
                            </div>
                            <div className={`relative flex h-8 w-8 items-center justify-center rounded-full bg-white ring-2 ${currentStep >= 2 ? 'ring-primary-600' : 'ring-gray-300'}`}>
                                <span className="text-sm font-semibold">2</span>
                            </div>
                            <span className="absolute -bottom-6 -left-2 sm:left-1/2 sm:-translate-x-1/2 text-[11px] sm:text-xs font-semibold whitespace-nowrap">Ghép cột</span>
                        </li>
                        <li className={`relative flex-1 sm:pr-20 ${currentStep >= 3 ? 'text-primary-600' : 'text-gray-400'}`}>
                            <div className="absolute inset-0 flex items-center" aria-hidden="true">
                                <div className={`h-0.5 w-full ${currentStep >= 4 ? 'bg-primary-600' : 'bg-gray-200'}`}></div>
                            </div>
                            <div className={`relative flex h-8 w-8 items-center justify-center rounded-full bg-white ring-2 ${currentStep >= 3 ? 'ring-primary-600' : 'ring-gray-300'}`}>
                                <span className="text-sm font-semibold">3</span>
                            </div>
                            <span className="absolute -bottom-6 -left-2 sm:left-1/2 sm:-translate-x-1/2 text-[11px] sm:text-xs font-semibold whitespace-nowrap">Chuẩn hóa</span>
                        </li>
                        <li className={`relative ${currentStep >= 4 ? 'text-primary-600' : 'text-gray-400'} flex items-center justify-center`}>
                            <div className={`relative flex h-8 w-8 items-center justify-center rounded-full bg-white ring-2 ${currentStep >= 4 ? 'ring-primary-600' : 'ring-gray-300'}`}>
                                <span className="text-sm font-semibold">4</span>
                            </div>
                            <span className="absolute -bottom-6 -left-2 sm:left-1/2 sm:-translate-x-1/2 text-[11px] sm:text-xs font-semibold whitespace-nowrap">Xác nhận</span>
                        </li>
                    </ol>
                </nav>
            </div>

            {/* Step Content */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 sm:p-8">
                {currentStep === 1 && (
                    <div className="max-w-3xl mx-auto py-4">
                        <div className="text-center mb-8">
                            <FileSpreadsheet className="w-16 h-16 text-primary-500 mx-auto mb-4" />
                            <h2 className="text-2xl font-bold text-gray-900 mb-2">Chọn Loại Dữ Liệu Tải Lên</h2>
                            <p className="text-gray-500 text-sm">Vui lòng chọn loại thiết bị bạn muốn nhập bằng file Excel/CSV.</p>
                        </div>

                        {/* Import mode selection */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8">
                            <div
                                onClick={() => setImportModeType('standard')}
                                className={`p-5 rounded-xl border-2 cursor-pointer transition-all ${importModeType === 'standard' ? 'border-primary-500 bg-primary-50 shadow-sm' : 'border-gray-200 hover:border-primary-300 hover:bg-gray-50'}`}
                            >
                                <h3 className="text-lg font-bold text-gray-900 mb-1">Thiết bị Thông thường</h3>
                                <p className="text-sm text-gray-600">Sử dụng cho các thiết bị đo kiểm, hiệu chuẩn tiêu chuẩn.</p>
                                {importModeType === 'standard' && <div className="mt-3 text-primary-600 text-sm font-semibold flex items-center"><CheckCircle2 className="w-4 h-4 mr-1" /> Đang chọn</div>}
                            </div>

                            <div
                                onClick={() => setImportModeType('ycnn')}
                                className={`p-5 rounded-xl border-2 cursor-pointer transition-all ${importModeType === 'ycnn' ? 'border-primary-500 bg-primary-50 shadow-sm' : 'border-gray-200 hover:border-primary-300 hover:bg-gray-50'}`}
                            >
                                <h3 className="text-lg font-bold text-gray-900 mb-1">Thiết bị YCNN</h3>
                                <p className="text-sm text-gray-600">Sử dụng template Excel có cấu trúc riêng dành cho thiết bị YCNN.</p>
                                {importModeType === 'ycnn' && <div className="mt-3 text-primary-600 text-sm font-semibold flex items-center"><CheckCircle2 className="w-4 h-4 mr-1" /> Đang chọn</div>}
                            </div>
                        </div>

                        <div className="mt-2 flex justify-center rounded-xl border border-dashed border-gray-300 px-6 py-10 hover:border-primary-500 hover:bg-primary-50 transition-colors bg-white group cursor-pointer relative">
                            <div className="text-center w-full relative z-10">
                                <UploadCloud className="mx-auto h-12 w-12 text-gray-300 group-hover:text-primary-500 transition-colors" aria-hidden="true" />
                                <div className="mt-4 flex text-sm leading-6 text-gray-600 justify-center">
                                    <span className="font-semibold text-primary-600 mr-1">Tải file lên</span> hoặc kéo thả vào đây
                                </div>
                                <p className="text-xs text-gray-400 mt-2">Hỗ trợ .xlsx, .xls, .csv (tối đa 5MB)</p>
                            </div>
                            <input ref={fileInputRef} type="file" className="opacity-0 absolute inset-0 w-full h-full cursor-pointer z-20" accept=".xlsx, .xls, .csv" onChange={handleFileUpload} />
                        </div>

                        {file && (
                            <div className="mt-6 p-4 bg-green-50 border border-green-200 rounded-xl shadow-sm">
                                <div className="flex items-center text-green-800">
                                    <CheckCircle2 className="w-6 h-6 mr-3 flex-shrink-0" />
                                    <div className="flex-1 min-w-0">
                                        <p className="text-sm font-bold truncate">{file.name}</p>
                                        <div className="flex items-center text-xs text-green-700 mt-1 space-x-3">
                                            <span className="flex items-center"><Layers className="w-3 h-3 mr-1" /> {rawData.length} dòng</span>
                                            <span className="flex items-center"><FileSpreadsheet className="w-3 h-3 mr-1" /> {rawHeaders.length} cột</span>
                                            <span className="flex items-center"><CheckCircle2 className="w-3 h-3 mr-1" /> Sheet: {sheetName}</span>
                                        </div>
                                    </div>
                                    {importModeType === 'ycnn' && <span className="bg-green-100 text-green-800 text-xs font-bold px-2.5 py-1 rounded-lg">Template YCNN</span>}
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {currentStep === 2 && (
                    <div>
                        <div className="flex justify-between items-center mb-6">
                            <h2 className="text-lg font-bold text-gray-900 flex items-center">
                                <Settings2 className="w-5 h-5 mr-2 text-primary-500" />
                                Ghép Cột Dữ Liệu (Mapping)
                            </h2>
                            <div className="flex items-center space-x-2">
                                <button onClick={() => autoDetectMapping(rawHeaders)} className="flex items-center text-sm text-primary-600 hover:text-primary-700 font-medium border border-primary-200 bg-primary-50 hover:bg-primary-100 px-3 py-1.5 rounded-lg transition-colors">
                                    <RefreshCw className="w-3.5 h-3.5 mr-1" /> Tự động ghép lại
                                </button>
                                <button onClick={() => setCurrentStep(1)} className="text-sm text-gray-600 hover:text-gray-800 font-medium border border-gray-200 bg-white hover:bg-gray-50 px-3 py-1.5 rounded-lg transition-colors">
                                    Chọn file khác
                                </button>
                            </div>
                        </div>

                        <div className="p-3 mb-6 bg-blue-50 border border-blue-100 rounded-xl text-sm text-blue-800 flex items-start">
                            <Info className="w-5 h-5 mr-2 mt-0.5 flex-shrink-0 text-blue-500" />
                            <p>Hệ thống tự động nhận diện tên cột. Với các cột không nhận diện được, vui lòng chọn thủ công. Các ô viền <span className="font-bold text-danger-600">Đỏ</span> là bắt buộc nhập.</p>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-x-8 gap-y-6 mb-8 bg-white p-6 rounded-xl border border-gray-100 shadow-[0_2px_10px_-3px_rgba(0,0,0,0.05)]">
                            {TARGET_FIELDS.map(field => {
                                const isMapped = !!mapping[field.key];
                                const isRequired = field.required;
                                let borderClass = 'border-gray-200';
                                if (isMapped) borderClass = 'border-green-400 bg-green-50/20';
                                else if (!isMapped && isRequired) borderClass = 'border-danger-400 bg-danger-50/10 ring-1 ring-danger-100';
                                else if (!isMapped && !isRequired) borderClass = 'border-amber-300 bg-amber-50/10';

                                return (
                                    <div key={field.key} className="flex flex-col">
                                        <label className="text-sm font-semibold text-gray-800 mb-1.5 flex items-center justify-between">
                                            <span>{field.label} {isRequired && <span className="text-danger-500">*</span>}</span>
                                            {isMapped && <CheckCircle2 className="w-3.5 h-3.5 text-green-500" />}
                                        </label>
                                        <select
                                            value={mapping[field.key] || ''}
                                            onChange={(e) => handleMappingChange(field.key, e.target.value)}
                                            className={`block w-full px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 rounded-xl border shadow-sm transition-colors ${borderClass}`}
                                        >
                                            <option value="">-- Không ghép cột --</option>
                                            {rawHeaders.map((header, i) => (
                                                <option key={i} value={header}>{header}</option>
                                            ))}
                                        </select>
                                    </div>
                                )
                            })}
                        </div>

                        <div className="mt-8 mb-4">
                            <h3 className="text-md font-semibold text-gray-900 mb-3 flex items-center"><Eye className="w-4 h-4 mr-2" /> Xem trước Nội dung (Tối đa 5 dòng)</h3>
                            <div className="overflow-x-auto border border-gray-200 rounded-xl shadow-sm">
                                <table className="min-w-full divide-y divide-gray-200 text-sm text-left">
                                    <thead className="bg-gray-50 border-b border-gray-200">
                                        <tr>
                                            <th className="px-4 py-2 font-semibold text-gray-900 line-clamp-1">#</th>
                                            {rawHeaders.map((h, i) => <th key={i} className="px-4 py-2 font-semibold text-gray-900 whitespace-nowrap">{h}</th>)}
                                        </tr>
                                    </thead>
                                    <tbody className="bg-white divide-y divide-gray-100">
                                        {rawData.slice(0, 5).map((row, i) => (
                                            <tr key={i} className="hover:bg-gray-50">
                                                <td className="px-4 py-2 text-gray-400 font-medium">{i + 1}</td>
                                                {rawHeaders.map((h, j) => <td key={j} className="px-4 py-2 truncate max-w-[200px] text-gray-600" title={String(row[h] || '')}>{String(row[h] || '')}</td>)}
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>

                        <div className="flex justify-end gap-3 mt-8 pt-6 border-t border-gray-100">
                            <button onClick={() => setCurrentStep(1)} className="px-5 py-2.5 border border-gray-300 bg-white text-gray-700 rounded-xl hover:bg-gray-50 font-medium transition-colors border-dashed">Thoát & Chọn File Khác</button>
                            <button onClick={processNormalization} className="px-6 py-2.5 bg-primary-600 text-white rounded-xl hover:bg-primary-700 font-bold flex items-center transition-colors shadow-sm">
                                Chuẩn hóa dữ liệu <ArrowRight className="w-4 h-4 ml-2" />
                            </button>
                        </div>
                    </div>
                )}

                {currentStep === 3 && (
                    <div>
                        {isNormalizing ? (
                            <div className="flex justify-center items-center h-64">
                                <div className="text-center">
                                    <Loader2 className="w-10 h-10 animate-spin text-primary-600 mx-auto mb-4" />
                                    <p className="text-gray-600 font-bold">Đang xử lý chuẩn hóa ({rawData.length} dòng)...</p>
                                    <p className="text-gray-400 text-sm mt-1">Quá trình này có thể mất vài giây</p>
                                </div>
                            </div>
                        ) : (
                            <div>
                                <div className="flex justify-between items-center mb-6">
                                    <h2 className="text-xl font-bold text-gray-900 flex items-center">
                                        <CheckCircle2 className="w-6 h-6 mr-2 text-primary-500" />
                                        Kiểm Tra Dữ Liệu
                                    </h2>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                                    <div className="bg-success-50 rounded-xl p-5 border border-success-200">
                                        <div className="text-success-800 font-black text-3xl mb-1">{pureValidRows}</div>
                                        <div className="text-success-700 text-sm font-bold">Dòng Hợp Lệ 100%</div>
                                    </div>
                                    <div className="bg-amber-50 rounded-xl p-5 border border-amber-200 relative overflow-hidden">
                                        <div className="text-amber-800 font-black text-3xl mb-1">{rowsWithWarnings}</div>
                                        <div className="text-amber-700 text-sm font-bold">Dòng Cảnh Báo (Vẫn Import)</div>
                                    </div>
                                    <div className="bg-danger-50 rounded-xl p-5 border border-danger-200 relative overflow-hidden">
                                        <div className="text-danger-800 font-black text-3xl mb-1">{rowsWithErrors}</div>
                                        <div className="text-danger-700 text-sm font-bold">Dòng Bị Lỗi (Sẽ Bỏ Qua)</div>
                                    </div>
                                </div>

                                {dataIssues.length > 0 && (
                                    <div className="mb-8">
                                        <div className="flex justify-between items-center mb-3">
                                            <h3 className="text-md font-bold text-gray-900 flex items-center">
                                                <AlertCircle className="w-5 h-5 mr-2 text-amber-500" /> Danh Sách Vấn Đề (Cảnh Báo & Lỗi)
                                            </h3>
                                            <button onClick={downloadIssues} className="text-sm bg-white border border-gray-200 text-gray-800 px-4 py-2 rounded-xl font-bold hover:bg-gray-50 flex items-center shadow-[0_1px_2px_rgba(0,0,0,0.05)] transition-colors">
                                                <Download className="w-4 h-4 mr-2" /> Tải file Excel
                                            </button>
                                        </div>
                                        <div className="overflow-x-auto border border-gray-200 rounded-xl max-h-96 shadow-sm">
                                            <table className="min-w-full divide-y divide-gray-200 text-sm text-left">
                                                <thead className="bg-gray-100 sticky top-0 z-10 border-b border-gray-200">
                                                    <tr>
                                                        <th className="px-4 py-3 font-bold text-gray-700 w-16 text-center">Dòng</th>
                                                        <th className="px-4 py-3 font-bold text-gray-700 w-24 text-center">Loại</th>
                                                        <th className="px-4 py-3 font-bold text-gray-700 w-48">Mã TB (Dự kiến)</th>
                                                        <th className="px-4 py-3 font-bold text-gray-700">Chi tiết Vấn đề</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="bg-white divide-y divide-gray-100">
                                                    {dataIssues.slice(0, 50).map((issueRow, i) => (
                                                        <tr key={i} className={getRowClass(issueRow._issues)}>
                                                            <td className="px-4 py-3 text-center font-bold">{issueRow._rowIndex}</td>
                                                            <td className="px-4 py-3 text-center font-bold">
                                                                {issueRow._issues.some(ish => ish.type === 'error') ? (
                                                                    <span className="bg-danger-100 text-danger-700 px-2 py-0.5 rounded text-xs uppercase tracking-wider">Lỗi</span>
                                                                ) : (
                                                                    <span className="bg-amber-100 text-amber-700 px-2 py-0.5 rounded text-xs uppercase tracking-wider">C.Báo</span>
                                                                )}
                                                            </td>
                                                            <td className="px-4 py-3 font-mono font-bold text-xs">{issueRow.asset_code}</td>
                                                            <td className="px-4 py-3">
                                                                <ul className="list-disc pl-4 space-y-1 font-medium">
                                                                    {issueRow._issues.map((msg, idx) => (
                                                                        <li key={idx} className={msg.type === 'error' ? 'text-danger-700 font-semibold' : 'text-amber-700'}>
                                                                            {msg.msg}
                                                                        </li>
                                                                    ))}
                                                                </ul>
                                                            </td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                            {dataIssues.length > 50 && (
                                                <div className="p-3 text-center text-sm font-semibold text-gray-500 bg-gray-50 border-t border-gray-200">
                                                    Đang hiển thị 50 cảnh báo/lỗi đầu tiên. Vui lòng tải file để xem phần còn lại.
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                )}

                                <div className="flex justify-end gap-3 pt-6 border-t border-gray-100">
                                    <button onClick={() => setCurrentStep(2)} className="px-5 py-2.5 border border-gray-300 bg-white text-gray-700 rounded-xl hover:bg-gray-50 font-bold transition-colors shadow-[0_1px_2px_rgba(0,0,0,0.05)] flex items-center">
                                        <ArrowLeft className="w-4 h-4 mr-2" /> Quay lại Sắp xếp Cột
                                    </button>
                                    <button
                                        onClick={() => setCurrentStep(4)}
                                        disabled={validDataForImport.length === 0}
                                        className="px-6 py-2.5 bg-primary-600 text-white rounded-xl hover:bg-primary-700 font-bold flex items-center transition-all shadow-[0_2px_10px_rgba(0,0,0,0.1)] disabled:opacity-50 disabled:cursor-not-allowed"
                                        title={validDataForImport.length === 0 ? "Không có dữ liệu hợp lệ để tiếp tục" : ""}
                                    >
                                        Đến bước Xác nhận <ArrowRight className="w-4 h-4 ml-2" />
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {currentStep === 4 && (
                    <div className="max-w-3xl mx-auto">
                        <div className="flex justify-between items-center mb-6 pb-4 border-b border-gray-100">
                            <h2 className="text-xl font-bold text-gray-900 flex items-center">
                                <UploadCloud className="w-7 h-7 mr-3 text-primary-500" />
                                Xác Nhận & Kết Quả Import
                            </h2>
                        </div>

                        {!importResults ? (
                            <>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
                                    <div className="bg-slate-50 border border-slate-200 rounded-2xl p-5 shadow-sm">
                                        <h3 className="text-slate-800 font-bold mb-3 flex items-center"><CheckCircle2 className="w-5 h-5 mr-2" /> Kịch bản Import:</h3>
                                        <ul className="space-y-3 font-medium text-sm text-slate-700 mb-4">
                                            <li className="flex justify-between items-center bg-white p-2 rounded-lg border border-slate-100 shadow-[0_1px_2px_rgba(0,0,0,0.02)]">
                                                <span className="flex items-center"><span className="w-2 h-2 rounded-full bg-success-500 mr-2"></span>Thêm mới an toàn:</span>
                                                <b className="text-success-600 text-lg">{preImportSummary.add}</b>
                                            </li>
                                            <li className="flex justify-between items-center bg-white p-2 rounded-lg border border-slate-100 shadow-[0_1px_2px_rgba(0,0,0,0.02)]">
                                                <span className="flex items-center"><span className="w-2 h-2 rounded-full bg-amber-500 mr-2"></span>Sẽ Ghi đè (Upsert):</span>
                                                <b className="text-amber-600 text-lg">{preImportSummary.update}</b>
                                            </li>
                                            <li className="flex justify-between items-center bg-white p-2 rounded-lg border border-slate-100 shadow-[0_1px_2px_rgba(0,0,0,0.02)]">
                                                <span className="flex items-center"><span className="w-2 h-2 rounded-full bg-danger-500 mr-2"></span>Bị loại (Lỗi / Skip):</span>
                                                <b className="text-danger-600 text-lg">{preImportSummary.skip}</b>
                                            </li>
                                        </ul>
                                        <div className="bg-white p-2.5 rounded-xl border border-blue-100 flex items-center text-xs font-semibold text-blue-700">
                                            <Info className="w-4 h-4 mr-2" /> Đang dùng chế độ: {importModeType === 'ycnn' ? 'Template YCNN' : 'Mặc định'}
                                        </div>
                                    </div>

                                    <div className="space-y-4">
                                        <h3 className="text-gray-900 font-bold mb-2">Chọn chế độ Ghi (Conflict Mode):</h3>
                                        <label
                                            className={`block p-4 rounded-xl border-2 cursor-pointer transition-all ${importMode === 'add_only' ? 'border-primary-500 bg-primary-50 shadow-md ring-2 ring-primary-100' : 'border-gray-200 hover:border-primary-200 bg-white'}`}
                                            onClick={() => setImportMode('add_only')}
                                        >
                                            <div className="flex items-center mb-1">
                                                <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center mr-3 ${importMode === 'add_only' ? 'border-primary-600 bg-primary-600' : 'border-gray-300'}`}>
                                                    {importMode === 'add_only' && <div className="w-2 h-2 rounded-full bg-white"></div>}
                                                </div>
                                                <span className="font-bold text-gray-900">Chi thêm mới (Bỏ qua trùng MS)</span>
                                            </div>
                                            <p className="text-xs font-semibold text-gray-500 pl-8">Bảo tồn dữ liệu cũ. Những mã TB đã có trên Database sẽ bị bỏ qua (Skip).</p>
                                        </label>

                                        <label
                                            className={`block p-4 rounded-xl border-2 cursor-pointer transition-all ${importMode === 'overwrite' ? 'border-primary-500 bg-primary-50 shadow-md ring-2 ring-primary-100' : 'border-gray-200 hover:border-primary-200 bg-white'}`}
                                            onClick={() => setImportMode('overwrite')}
                                        >
                                            <div className="flex items-center mb-1">
                                                <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center mr-3 ${importMode === 'overwrite' ? 'border-primary-600 bg-primary-600' : 'border-gray-300'}`}>
                                                    {importMode === 'overwrite' && <div className="w-2 h-2 rounded-full bg-white"></div>}
                                                </div>
                                                <span className="font-bold text-gray-900">Ghi đè (Upsert)</span>
                                            </div>
                                            <p className="text-xs font-semibold text-gray-500 pl-8">Update thông tin mới từ file Excel vào các mã TB đã có sẵn trên hệ thống.</p>
                                        </label>
                                    </div>
                                </div>

                                <div className="flex justify-between items-center pt-6 border-t border-gray-100 mt-6 bg-white sticky bottom-0 py-4 z-10">
                                    <button
                                        onClick={() => setCurrentStep(3)}
                                        disabled={isImporting}
                                        className="px-5 py-2.5 border-2 border-slate-200 text-slate-700 rounded-xl hover:bg-slate-50 font-bold transition-colors disabled:opacity-50 flex items-center"
                                    >
                                        <ArrowLeft className="w-4 h-4 mr-2" /> Kiểm tra lại
                                    </button>
                                    <button
                                        onClick={executeImport}
                                        disabled={isImporting || (preImportSummary.add + preImportSummary.update === 0)}
                                        className="px-8 py-3 bg-success-600 text-white rounded-xl hover:bg-success-700 font-bold flex items-center transition-all shadow-[0_4px_15px_rgba(16,185,129,0.3)] hover:shadow-[0_4px_25px_rgba(16,185,129,0.4)] disabled:opacity-50 disabled:cursor-not-allowed transform active:scale-95 text-lg"
                                    >
                                        {isImporting ? (
                                            <><Loader2 className="w-5 h-5 mr-3 animate-spin" /> Đang import... ({validDataForImport.length} dòng)</>
                                        ) : (
                                            <><Save className="w-5 h-5 mr-3" /> Thực Hiện Import ({preImportSummary.add + preImportSummary.update})</>
                                        )}
                                    </button>
                                </div>

                                {/* Full-page loading overlay */}
                                {isImporting && (
                                    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-white/80 backdrop-blur-sm">
                                        <Loader2 className="w-12 h-12 text-primary-600 animate-spin mb-4" />
                                        <p className="text-lg font-bold text-gray-800">Đang import dữ liệu, vui lòng chờ...</p>
                                        {importProgress ? (
                                            <div className="mt-3 w-56">
                                                <div className="flex justify-between text-xs text-gray-500 mb-1.5">
                                                    <span>{importProgress.done} / {importProgress.total} dòng</span>
                                                    <span>{Math.round((importProgress.done / importProgress.total) * 100)}%</span>
                                                </div>
                                                <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                                                    <div
                                                        className="h-full bg-primary-500 rounded-full transition-all duration-300"
                                                        style={{ width: `${Math.round((importProgress.done / importProgress.total) * 100)}%` }}
                                                    />
                                                </div>
                                            </div>
                                        ) : (
                                            <p className="text-sm text-gray-500 mt-1">{validDataForImport.length} dòng đang được xử lý</p>
                                        )}
                                    </div>
                                )}

                            </>
                        ) : (
                            <div className="text-center py-6 animate-fade-in">
                                {importResults.success > 0 ? (
                                    <div className="mx-auto w-20 h-20 bg-success-100 rounded-full flex items-center justify-center mb-5 shadow-[0_0_30px_rgba(16,185,129,0.2)]">
                                        <CheckCircle2 className="w-10 h-10 text-success-600" />
                                    </div>
                                ) : (
                                    <div className="mx-auto w-20 h-20 bg-amber-100 rounded-full flex items-center justify-center mb-5 shadow-[0_0_30px_rgba(245,158,11,0.2)]">
                                        <AlertCircle className="w-10 h-10 text-amber-600" />
                                    </div>
                                )}

                                <h2 className="text-2xl font-black text-gray-900 mb-2">
                                    {importResults.success > 0 ? 'Thực Hiện Thành Công!' : 'Hoàn Tất (Không có Thiết bị Nào được Import)'}
                                </h2>
                                <p className="text-gray-500 font-medium mb-8 text-base px-10">
                                    {importResults.success > 0
                                        ? 'Đã ghi dữ liệu vào hệ thống an toàn. Bạn có thể tiếp tục import file khác, quay lại chỉnh sửa mapping, hoặc chuyển hướng đến màn hình danh sách thiết bị.'
                                        : 'Quá trình lưu kết thúc, tuy nhiên không có dòng dữ liệu nào được báo cáo thành công. Vui lòng kiểm tra lại file hệ thống.'}
                                </p>

                                <div className="grid grid-cols-2 max-w-sm mx-auto gap-4 mb-8">
                                    <div className={`rounded-2xl p-4 border shadow-sm ${importResults.success > 0 ? 'bg-success-50 border-success-100' : 'bg-gray-50 border-gray-200'}`}>
                                        <div className={`text-sm font-bold mb-1 ${importResults.success > 0 ? 'text-success-700' : 'text-gray-500'}`}>THÀNH CÔNG</div>
                                        <div className={`font-black text-3xl ${importResults.success > 0 ? 'text-success-800' : 'text-gray-600'}`}>{importResults.success}</div>
                                    </div>
                                    <div className={`rounded-2xl p-4 border shadow-sm ${importResults.error > 0 ? 'bg-danger-50 border-danger-100' : 'bg-gray-50 border-gray-200'}`}>
                                        <div className={`text-sm font-bold mb-1 ${importResults.error > 0 ? 'text-danger-700' : 'text-gray-500'}`}>LỖI HỆ THỐNG</div>
                                        <div className={`font-black text-3xl ${importResults.error > 0 ? 'text-danger-800' : 'text-gray-600'}`}>{importResults.error}</div>
                                    </div>
                                </div>

                                {importResults.codes.length > 0 && (
                                    <div className="bg-slate-50 p-5 rounded-2xl text-left border border-slate-200 mb-10 shadow-sm max-w-xl mx-auto">
                                        <div className="flex justify-between items-center mb-3">
                                            <p className="text-sm font-bold text-slate-800 flex items-center">
                                                <ShieldCheck className="w-4 h-4 mr-2 text-primary-500" />
                                                Các Mã Thiết bị mới đã Import ({importResults.codes.length}):
                                            </p>
                                            <button
                                                onClick={() => setExpandedCodes(!expandedCodes)}
                                                className="text-xs font-bold text-primary-600 hover:text-primary-800"
                                            >
                                                {expandedCodes ? 'Thu gọn ▲' : 'Mở rộng ▼'}
                                            </button>
                                        </div>

                                        <div className={`flex flex-wrap gap-2 transition-all ${expandedCodes ? 'max-h-96 overflow-y-auto' : 'max-h-24 overflow-hidden'}`}>
                                            {importResults.codes.map((code, idx) => (
                                                <span key={idx} className="bg-white border border-slate-200 text-xs font-mono px-2.5 py-1.5 rounded-lg text-slate-700 font-bold shadow-sm">
                                                    {code}
                                                </span>
                                            ))}
                                            {!expandedCodes && importResults.codes.length > 15 && (
                                                <span className="text-xs font-bold text-slate-500 px-2.5 py-1.5 bg-slate-100 rounded-lg">...+{importResults.codes.length - 15} mã nữa</span>
                                            )}
                                        </div>
                                    </div>
                                )}

                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-xl mx-auto border-t border-gray-100 pt-8 mt-4">
                                    {/* CTA 1: Primary — xem thiết bị vừa import */}
                                    <button
                                        onClick={goToImportedAssets}
                                        className="col-span-1 sm:col-span-2 px-6 py-4 flex flex-col justify-center items-center bg-primary-600 text-white shadow-[0_4px_15px_rgba(79,70,229,0.3)] hover:bg-primary-700 hover:shadow-[0_4px_25px_rgba(79,70,229,0.4)] rounded-2xl font-bold transition-all active:scale-95"
                                    >
                                        <FileText className="w-6 h-6 mb-2 text-white/90" />
                                        <span>Xem Thiết Bị Vừa Import ({importResults.codes.length > 0 ? importResults.codes.length : importResults.success})</span>
                                    </button>

                                    {/* CTA 2: Làm mới Dashboard */}
                                    <button
                                        onClick={goToDashboardAfterImport}
                                        className="px-6 py-4 flex flex-col justify-center items-center border border-indigo-200 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 rounded-2xl font-bold transition-all"
                                    >
                                        <RefreshCw className="w-6 h-6 mb-2 text-indigo-500" />
                                        <span>Làm mới Dashboard</span>
                                    </button>

                                    {/* CTA 3: Import file khác */}
                                    <button
                                        onClick={() => resetImportFlow(true)}
                                        className="px-6 py-4 flex flex-col justify-center items-center border border-primary-200 bg-primary-50 text-primary-700 hover:bg-primary-100 rounded-2xl font-bold transition-all"
                                    >
                                        <UploadCloud className="w-6 h-6 mb-2 text-primary-500" />
                                        <span>Tiếp tục Import File Khác</span>
                                    </button>

                                    {/* CTA 4: Quay về bước ghép cột */}
                                    <button
                                        onClick={handleReturnToMapping}
                                        className="px-6 py-4 flex flex-col justify-center items-center border border-gray-200 bg-white text-gray-700 hover:bg-gray-50 rounded-2xl font-bold transition-all"
                                    >
                                        <Settings2 className="w-6 h-6 mb-2 text-gray-500" />
                                        <span>Quay về Bước Ghép Cột</span>
                                    </button>

                                    {/* CTA 5: Danh sách thiết bị (full list) */}
                                    <button
                                        onClick={() => navigate('/thiet-bi')}
                                        className="px-6 py-4 flex flex-col justify-center items-center border border-gray-200 bg-white text-gray-600 hover:bg-gray-50 rounded-2xl font-medium transition-all col-span-1 sm:col-span-2"
                                    >
                                        <List className="w-5 h-5 mb-1 text-gray-400" />
                                        <span className="text-sm">Đến Danh Sách Thiết Bị (không lọc)</span>
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
};
