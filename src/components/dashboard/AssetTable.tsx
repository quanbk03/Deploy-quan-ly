import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { format, differenceInDays } from 'date-fns';
import { ShieldCheck, Clock, AlertCircle, Maximize2, Minimize2, Download, Search } from 'lucide-react';
import type { Asset } from '../../types/database';
import * as XLSX from 'xlsx';

interface AssetTableProps {
    assets: Asset[];
    loading: boolean;
    type: 'overdue' | 'due_soon';
    siteId?: string;
    onLockToggle?: (assetId: string, currentStatus: string) => void;
}

export const AssetTable: React.FC<AssetTableProps> = ({ assets, loading, type, siteId, onLockToggle }) => {
    const [isFullscreen, setIsFullscreen] = useState(false);
    const [filterDeclared, setFilterDeclared] = useState<string>('all');
    const [searchQuery, setSearchQuery] = useState('');
    const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc'); // asc: nearest/most overdue first

    if (loading) {
        return (
            <div className="p-4">
                <div className="h-10 bg-gray-200 rounded animate-pulse mb-4"></div>
                <div className="space-y-3">
                    {Array(5).fill(0).map((_, i) => (
                        <div key={i} className="h-16 bg-gray-100 rounded animate-pulse"></div>
                    ))}
                </div>
            </div>
        );
    }

    // Client-side filtering and sorting
    let filteredAssets = assets.filter(a => {
        const q = searchQuery.toLowerCase();
        const matchSearch = q === '' || (a.asset_code?.toLowerCase().includes(q) || a.equipment_name?.toLowerCase().includes(q) || false);
        const matchDeclared = filterDeclared === 'all' || a.declared_status === filterDeclared || (filterDeclared === 'not_declared' && (!a.declared_status || a.declared_status === 'none'));
        return matchSearch && matchDeclared;
    });

    filteredAssets.sort((a, b) => {
        const nextA = a.next_due_date ? new Date(a.next_due_date).getTime() : Infinity;
        const nextB = b.next_due_date ? new Date(b.next_due_date).getTime() : Infinity;

        // Cùng logic cho cả 2 tab: so sánh trực tiếp ngày. 
        // Đối với quá hạn, ngày càng nhỏ nghĩa là càng trễ sâu (âm lớn).
        // Đối với sắp đến hạn, ngày nhỏ là sắp tới ngay (dương nhỏ).
        // Do đó mặc định asc: những cái gấp/trễ nhất lên đầu.
        const order = sortOrder === 'asc' ? 1 : -1;
        return (nextA - nextB) * order;
    });

    const exportToExcel = () => {
        const mapData = filteredAssets.map(a => {
            const nextDue = a.next_due_date ? new Date(a.next_due_date) : null;
            const diffDays = nextDue ? differenceInDays(new Date(), nextDue) : 0;
            return {
                "Tên Thiết bị": a.equipment_name || '',
                "Mã Thiết bị": a.asset_code,
                "Vị trí": a.location || a.site_id,
                "Phân loại": a.equipment_category || a.equipment_type || '',
                "KĐ Gần nhất": a.last_inspection_date ? format(new Date(a.last_inspection_date), 'dd/MM/yyyy') : '',
                "Hạn KĐ": a.next_due_date ? format(new Date(a.next_due_date), 'dd/MM/yyyy') : '',
                "Trạng thái Hạn": type === 'overdue' ? `Quá hạn ${diffDays > 0 ? diffDays : -diffDays} ngày` : `Còn ${-diffDays} ngày`,
                "Đơn vị KĐ": a.inspection_agency || '',
                "Trạng thái KB": a.declared_status === 'declared' ? 'Đã KB' : (a.declared_status === 'not_declared' ? 'Chưa KB' : 'Không YC'),
                "Số CV": a.declaration_doc_no || ''
            };
        });
        const wb = XLSX.utils.book_new();
        const ws = XLSX.utils.json_to_sheet(mapData);
        XLSX.utils.book_append_sheet(wb, ws, "DanhSach");
        XLSX.writeFile(wb, `DanhSach_${type}_${siteId || 'all'}.xlsx`);
    };

    if (assets.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center py-12 text-gray-500">
                <div className="w-16 h-16 bg-success-50 text-success-500 rounded-full flex items-center justify-center mb-4 border border-success-100">
                    <ShieldCheck className="w-8 h-8" />
                </div>
                <h3 className="text-lg font-bold text-gray-900 mb-1">Tuyệt vời!</h3>
                <p>Không có thiết bị phần {type === 'overdue' ? 'quá hạn' : 'sắp đến hạn'}.</p>
            </div>
        );
    }

    const toggleFullscreen = () => {
        if (!document.fullscreenElement) {
            document.documentElement.requestFullscreen().catch(err => {
                console.warn('[AssetTable] Không thể mở toàn màn hình:', err.message);
            });
            setIsFullscreen(true);
        } else {
            document.exitFullscreen();
            setIsFullscreen(false);
        }
    };

    return (
        <div className={`flex flex-col ${isFullscreen ? 'fixed inset-0 z-[100] bg-white p-6 overflow-y-auto' : ''}`}>
            {/* Toolbar */}
            <div className="flex flex-col sm:flex-row justify-between items-center px-6 py-4 border-b border-gray-100 gap-4 bg-gray-50/50">
                <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto flex-1">
                    <div className="relative w-full sm:w-64">
                        <input
                            type="text"
                            placeholder="Tìm kiếm trong bảng..."
                            className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-lg focus:ring-1 focus:ring-primary-500"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                        />
                        <Search className="w-4 h-4 text-gray-400 absolute left-3 top-2.5" />
                    </div>
                    <select
                        className="w-full sm:w-auto px-3 py-2 text-sm border border-gray-200 rounded-lg focus:ring-1 focus:ring-primary-500"
                        value={filterDeclared}
                        onChange={(e) => setFilterDeclared(e.target.value)}
                    >
                        <option value="all">Khai báo: Tất cả</option>
                        <option value="declared">Đã khai báo</option>
                        <option value="not_declared">Chưa khai báo</option>
                    </select>
                </div>
                <div className="flex items-center gap-2 w-full sm:w-auto">
                    <button
                        onClick={() => setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc')}
                        className="px-3 py-2 bg-gray-50 border border-gray-200 text-gray-700 text-sm font-bold rounded-lg hover:bg-gray-100 flex-1 sm:flex-none text-center"
                    >
                        Đảo chiều Sắp xếp
                    </button>
                    <button
                        onClick={exportToExcel}
                        className="px-3 py-2 bg-primary-50 border border-primary-200 text-primary-700 text-sm font-bold rounded-lg hover:bg-primary-100 flex items-center justify-center flex-1 sm:flex-none"
                    >
                        <Download className="w-4 h-4 mr-1.5" /> Xuất
                    </button>
                    <button
                        onClick={toggleFullscreen}
                        className="p-2 bg-gray-50 border border-gray-200 text-gray-700 rounded-lg hover:bg-gray-100"
                        title="Toàn màn hình"
                    >
                        {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
                    </button>
                </div>
            </div>

            <div className="overflow-x-auto flex-1">
                <table className="w-full text-left border-collapse whitespace-nowrap min-w-[800px]">
                    <thead>
                        <tr className="bg-gray-50/80 text-gray-500 text-xs uppercase tracking-wider">
                            <th className="px-6 py-4 font-bold border-b border-gray-200">Tên / Mã TB</th>
                            <th className="px-6 py-4 font-bold border-b border-gray-200">Vị trí / Phân Loại</th>
                            <th className="px-6 py-4 font-bold border-b border-gray-200 hidden md:table-cell text-center hover:bg-gray-100 transition-colors cursor-pointer" onClick={() => setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc')} title="Bấm để đổi chiều HTT">Hạn Tiếp Theo {sortOrder === 'asc' ? '▲' : '▼'}</th>
                            <th className="px-6 py-4 font-bold border-b border-gray-200 text-center">Tình Trạng</th>
                            <th className="px-6 py-4 font-bold border-b border-gray-200 text-right pr-6">Chi tiết / Trạng thái KB</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 text-sm">
                        {filteredAssets.length > 0 ? filteredAssets.map((asset) => {
                            const nextDue = asset.next_due_date ? new Date(asset.next_due_date) : null;
                            const diffDays = nextDue ? differenceInDays(new Date(), nextDue) : 0; // if overdue, diff is + (today - due)

                            return (
                                <tr key={asset.id} className="hover:bg-primary-50/30 transition-colors group">
                                    <td className="px-6 py-4 pl-6">
                                        <Link to={`/thiet-bi/${asset.asset_code}`} className="font-bold text-gray-900 block group-hover:text-primary-600 transition-colors mb-0.5 max-w-[200px]" title={asset.equipment_name || ''}>
                                            <span className="line-clamp-2 leading-tight">{asset.equipment_name}</span>
                                        </Link>
                                        <span className="text-[11px] font-bold px-1.5 py-0.5 bg-gray-100 rounded text-gray-500 border border-gray-200">{asset.asset_code}</span>
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="text-gray-900 font-bold text-xs mb-0.5 truncate max-w-[150px]">{asset.location || asset.site_id}</div>
                                        <div className="text-xs text-gray-500 truncate max-w-[150px]">{asset.equipment_category || asset.equipment_type || '-'}</div>
                                    </td>
                                    <td className="px-6 py-4 text-center font-bold">
                                        <span className={`px-2 py-1 rounded-md border ${type === 'overdue' ? 'bg-red-50 text-red-700 border-red-100' : 'bg-amber-50 text-amber-700 border-amber-100'}`}>
                                            {nextDue ? format(nextDue, 'dd/MM/yyyy') : '-'}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 text-center">
                                        {type === 'overdue' ? (
                                            <div className="inline-flex items-center text-red-600 font-black whitespace-nowrap">
                                                <AlertCircle className="w-4 h-4 mr-1.5" />
                                                Quá hạn {diffDays > 0 ? diffDays : -diffDays} ngày
                                            </div>
                                        ) : (
                                            <div className="inline-flex items-center text-amber-600 font-bold whitespace-nowrap">
                                                <Clock className="w-4 h-4 mr-1.5" />
                                                Còn {-diffDays} ngày
                                            </div>
                                        )}
                                    </td>
                                    <td className="px-6 py-4 text-right pr-6">
                                        <div className="flex items-center justify-end gap-3 flex-wrap">
                                            {asset.declared_status === 'declared' ? (
                                                <span className="px-2 py-0.5 rounded text-[10px] font-black uppercase bg-success-50 text-success-700 border border-success-200 shadow-sm" title={asset.declaration_doc_no || 'Đã khai báo'}>
                                                    Đã KB Sở
                                                </span>
                                            ) : (
                                                asset.declared_status === 'not_declared' && (
                                                    <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-gray-100 text-gray-500 border border-gray-200">
                                                        Chưa KB
                                                    </span>
                                                )
                                            )}
                                        </div>
                                    </td>
                                </tr>
                            );
                        }) : (
                            <tr>
                                <td colSpan={6} className="text-center py-10 text-gray-500 font-medium">Không tìm thấy dữ liệu.</td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
};
