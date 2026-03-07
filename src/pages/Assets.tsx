import React, { useEffect, useState, useMemo } from 'react';
import type { Asset } from '../types/database';
import { useAuth } from '../contexts/AuthContext';
import { Search, Plus, Filter, Eye, ChevronLeft, ChevronRight, Download, RefreshCcw } from 'lucide-react';
import { format, differenceInDays } from 'date-fns';
import { Link, useSearchParams } from 'react-router-dom';
import { assetsService } from '../services/assetsService';
import { useSiteScope } from '../hooks/useSiteScope';
import { SiteDropdown } from '../components/SiteDropdown';
import * as XLSX from 'xlsx';

export const Assets: React.FC = () => {
    const { profile } = useAuth();
    const { selectedSiteId, setSelectedSiteId, sites, loading: sitesLoading } = useSiteScope();
    const [searchParams] = useSearchParams();

    // Seed search from URL param (e.g. after import navigation)
    const [searchQuery, setSearchQuery] = useState(() => searchParams.get('search') || '');

    const [assets, setAssets] = useState<Asset[]>([]);
    const [loading, setLoading] = useState(true);

    const [filterCategory, setFilterCategory] = useState('all');
    const [filterStatus, setFilterStatus] = useState('all');
    const [filterDueStatus, setFilterDueStatus] = useState('all');
    const [filterDeclared, setFilterDeclared] = useState('all');
    const [errorMsg, setErrorMsg] = useState('');

    const [expandedDescIds, setExpandedDescIds] = useState<Set<string>>(new Set());

    // Pagination
    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 10;

    useEffect(() => {
        if (!selectedSiteId) return;
        fetchAssets();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [selectedSiteId, searchParams.get('refresh')]);
    // ^ re-fetch when ?refresh= changes (navigated here from import)

    const fetchAssets = async () => {
        setLoading(true);
        setErrorMsg('');
        try {
            const data = await assetsService.list({ site_id: selectedSiteId || undefined });
            setAssets(data);
        } catch (error) {
            const msg = error instanceof Error ? error.message : String(error);
            if (!msg.includes('AbortError')) {
                setErrorMsg(msg);
            }
        } finally {
            setLoading(false);
        }
    };

    const getDueStatus = (nextDueDate: string | null) => {
        if (!nextDueDate) return 'ok';
        const days = differenceInDays(new Date(nextDueDate), new Date());
        if (days < 0) return 'overdue';
        if (days <= 30) return 'due_soon'; // 30 is fallback for due_soon_days
        return 'ok';
    };

    const toggleDesc = (id: string, e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setExpandedDescIds(prev => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    };

    const filteredAssets = useMemo(() => {
        return assets.filter(asset => {
            const q = searchQuery.toLowerCase();
            const matchSearch =
                (asset.asset_code || '').toLowerCase().includes(q) ||
                (asset.equipment_name || '').toLowerCase().includes(q) ||
                (asset.description_raw || '').toLowerCase().includes(q) ||
                (asset.location || '').toLowerCase().includes(q) ||
                (asset.serial_or_model || '').toLowerCase().includes(q);

            const matchCat = filterCategory === 'all' || asset.equipment_type === filterCategory || asset.equipment_category === filterCategory;
            const matchStatus = filterStatus === 'all' || asset.status === filterStatus;

            const dueStatus = getDueStatus(asset.next_due_date);
            const matchDue = filterDueStatus === 'all' || dueStatus === filterDueStatus;

            const matchDeclared = filterDeclared === 'all' || asset.declared_status === filterDeclared;

            return matchSearch && matchCat && matchStatus && matchDue && matchDeclared;
        });
    }, [assets, searchQuery, filterCategory, filterStatus, filterDueStatus, filterDeclared]);

    const uniqueCategories = Array.from(new Set(assets.map(a => a.equipment_category || a.equipment_type))).filter(Boolean);

    const exportToExcel = () => {
        const today = new Date();
        const mapData = filteredAssets.map(a => {
            const days = a.next_due_date ? differenceInDays(new Date(a.next_due_date), today) : null;
            const daysLabel = days === null ? '' : days < 0 ? `Quá hạn ${-days} ngày` : `Còn ${days} ngày`;
            return {
                "Mã Thiết bị": a.asset_code,
                "Tên Thiết bị": a.equipment_name || '',
                "Nhà máy": a.site_id,
                "Khu vực/Vị trí": a.location || '',
                "Phân loại": a.equipment_category || a.equipment_type || '',
                "Sê-ri/Model": a.serial_or_model || '',
                "Khai báo": a.declared_status === 'declared' ? 'Đã khai báo' : (a.declared_status === 'not_declared' ? 'Chưa khai báo' : 'Không yêu cầu'),
                "Số CV Khai báo": a.declaration_doc_no || '',
                "Hạn KĐ": a.next_due_date ? format(new Date(a.next_due_date), 'dd/MM/yyyy') : '',
                "Số ngày": daysLabel,
                "Trạng thái Hạn": getDueStatus(a.next_due_date) === 'overdue' ? 'Quá hạn' : (getDueStatus(a.next_due_date) === 'due_soon' ? 'Sắp đến hạn' : 'OK'),
                "Trạng thái Hoạt động": a.status === 'in_service' ? 'Đang hoạt động' : (a.status === 'out_of_service' ? 'Bảo trì' : (a.status === 'locked' ? 'Đã khóa' : a.status)),
                "Miêu tả": a.description_raw || ''
            };
        });
        const wb = XLSX.utils.book_new();
        const ws = XLSX.utils.json_to_sheet(mapData);
        XLSX.utils.book_append_sheet(wb, ws, "DanhSachThietBi");
        XLSX.writeFile(wb, `DanhSachThietBi_${selectedSiteId}_${format(new Date(), 'yyyyMMdd')}.xlsx`);
    };

    // Pagination
    const totalPages = Math.ceil(filteredAssets.length / itemsPerPage);
    const paginatedAssets = filteredAssets.slice(
        (currentPage - 1) * itemsPerPage,
        currentPage * itemsPerPage
    );

    useEffect(() => {
        setCurrentPage(1);
    }, [searchQuery, filterCategory, filterStatus, filterDueStatus, filterDeclared, selectedSiteId]);

    const renderDueBadge = (nextDueDate: string | null) => {
        if (!nextDueDate) return <span className="text-gray-400">-</span>;
        const status = getDueStatus(nextDueDate);
        const dateStr = format(new Date(nextDueDate), 'dd/MM/yyyy');

        if (status === 'overdue') {
            return <div className="text-danger-700 font-bold bg-danger-50 px-2 py-0.5 rounded border border-danger-200 inline-block">{dateStr}</div>;
        }
        if (status === 'due_soon') {
            return <div className="text-amber-700 font-bold bg-amber-50 px-2 py-0.5 rounded border border-amber-200 inline-block">{dateStr}</div>;
        }
        return <div className="text-gray-900 font-medium">{dateStr}</div>;
    };

    return (
        <div className="space-y-6 max-w-[95%] xl:max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">

            {/* Error Banner */}
            {errorMsg && (
                <div className="bg-red-50 border-l-4 border-red-500 p-3 rounded-lg text-sm text-red-700 font-medium flex items-center gap-2">
                    <span className="font-bold">Lỗi:</span> {errorMsg}
                    <button onClick={() => setErrorMsg('')} className="ml-auto text-red-400 hover:text-red-600 font-bold text-lg leading-none">&times;</button>
                </div>
            )}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 py-4 border-b border-gray-100">
                <div className="flex items-center gap-3">
                    <h1 className="text-2xl font-bold text-gray-900">Danh sách Thiết bị</h1>
                    <div className="w-48 hidden sm:block">
                        <SiteDropdown
                            value={selectedSiteId}
                            onChange={setSelectedSiteId}
                            options={sites}
                            loading={sitesLoading}
                        />
                    </div>
                </div>

                <div className="flex flex-col sm:flex-row gap-2 w-full md:w-auto">
                    <div className="w-full sm:hidden mb-2">
                        <SiteDropdown
                            value={selectedSiteId}
                            onChange={setSelectedSiteId}
                            options={sites}
                            loading={sitesLoading}
                        />
                    </div>

                    {(profile?.role === 'engineering' || profile?.role === 'hse') && (
                        <>
                            <Link
                                to="/thiet-bi/them-ycnn"
                                className="w-full sm:w-auto inline-flex items-center justify-center px-4 py-2.5 text-sm font-semibold text-white bg-primary-600 border border-transparent rounded-xl shadow-sm hover:bg-primary-700 transition-colors"
                            >
                                <Plus className="w-4 h-4 mr-1.5" /> Thêm YCNN
                            </Link>
                            <Link
                                to="/nhap-du-lieu?mode=ycnn"
                                className="w-full sm:w-auto inline-flex items-center justify-center px-4 py-2.5 text-sm font-semibold text-primary-700 bg-primary-50 border border-primary-200 rounded-xl hover:bg-primary-100 transition-colors"
                            >
                                <Plus className="w-4 h-4 mr-1.5" /> Import Excel
                            </Link>
                        </>
                    )}
                    <button
                        onClick={exportToExcel}
                        disabled={filteredAssets.length === 0}
                        className="w-full sm:w-auto inline-flex items-center justify-center px-4 py-2.5 text-sm font-semibold text-gray-700 bg-white border border-gray-300 rounded-xl shadow-sm hover:bg-gray-50 transition-colors disabled:opacity-50"
                    >
                        <Download className="w-4 h-4 mr-1.5" /> Xuất CSV
                    </button>
                </div>
            </div>

            {/* Filter Section */}
            <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 flex flex-col xl:flex-row gap-4">
                <div className="relative flex-1">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <Search className="h-5 w-5 text-gray-400" />
                    </div>
                    <input
                        type="text"
                        className="block w-full pl-10 pr-3 py-2.5 border border-gray-200 rounded-xl bg-gray-50 placeholder-gray-400 focus:outline-none focus:bg-white focus:ring-2 focus:ring-primary-500 focus:border-transparent text-sm transition-all"
                        placeholder="Tìm theo mã, tên, S/N, vị trí, miêu tả..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                    />
                </div>

                <div className="flex flex-col sm:flex-row gap-3">
                    <div className="relative min-w-[160px]">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                            <Filter className="h-4 w-4 text-gray-400" />
                        </div>
                        <select
                            className="block w-full pl-9 pr-8 py-2.5 border border-gray-200 rounded-xl bg-gray-50 focus:outline-none focus:bg-white focus:ring-2 focus:ring-primary-500 text-sm transition-all appearance-none"
                            value={filterCategory}
                            onChange={(e) => setFilterCategory(e.target.value)}
                            title="Phân loại / Category"
                        >
                            <option value="all">Tất cả phân loại</option>
                            {uniqueCategories.map(type => (
                                <option key={String(type)} value={String(type)}>{String(type)}</option>
                            ))}
                        </select>
                    </div>

                    <select
                        className="block w-full sm:w-auto px-4 py-2.5 border border-gray-200 rounded-xl bg-gray-50 focus:outline-none focus:bg-white focus:ring-2 focus:ring-primary-500 text-sm appearance-none font-medium"
                        value={filterDueStatus}
                        onChange={(e) => setFilterDueStatus(e.target.value)}
                    >
                        <option value="all">Mọi hạn KĐ</option>
                        <option value="ok">Bình thường (OK)</option>
                        <option value="due_soon">Sắp đến hạn</option>
                        <option value="overdue">Quá hạn</option>
                    </select>

                    <select
                        className="block w-full sm:w-auto px-4 py-2.5 border border-gray-200 rounded-xl bg-gray-50 focus:outline-none focus:bg-white focus:ring-2 focus:ring-primary-500 text-sm appearance-none font-medium"
                        value={filterStatus}
                        onChange={(e) => setFilterStatus(e.target.value)}
                    >
                        <option value="all">Mọi trạng thái</option>
                        <option value="in_service">Đang hoạt động</option>
                        <option value="out_of_service">Bảo trì / Ngưng</option>
                        <option value="locked">Đã khóa</option>
                    </select>

                    {/* Declared Status Filter */}
                    <select
                        className="block w-full sm:w-auto px-4 py-2.5 border border-gray-200 rounded-xl bg-gray-50 focus:outline-none focus:bg-white focus:ring-2 focus:ring-primary-500 text-sm appearance-none font-medium"
                        value={filterDeclared}
                        onChange={(e) => setFilterDeclared(e.target.value)}
                    >
                        <option value="all">Mọi khai báo</option>
                        <option value="declared">Đã khai báo Sở</option>
                        <option value="not_declared">Chưa khai báo</option>
                    </select>

                    {/* Clear filters */}
                    {(filterCategory !== 'all' || filterStatus !== 'all' || filterDueStatus !== 'all' || filterDeclared !== 'all' || searchQuery) && (
                        <button
                            onClick={() => { setFilterCategory('all'); setFilterStatus('all'); setFilterDueStatus('all'); setFilterDeclared('all'); setSearchQuery(''); }}
                            className="px-3 py-2.5 text-xs font-bold text-gray-500 hover:text-red-600 bg-gray-50 hover:bg-red-50 border border-gray-200 hover:border-red-200 rounded-xl transition-all whitespace-nowrap"
                        >
                            × Xóa lọc
                        </button>
                    )}
                </div>
            </div>

            {loading ? (
                <div className="hidden md:block bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden min-h-[400px]">
                    <div className="flex items-center justify-center h-full pt-20">
                        <RefreshCcw className="w-8 h-8 text-primary-500 animate-spin" />
                    </div>
                </div>
            ) : (
                <>
                    {/* Desktop View */}
                    <div className="hidden md:block bg-white rounded-2xl shadow-sm border border-gray-100 overflow-visible z-0">
                        <div className="overflow-x-auto min-h-[300px]">
                            <table className="w-full text-left border-collapse whitespace-nowrap">
                                <thead>
                                    <tr className="bg-gray-50 border-b border-gray-200 text-gray-600 text-xs uppercase tracking-wider font-bold">
                                        <th className="px-6 py-4">Mã / Tên TB</th>
                                        <th className="px-6 py-4">Sê-ri/Model</th>
                                        <th className="px-6 py-4">Loại / Khu vực</th>
                                        <th className="px-6 py-4">Khai báo</th>
                                        <th className="px-6 py-4">Hạn KĐ</th>
                                        <th className="px-6 py-4">Trạng thái</th>
                                        <th className="px-6 py-4 text-center sticky right-0 bg-gray-50 shadow-[-5px_0_10px_-5px_rgba(0,0,0,0.05)] z-10 w-16">Thao tác</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100 text-sm">
                                    {paginatedAssets.length > 0 ? (
                                        paginatedAssets.map((asset) => (
                                            <tr key={asset.id} className="hover:bg-primary-50/30 transition-colors group">
                                                <td className="px-6 py-4 min-w-[200px] whitespace-normal">
                                                    <div className="font-bold text-gray-900 group-hover:text-primary-600 transition-colors flex items-center gap-2">
                                                        <span>{asset.asset_code}</span>
                                                    </div>
                                                    <div className="text-gray-600 mt-0.5 line-clamp-1" title={asset.equipment_name || ''}>{asset.equipment_name}</div>
                                                    {asset.description_raw && (
                                                        <div className="mt-1">
                                                            <div className={`text-xs text-gray-500 whitespace-pre-line ${expandedDescIds.has(asset.id) ? '' : 'line-clamp-1'}`}>
                                                                {asset.description_raw}
                                                            </div>
                                                            <button
                                                                onClick={(e) => toggleDesc(asset.id, e)}
                                                                className="text-primary-500 hover:text-primary-700 text-[10px] font-bold uppercase mt-0.5 focus:outline-none"
                                                            >
                                                                {expandedDescIds.has(asset.id) ? 'Thu gọn' : 'Chi tiết'}
                                                            </button>
                                                        </div>
                                                    )}
                                                </td>
                                                <td className="px-6 py-4">
                                                    <div className="text-gray-900 font-mono text-xs font-semibold">{asset.serial_or_model || <span className="text-gray-400 font-sans">-</span>}</div>
                                                </td>
                                                <td className="px-6 py-4">
                                                    <div className="text-gray-900 font-medium">{asset.equipment_category || asset.equipment_type || '-'}</div>
                                                    <div className="text-gray-500 text-xs mt-0.5 max-w-[150px] truncate" title={asset.location || ''}>{asset.location || '-'}</div>
                                                </td>
                                                <td className="px-6 py-4">
                                                    {asset.declared_status === 'declared' ? (
                                                        <span className="text-success-700 bg-success-50 border border-success-200 px-2 py-0.5 text-xs rounded font-bold">Đã KB</span>
                                                    ) : asset.declared_status === 'not_declared' ? (
                                                        <span className="text-warning-700 bg-warning-50 border border-warning-200 px-2 py-0.5 text-xs rounded font-bold">Chưa KB</span>
                                                    ) : (
                                                        <span className="text-gray-500 bg-gray-100 border border-gray-200 px-2 py-0.5 text-xs rounded">-</span>
                                                    )}
                                                </td>
                                                <td className="px-6 py-4">
                                                    {renderDueBadge(asset.next_due_date)}
                                                    {asset.next_due_date && (
                                                        <div className={`text-xs mt-0.5 font-medium ${getDueStatus(asset.next_due_date) === 'overdue' ? 'text-red-600' :
                                                            getDueStatus(asset.next_due_date) === 'due_soon' ? 'text-amber-600' : 'text-gray-400'
                                                            }`}>
                                                            {(() => {
                                                                const d = differenceInDays(new Date(asset.next_due_date), new Date());
                                                                return d < 0 ? `Quá hạn ${-d} ngày` : `Còn ${d} ngày`;
                                                            })()}
                                                        </div>
                                                    )}
                                                </td>
                                                <td className="px-6 py-4">
                                                    <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold border ${asset.status === 'in_service' ? 'bg-success-50 text-success-700 border-success-200' :
                                                        asset.status === 'locked' ? 'bg-danger-50 text-danger-700 border-danger-200' :
                                                            'bg-gray-100 text-gray-600 border-gray-200'
                                                        }`}>
                                                        {asset.status === 'in_service' ? 'Hoạt động' : asset.status === 'locked' ? 'Khóa' : 'Bảo trì'}
                                                    </span>
                                                </td>
                                                <td className="px-6 py-4 text-center sticky right-0 bg-white group-hover:bg-primary-50/10 shadow-[-5px_0_10px_-5px_rgba(0,0,0,0.05)] z-10 w-16 transition-colors">
                                                    <Link
                                                        to={`/thiet-bi/${asset.asset_code}`}
                                                        className="inline-flex items-center justify-center p-2 text-primary-600 hover:text-primary-800 hover:bg-primary-100 rounded-lg transition-colors"
                                                        title="Xem chi tiết"
                                                    >
                                                        <Eye className="w-5 h-5" />
                                                    </Link>
                                                </td>
                                            </tr>
                                        ))
                                    ) : (
                                        <tr>
                                            <td colSpan={7} className="px-6 py-16 text-center text-gray-500 font-medium">
                                                Không tìm thấy thiết bị nào phù hợp với bộ lọc hiện tại.
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    {/* Mobile Card View */}
                    <div className="grid grid-cols-1 gap-4 md:hidden">
                        {paginatedAssets.length > 0 ? (
                            paginatedAssets.map((asset) => (
                                <Link to={`/thiet-bi/${asset.asset_code}`} key={asset.id} className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100 active:scale-[0.98] transition-all block">
                                    <div className="flex justify-between items-start mb-2">
                                        <div>
                                            <span className="text-xs font-black text-primary-700 bg-primary-50 px-2 py-0.5 rounded border border-primary-100 mb-1.5 inline-block">
                                                {asset.asset_code}
                                            </span>
                                            <h3 className="font-bold text-gray-900 mt-0.5 line-clamp-2">{asset.equipment_name}</h3>
                                        </div>
                                        {renderDueBadge(asset.next_due_date)}
                                    </div>

                                    {asset.description_raw && (
                                        <div className="mb-3 text-sm text-gray-600 bg-gray-50/80 p-2.5 rounded-lg border border-gray-100 mt-2">
                                            <div className={`whitespace-pre-line text-xs ${expandedDescIds.has(asset.id) ? '' : 'line-clamp-2'}`}>
                                                {asset.description_raw}
                                            </div>
                                        </div>
                                    )}

                                    <div className="flex flex-wrap gap-2 text-xs text-gray-600 mt-3 pt-3 border-t border-gray-50">
                                        <span className="bg-gray-100 px-2 py-1 rounded text-gray-700"><span className="text-gray-400">Nhà máy:</span> {asset.site_id}</span>
                                        <span className="bg-gray-100 px-2 py-1 rounded text-gray-700"><span className="text-gray-400">Loại:</span> {asset.equipment_category || asset.equipment_type || '-'}</span>
                                        <span className="bg-gray-100 px-2 py-1 rounded text-gray-700"><span className="text-gray-400">S/N:</span> {asset.serial_or_model || '-'}</span>
                                        <span className="block w-full"></span>
                                        <span className={`inline-flex items-center px-2 py-1 rounded text-xs font-bold ${asset.status === 'in_service' ? 'bg-success-100 text-success-800' : 'bg-gray-200 text-gray-700'
                                            }`}>
                                            {asset.status === 'in_service' ? 'Hoạt động' : 'Tạm dừng'}
                                        </span>
                                        {asset.declared_status === 'declared' && (
                                            <span className="inline-flex items-center px-2 py-1 rounded text-xs font-bold bg-blue-50 text-blue-800 border border-blue-100">Đã KB Sở</span>
                                        )}
                                        {asset.next_due_date && (() => {
                                            const d = differenceInDays(new Date(asset.next_due_date), new Date());
                                            const label = d < 0 ? `Quá ${-d} ngày` : `Còn ${d} ngày`;
                                            const cls = d < 0 ? 'bg-red-50 text-red-700' : d < 30 ? 'bg-amber-50 text-amber-700' : 'bg-gray-100 text-gray-600';
                                            return <span className={`inline-flex items-center px-2 py-1 rounded text-xs font-bold ${cls}`}>{label}</span>;
                                        })()}
                                    </div>
                                </Link>
                            ))
                        ) : (
                            <div className="text-center py-12 text-gray-500 font-medium bg-white rounded-2xl border border-gray-100 shadow-sm">
                                Không có dữ liệu.
                            </div>
                        )}
                    </div>

                    {/* Pagination */}
                    {totalPages > 1 && (
                        <div className="flex items-center justify-between bg-white px-4 py-3 sm:px-6 rounded-2xl border border-gray-100 shadow-sm">
                            <div className="hidden sm:flex-1 sm:flex sm:items-center sm:justify-between">
                                <div>
                                    <p className="text-sm text-gray-700 font-medium">
                                        Hiển thị <span className="font-bold text-gray-900">{(currentPage - 1) * itemsPerPage + 1}</span> đến <span className="font-bold text-gray-900">{Math.min(currentPage * itemsPerPage, filteredAssets.length)}</span> / <span className="font-bold text-primary-600">{filteredAssets.length}</span> thiết bị
                                    </p>
                                </div>
                                <div>
                                    <nav className="relative z-0 inline-flex rounded-md shadow-sm -space-x-px" aria-label="Pagination">
                                        <button
                                            onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                                            disabled={currentPage === 1}
                                            className="relative inline-flex items-center px-3 py-2 rounded-l-md border border-gray-200 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50"
                                        >
                                            <span className="sr-only">Previous</span>
                                            <ChevronLeft className="h-5 w-5" aria-hidden="true" />
                                        </button>
                                        <span className="relative inline-flex items-center px-4 py-2 border-y border-gray-200 bg-gray-50 text-sm font-bold text-gray-700">
                                            {currentPage} <span className="text-gray-400 font-medium mx-1">/</span> {totalPages}
                                        </span>
                                        <button
                                            onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                                            disabled={currentPage === totalPages}
                                            className="relative inline-flex items-center px-3 py-2 rounded-r-md border border-gray-200 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50"
                                        >
                                            <span className="sr-only">Next</span>
                                            <ChevronRight className="h-5 w-5" aria-hidden="true" />
                                        </button>
                                    </nav>
                                </div>
                            </div>
                            {/* Mobile Pagination */}
                            <div className="flex items-center justify-between w-full sm:hidden">
                                <button
                                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                                    disabled={currentPage === 1}
                                    className="relative inline-flex items-center px-4 py-2 border border-gray-200 text-sm font-bold rounded-lg text-gray-700 bg-white hover:bg-gray-50 shadow-sm disabled:opacity-50"
                                >
                                    Trước
                                </button>
                                <span className="text-sm text-gray-700 font-bold">
                                    {currentPage} / {totalPages}
                                </span>
                                <button
                                    onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                                    disabled={currentPage === totalPages}
                                    className="relative inline-flex items-center px-4 py-2 border border-gray-200 text-sm font-bold rounded-lg text-gray-700 bg-white hover:bg-gray-50 shadow-sm disabled:opacity-50"
                                >
                                    Sau
                                </button>
                            </div>
                        </div>
                    )}
                </>
            )}
        </div>
    );
};
