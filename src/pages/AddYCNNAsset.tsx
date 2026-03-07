import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Save, X, AlertCircle, Loader2 } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { assetsService } from '../services/assetsService';
import { useSiteScope } from '../hooks/useSiteScope';
import { SiteDropdown } from '../components/SiteDropdown';
import { eventsService } from '../services/eventsService';
import { docsService } from '../services/docsService';
import { format, addMonths } from 'date-fns';

const YCNN_EQUIPMENT_CATS = [
    { code: 'N01', label_short: 'Nồi hơi', label_full: 'Nồi hơi các loại (bao gồm cả bộ quá nhiệt và bộ hâm nước)' },
    { code: 'N02', label_short: 'Nồi gia nhiệt dầu', label_full: 'Nồi đun nước nóng có nhiệt độ môi chất trên 115°C' },
    { code: 'N03', label_short: 'Hệ thống đường ống dẫn hơi', label_full: 'Hệ thống đường ống dẫn hơi nước, nước nóng' },
    { code: 'N04', label_short: 'Bình chịu áp lực', label_full: 'Bình chịu áp lực có áp suất làm việc định mức cao hơn 0,7 bar' },
    { code: 'N05', label_short: 'Bồn chứa LNG', label_full: 'Bồn, bể (xi téc), thùng dùng để chứa, chuyên chở khí hóa lỏng' },
    { code: 'N06', label_short: 'Đường ống dẫn khí đốt', label_full: 'Hệ thống điều chế, nạp khí, khí hóa lỏng, khí hòa tan' },
    { code: 'N07', label_short: 'Cần trục', label_full: 'Cần trục các loại: tự hành, bánh xích, tháp' },
    { code: 'N08', label_full: 'Cầu trục, cổng trục, bán cổng trục', label_short: 'Cầu trục/cổng trục' },
    { code: 'N09', label_full: 'Tời điện', label_short: 'Tời điện dùng để nâng tải' },
    { code: 'N10', label_full: 'Palăng', label_short: 'Palăng điện, palăng kéo tay' },
    { code: 'N11', label_full: 'Xe nâng hàng', label_short: 'Xe nâng hàng dùng động cơ' },
    { code: 'N12', label_full: 'Thang máy', label_short: 'Thang máy chở người, chở người và hàng' },
    { code: 'N13', label_full: 'Hệ thống cáp treo', label_short: 'Hệ thống cáp treo chở người' },
    { code: 'N14', label_full: 'Sàn nâng người', label_short: 'Sàn nâng người thi công trên cao' },
    { code: 'N15', label_full: 'Hệ thống lạnh', label_short: 'Hệ thống làm lạnh' },
    { code: 'N16', label_full: 'Nồi hấp', label_short: 'Nồi hấp, thiết bị tuyệt trùng' },
    { code: 'N17', label_full: 'Trạm nạp khí', label_short: 'Hệ thống trạm nạp khí nén' },
    { code: 'N18', label_full: 'Chai chứa khí', label_short: 'Chai chứa khí nén công nghiệp' }
];

export const AddYCNNAsset: React.FC = () => {
    const { profile } = useAuth();
    const navigate = useNavigate();

    // Auth Check
    useEffect(() => {
        if (profile?.role === 'viewer') {
            navigate('/thiet-bi', { replace: true });
        }
    }, [profile, navigate]);

    const { sites, selectedSiteId, loading: sitesLoading } = useSiteScope();

    // Form State
    const [formData, setFormData] = useState({
        site_id: profile?.site_id || selectedSiteId || '',
        equipment_category: '', // type
        equipment_name: '', // name
        serial_or_model: '', // mapped to part of description
        description_raw: '', // description
        interval_text: '12', // interval_months
        interval_custom: '',
        last_inspection_date: '',
        next_due_date: '',
        stamp_no: '',
        inspection_agency: '',
        declared_status: 'declared',
        declaration_doc_no: ''
    });

    const [isSubmitting, setIsSubmitting] = useState(false);
    const [errorMsg, setErrorMsg] = useState('');
    const [successMsg, setSuccessMsg] = useState('');
    const [savedAssetCode, setSavedAssetCode] = useState('');

    useEffect(() => {
        if (selectedSiteId && !formData.site_id) {
            setFormData(prev => ({ ...prev, site_id: selectedSiteId }));
        }
    }, [selectedSiteId]);

    const handleCalcNextDue = () => {
        if (!formData.last_inspection_date) {
            setErrorMsg('Vui lòng nhập Ngày CĐ/KĐ gần nhất trước khi tự tính.');
            return;
        }

        let months = 12;
        if (formData.interval_text === 'custom') {
            months = parseInt(formData.interval_custom) || 12;
        } else {
            months = parseInt(formData.interval_text) || 12;
        }

        const nextDate = addMonths(new Date(formData.last_inspection_date), months);
        setFormData(prev => ({ ...prev, next_due_date: format(nextDate, 'yyyy-MM-dd') }));
    };

    const getFormInterval = () => {
        if (formData.interval_text === 'custom') {
            return parseInt(formData.interval_custom, 10) || 12;
        }
        return parseInt(formData.interval_text, 10) || 12;
    };

    const handleSave = async () => {
        setErrorMsg('');
        setSuccessMsg('');
        setSavedAssetCode('');

        if (!formData.site_id) return setErrorMsg('Vui lòng chọn Vị trí sử dụng (Site).');
        if (!formData.equipment_category) return setErrorMsg('Vui lòng chọn Loại thiết bị.');
        if (!formData.equipment_name.trim()) return setErrorMsg('Tên thiết bị không được để trống.');
        if (!formData.serial_or_model.trim()) return setErrorMsg('Số serial/Mã hiệu không được để trống.');
        if (!formData.next_due_date) return setErrorMsg('Hạn KĐ tiếp theo không được để trống.');

        // Extra validation rules
        if (formData.interval_text === 'custom') {
            const customVal = parseInt(formData.interval_custom, 10);
            if (isNaN(customVal) || customVal <= 0) return setErrorMsg('Chu kỳ tùy chỉnh phải lớn hơn 0 tháng.');
        }
        if (formData.last_inspection_date && formData.next_due_date) {
            if (new Date(formData.next_due_date) < new Date(formData.last_inspection_date)) {
                return setErrorMsg('Hạn KĐ tiếp theo không thể trước ngày KĐ gần nhất.');
            }
        }

        setIsSubmitting(true);

        try {
            // 1) Generate Asset Code: {SITE}-{CATCODE}-{RUNNING}
            const catItem = YCNN_EQUIPMENT_CATS.find(c => c.code === formData.equipment_category);
            const typeLabel = catItem ? catItem.label_short : formData.equipment_category;
            const abr = formData.equipment_category; // using code as abr

            // Find Max running
            const { data: existingCodes } = await supabase
                .from('assets')
                .select('asset_code')
                .eq('site_id', formData.site_id)
                .ilike('asset_code', `${formData.site_id}-${abr}-%`);

            let maxRunning = 0;
            if (existingCodes) {
                existingCodes.forEach(record => {
                    const parts = record.asset_code.split('-');
                    if (parts.length >= 3) {
                        const num = parseInt(parts[2], 10);
                        if (!isNaN(num)) maxRunning = Math.max(maxRunning, num);
                    }
                });
            }

            const nextNum = (maxRunning + 1).toString().padStart(3, '0');
            const assetCode = `${formData.site_id}-${abr}-${nextNum}`;

            // Formatting description
            let fullDesc = `Serial/Model: ${formData.serial_or_model}\n`;
            const declaredLabel = formData.declared_status === 'declared' ? 'Đã khai báo'
                : formData.declared_status === 'not_required' ? 'Không yêu cầu'
                    : 'Chưa khai báo';
            fullDesc += `Trạng thái khai báo: ${declaredLabel}\n`;
            if (formData.description_raw) fullDesc += `\nCấu hình/Mô tả:\n${formData.description_raw}`;

            // 2) Create Asset
            const assetPayload = {
                asset_code: assetCode,
                equipment_type: typeLabel,
                equipment_name: formData.equipment_name,
                model: null,
                serial: null,
                year_made: null,
                manufacturer: null,
                working_pressure: null,
                capacity_or_rating: null,
                is_strict_required: true,
                status: 'in_service' as const,
                last_inspection_date: formData.last_inspection_date || null,
                next_due_date: formData.next_due_date,
                interval_months: getFormInterval(),
                inspection_agency: formData.inspection_agency || null,
                created_by: profile?.id || null,
                site_id: formData.site_id,
                location: formData.site_id, // Default location to site
                description_raw: formData.description_raw || null,
                equipment_category: formData.equipment_category,
                serial_or_model: formData.serial_or_model,
                interval_text: formData.interval_text,
                stamp_no: formData.stamp_no || null,
                declared_status: formData.declared_status,
                declaration_doc_no: formData.declaration_doc_no || null
            };

            const newAsset = await assetsService.create(assetPayload);

            // 3) Create Event if needed
            if (formData.last_inspection_date || formData.stamp_no || formData.inspection_agency) {
                const interval = getFormInterval();
                await eventsService.create({
                    asset_id: newAsset.id,
                    event_type: 'periodic',
                    interval_months: interval,
                    status: 'done',
                    planned_date: formData.last_inspection_date || new Date().toISOString().split('T')[0],
                    performed_date: formData.last_inspection_date || new Date().toISOString().split('T')[0],
                    result: 'pass',
                    stamp_no: formData.stamp_no || null,
                    agency: formData.inspection_agency || null,
                    next_due_date: formData.next_due_date,
                    notes: 'Tạo tự động khi thêm mới TB YCNN',
                    created_by: profile?.id || null
                });

                // Also create the planned event that comes next
                await eventsService.createPlanned(
                    newAsset.id,
                    formData.next_due_date,
                    interval,
                    profile?.id
                );
            } else {
                await eventsService.createPlanned(
                    newAsset.id,
                    formData.next_due_date,
                    getFormInterval(),
                    profile?.id
                );
            }

            // 4) Create Document if declared
            if (formData.declaration_doc_no) {
                await docsService.create({
                    asset_id: newAsset.id,
                    event_id: null,
                    site_id: formData.site_id,
                    doc_type: 'declaration_letter',
                    doc_no: formData.declaration_doc_no || null,
                    title: `Chứng nhận số ${formData.declaration_doc_no}`,
                    description: null,
                    original_file_name: null,
                    file_path: '#',
                    file_name: null,
                    file_size: null,
                    mime_type: null,
                    issue_date: null,
                    expiry_date: null,
                    updated_at: null,
                    deleted_at: null,
                    deleted_by: null,
                });
            }

            setSavedAssetCode(assetCode);
            setSuccessMsg('Thêm thiết bị YCNN thành công!');
            window.scrollTo({ top: 0, behavior: 'smooth' });

        } catch (error) {
            console.error('Lỗi khi lưu YCNN:', error);
            setErrorMsg((error as Error).message || 'Có lỗi khi lưu thiết bị. Vui lòng thử lại.');
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="space-y-6 max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
            <div className="flex items-center justify-between mb-2">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">Thêm Thiết Bị YCNN</h1>
                    <p className="text-gray-500 mt-1">Nhập thông tin cho thiết bị theo dõi nghiêm ngặt YCNN.</p>
                </div>
            </div>

            {errorMsg && (
                <div className="bg-danger-50 border-l-4 border-danger-500 p-4 rounded-md flex items-start">
                    <AlertCircle className="w-5 h-5 text-danger-500 mr-3 mt-0.5 flex-shrink-0" />
                    <div>
                        <h3 className="text-sm font-medium text-danger-800">Lỗi lưu dữ liệu</h3>
                        <p className="mt-1 text-sm text-danger-700">{errorMsg}</p>
                    </div>
                </div>
            )}

            {successMsg && (
                <div className="bg-success-50 border-l-4 border-success-500 p-5 rounded-xl">
                    <p className="text-sm font-bold text-success-800 mb-4">{successMsg}</p>
                    <div className="flex flex-col sm:flex-row gap-3">
                        <button
                            onClick={() => navigate(`/thiet-bi/${savedAssetCode}`)}
                            className="flex-1 px-5 py-2.5 bg-primary-600 text-white rounded-xl font-semibold hover:bg-primary-700 transition-colors flex items-center justify-center gap-2"
                        >
                            <span>Xem chi tiết ngay</span>
                            <span className="text-primary-200 font-mono text-xs">{savedAssetCode}</span>
                        </button>
                        <button
                            onClick={() => {
                                // Reset form for another entry
                                setSavedAssetCode('');
                                setSuccessMsg('');
                                setFormData({
                                    site_id: formData.site_id,
                                    equipment_category: '',
                                    equipment_name: '',
                                    serial_or_model: '',
                                    description_raw: '',
                                    interval_text: '12',
                                    interval_custom: '',
                                    last_inspection_date: '',
                                    next_due_date: '',
                                    stamp_no: '',
                                    inspection_agency: '',
                                    declared_status: 'not_declared',
                                    declaration_doc_no: '',
                                });
                            }}
                            className="flex-1 px-5 py-2.5 bg-white border border-gray-300 text-gray-700 rounded-xl font-semibold hover:bg-gray-50 transition-colors flex items-center justify-center gap-2"
                        >
                            + Thêm thiết bị khác
                        </button>
                        <button
                            onClick={() => navigate('/thiet-bi')}
                            className="sm:flex-none px-5 py-2.5 bg-white border border-gray-200 text-gray-500 rounded-xl font-medium hover:bg-gray-50 transition-colors"
                        >
                            Về danh sách
                        </button>
                    </div>
                </div>
            )}

            <div className="bg-white shadow-sm border border-gray-200 rounded-xl overflow-hidden">
                <div className="p-6 sm:p-8 grid grid-cols-1 md:grid-cols-2 gap-6">

                    {/* Col 1 */}
                    <div className="space-y-5">
                        <div>
                            <label className="block text-sm font-semibold text-gray-700 mb-1.5">Vị trí / Nhà máy sử dụng <span className="text-danger-500">*</span></label>
                            <div className="w-full">
                                <SiteDropdown
                                    value={formData.site_id}
                                    onChange={(val) => setFormData(prev => ({ ...prev, site_id: val }))}
                                    options={sites}
                                    loading={sitesLoading}
                                />
                            </div>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                2. Loại thiết bị (Danh mục)*
                            </label>
                            <select
                                value={formData.equipment_category}
                                onChange={(e) => setFormData({ ...formData, equipment_category: e.target.value })}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-primary-500 focus:border-primary-500"
                            >
                                <option value="" disabled>-- Chọn loại YCNN --</option>
                                {YCNN_EQUIPMENT_CATS.map(cat => (
                                    <option key={cat.code} value={cat.code} title={cat.label_full}>
                                        {cat.code} - {cat.label_short}
                                    </option>
                                ))}
                            </select>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                3. Tên thiết bị*
                            </label>
                            <input
                                type="text"
                                value={formData.equipment_name}
                                onChange={(e) => setFormData({ ...formData, equipment_name: e.target.value })}
                                placeholder="Nhập tên thiết bị"
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-primary-500 focus:border-primary-500"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                4. Số Serial / Mã hiệu*
                            </label>
                            <input
                                type="text"
                                value={formData.serial_or_model}
                                onChange={(e) => setFormData({ ...formData, serial_or_model: e.target.value })}
                                placeholder="Nhập Serial hoặc quy cách"
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-primary-500 focus:border-primary-500"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                5. Miêu tả (Thông số kỹ thuật)
                            </label>
                            <textarea
                                value={formData.description_raw}
                                onChange={(e) => setFormData({ ...formData, description_raw: e.target.value })}
                                rows={4}
                                placeholder="Công suất, áp suất làm việc, năm sản xuất..."
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-primary-500 focus:border-primary-500"
                            ></textarea>
                        </div>
                    </div>

                    {/* Col 2 */}
                    <div className="space-y-5">
                        <div className="grid grid-cols-2 gap-4">
                            <div className="col-span-2">
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    6. Thời hạn KĐ/CĐ
                                </label>
                                <div className="flex gap-2">
                                    <select
                                        value={formData.interval_text}
                                        onChange={(e) => setFormData({ ...formData, interval_text: e.target.value })}
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-primary-500 focus:border-primary-500"
                                    >
                                        <option value="6">6 Tháng</option>
                                        <option value="12">1 Năm</option>
                                        <option value="24">2 Năm</option>
                                        <option value="36">3 Năm</option>
                                        <option value="custom">Nhập số khác</option>
                                    </select>
                                    {formData.interval_text === 'custom' && (
                                        <input
                                            type="number"
                                            placeholder="Tháng"
                                            value={formData.interval_custom}
                                            onChange={(e) => setFormData({ ...formData, interval_custom: e.target.value })}
                                            className="w-24 px-3 py-2 border border-gray-300 rounded-lg focus:ring-primary-500 focus:border-primary-500"
                                        />
                                    )}
                                </div>
                            </div>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                7. Ngày KĐ gần nhất
                            </label>
                            <input
                                type="date"
                                value={formData.last_inspection_date}
                                onChange={(e) => setFormData({ ...formData, last_inspection_date: e.target.value })}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-primary-500 focus:border-primary-500"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                8. Hạn KĐ tiếp theo*
                            </label>
                            <div className="flex gap-2">
                                <input
                                    type="date"
                                    value={formData.next_due_date}
                                    onChange={(e) => setFormData({ ...formData, next_due_date: e.target.value })}
                                    className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-primary-500 focus:border-primary-500"
                                />
                                <button
                                    onClick={handleCalcNextDue}
                                    className="bg-gray-100 hover:bg-gray-200 text-gray-700 px-3 py-2 rounded-lg font-medium transition-colors border border-gray-300"
                                    type="button"
                                >
                                    Tự tính
                                </button>
                            </div>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                9. Số tem KĐ/CĐ
                            </label>
                            <input
                                type="text"
                                value={formData.stamp_no}
                                onChange={(e) => setFormData({ ...formData, stamp_no: e.target.value })}
                                placeholder="KT..."
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-primary-500 focus:border-primary-500"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                10. Đơn vị KĐ/CĐ
                            </label>
                            <input
                                type="text"
                                value={formData.inspection_agency}
                                onChange={(e) => setFormData({ ...formData, inspection_agency: e.target.value })}
                                placeholder="Tên cơ quan, tổ chức kiểm định"
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-primary-500 focus:border-primary-500"
                            />
                        </div>

                        <div className="grid grid-cols-2 gap-4 bg-gray-50 p-4 rounded-xl border border-gray-100">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    11. Khai báo SỞ
                                </label>
                                <select
                                    value={formData.declared_status}
                                    onChange={(e) => {
                                        const val = e.target.value;
                                        setFormData(prev => ({
                                            ...prev,
                                            declared_status: val,
                                            declaration_doc_no: val === 'declared' ? prev.declaration_doc_no : ''
                                        }));
                                    }}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-primary-500 focus:border-primary-500"
                                >
                                    <option value="declared">Đã khai báo</option>
                                    <option value="not_declared">Chưa khai báo</option>
                                    <option value="exempt">Không yêu cầu</option>
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    12. Số CV XN
                                </label>
                                <input
                                    type="text"
                                    disabled={formData.declared_status !== 'declared'}
                                    value={formData.declaration_doc_no}
                                    onChange={(e) => setFormData({ ...formData, declaration_doc_no: e.target.value })}
                                    placeholder={formData.declared_status === 'declared' ? 'Số công văn' : 'N/A'}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-primary-500 focus:border-primary-500 disabled:bg-gray-100 disabled:text-gray-400"
                                />
                            </div>
                        </div>

                    </div>
                </div>

                <div className="bg-gray-50 p-6 sm:px-8 border-t border-gray-200 flex flex-col sm:flex-row justify-end gap-3 rounded-b-xl">
                    <button
                        onClick={() => navigate('/thiet-bi')}
                        disabled={isSubmitting}
                        className="px-5 py-2.5 bg-white border border-gray-300 text-gray-700 rounded-xl hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 font-medium transition-colors flex items-center justify-center disabled:opacity-50"
                    >
                        <X className="w-5 h-5 mr-1.5 text-gray-400" />
                        Hủy bỏ
                    </button>

                    <button
                        type="button"
                        onClick={() => handleSave()}
                        disabled={isSubmitting}
                        className="px-6 py-2.5 bg-primary-600 text-white rounded-xl font-semibold hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 transition-colors disabled:opacity-50 flex items-center justify-center min-w-[140px]"
                    >
                        {isSubmitting ? <Loader2 className="w-5 h-5 animate-spin" /> : <><Save className="w-5 h-5 mr-2" /> Lưu Nháp / Tạo mới</>}
                    </button>
                </div>
            </div>
        </div>
    );
};
