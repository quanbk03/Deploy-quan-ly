import React, { useEffect, useState, useMemo } from 'react';
import { assetsService } from '../services/assetsService';
import { dashboardService } from '../services/dashboardService';
import type { Asset } from '../types/database';
import { useSiteScope } from '../hooks/useSiteScope';
import { SiteDropdown } from '../components/SiteDropdown';
import { AssetTable } from '../components/dashboard/AssetTable';
import { ToastContainer, useToast } from '../components/Toast';
import { AlertTriangle, Clock, RefreshCw, Search, Filter } from 'lucide-react';
import { differenceInDays } from 'date-fns';
import { supabase } from '../lib/supabase';
import { useSearchParams } from 'react-router-dom';

export const Overdue: React.FC = () => {
    const [searchParams] = useSearchParams();
    const defaultTab = (searchParams.get('tab') === 'due_soon' ? 'due_soon' : 'overdue') as 'overdue' | 'due_soon';

    const [activeTab, setActiveTab] = useState<'overdue' | 'due_soon'>(defaultTab);
    const [assets, setAssets] = useState<Asset[]>([]);
    const [loading, setLoading] = useState(true);
    const [dueSoonDays, setDueSoonDays] = useState(30);

    // Search and filter
    const [searchQuery, setSearchQuery] = useState('');
    const [filterCategory, setFilterCategory] = useState('all');

    const { sites, selectedSiteId, setSelectedSiteId, loading: sitesLoading } = useSiteScope();
    const { toasts, addToast, dismiss } = useToast();

    useEffect(() => {
        if (selectedSiteId) {
            fetchData();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [selectedSiteId]);

    const fetchData = async () => {
        setLoading(true);
        try {
            // Fetch dueSoonDays from site settings
            const days = await dashboardService.getSiteSettings(selectedSiteId!);
            setDueSoonDays(days);

            const data = await assetsService.list({ site_id: selectedSiteId || undefined });
            setAssets(data.filter(a => a.next_due_date !== null));
        } catch (error) {
            console.error('Lỗi lấy dữ liệu:', error);
            const msg = error instanceof Error ? error.message : String(error);
            if (!msg.includes('AbortError')) {
                addToast(`Lỗi tải dữ liệu: ${msg}`, 'error');
            }
        } finally {
            setLoading(false);
        }
    };

    const overdueAssets = useMemo(() => {
        return assets.filter(a => {
            const nextDue = new Date(a.next_due_date!);
            const diff = differenceInDays(new Date(), nextDue);
            const matchSearch = !searchQuery ||
                (a.asset_code || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
                (a.equipment_name || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
                (a.location || '').toLowerCase().includes(searchQuery.toLowerCase());
            const matchCat = filterCategory === 'all' || a.equipment_category === filterCategory || a.equipment_type === filterCategory;
            return diff > 0 && matchSearch && matchCat;
        }).sort((a, b) => new Date(a.next_due_date!).getTime() - new Date(b.next_due_date!).getTime());
    }, [assets, searchQuery, filterCategory]);

    const dueSoonAssets = useMemo(() => {
        return assets.filter(a => {
            const nextDue = new Date(a.next_due_date!);
            const diff = differenceInDays(nextDue, new Date());
            const matchSearch = !searchQuery ||
                (a.asset_code || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
                (a.equipment_name || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
                (a.location || '').toLowerCase().includes(searchQuery.toLowerCase());
            const matchCat = filterCategory === 'all' || a.equipment_category === filterCategory || a.equipment_type === filterCategory;
            return diff >= 0 && diff <= dueSoonDays && matchSearch && matchCat;
        }).sort((a, b) => new Date(a.next_due_date!).getTime() - new Date(b.next_due_date!).getTime());
    }, [assets, searchQuery, filterCategory, dueSoonDays]);

    const uniqueCategories = useMemo(() =>
        Array.from(new Set(assets.map(a => a.equipment_category || a.equipment_type))).filter(Boolean) as string[],
        [assets]);

    const handleLockToggle = async (assetId: string, currentStatus: string) => {
        const newStatus = currentStatus === 'locked' ? 'in_service' : 'locked';
        const label = newStatus === 'locked' ? 'khóa' : 'mở khóa';
        try {
            const { error } = await supabase.from('assets').update({ status: newStatus }).eq('id', assetId);
            if (error) throw error;
            setAssets(prev => prev.map(a => a.id === assetId ? { ...a, status: newStatus as Asset['status'] } : a));
            addToast(`Thiết bị đã được ${label} thành công!`, 'success');
        } catch (err) {
            addToast(`Lỗi ${label} thiết bị: ${(err as Error).message}`, 'error');
        }
    };

    const currentList = activeTab === 'overdue' ? overdueAssets : dueSoonAssets;

    return (
        <div className="space-y-6 max-w-[95%] xl:max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-20">
            <ToastContainer toasts={toasts} onDismiss={dismiss} />

            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 py-4 border-b border-gray-100">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">Quản lý Quá hạn &amp; Sắp đến hạn</h1>
                    <p className="text-gray-500 text-sm mt-1">
                        Theo dõi thiết bị vi phạm thời gian kiểm định.
                        {selectedSiteId && <span className="font-semibold text-primary-600 ml-2">Sắp đến hạn ≤ {dueSoonDays} ngày</span>}
                    </p>
                </div>

                <div className="flex flex-col sm:flex-row items-center gap-3 w-full md:w-auto">
                    <button
                        onClick={fetchData}
                        disabled={loading}
                        className="w-full sm:w-auto inline-flex items-center justify-center p-2.5 bg-white border border-gray-200 rounded-xl shadow-sm text-sm font-bold text-gray-700 hover:bg-gray-50 hover:text-primary-600 focus:outline-none focus:ring-2 focus:ring-primary-500 transition-colors disabled:opacity-50"
                        title="Làm mới dữ liệu"
                    >
                        <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin text-primary-500' : ''}`} />
                    </button>
                    <div className="w-full sm:w-auto">
                        <SiteDropdown
                            value={selectedSiteId}
                            onChange={setSelectedSiteId}
                            options={sites}
                            loading={sitesLoading}
                        />
                    </div>
                </div>
            </div>

            {/* Search & Category Filter */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 flex flex-col sm:flex-row gap-3">
                <div className="relative flex-1">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <Search className="h-4 w-4 text-gray-400" />
                    </div>
                    <input
                        type="text"
                        placeholder="Tìm mã thiết bị, tên, vị trí..."
                        className="block w-full pl-10 pr-3 py-2.5 border border-gray-200 rounded-xl bg-gray-50 placeholder-gray-400 focus:outline-none focus:bg-white focus:ring-2 focus:ring-primary-500 text-sm transition-all"
                        value={searchQuery}
                        onChange={e => setSearchQuery(e.target.value)}
                    />
                </div>
                <div className="relative flex items-center min-w-[180px]">
                    <Filter className="w-4 h-4 absolute left-3 text-gray-400 pointer-events-none" />
                    <select
                        className="block w-full pl-9 pr-3 py-2.5 border border-gray-200 rounded-xl bg-gray-50 focus:outline-none focus:bg-white focus:ring-2 focus:ring-primary-500 text-sm appearance-none"
                        value={filterCategory}
                        onChange={e => setFilterCategory(e.target.value)}
                    >
                        <option value="all">Tất cả danh mục</option>
                        {uniqueCategories.map(cat => (
                            <option key={cat} value={cat}>{cat}</option>
                        ))}
                    </select>
                </div>
                {(searchQuery || filterCategory !== 'all') && (
                    <button
                        onClick={() => { setSearchQuery(''); setFilterCategory('all'); }}
                        className="px-3 py-2.5 text-xs font-bold text-gray-500 hover:text-red-600 bg-gray-50 hover:bg-red-50 border border-gray-200 hover:border-red-200 rounded-xl transition-all whitespace-nowrap"
                    >
                        × Xóa lọc
                    </button>
                )}
            </div>

            {/* Tabs */}
            <div className="flex space-x-2 bg-gray-100/80 p-1.5 rounded-2xl max-w-md w-full sm:w-auto">
                <button
                    onClick={() => setActiveTab('overdue')}
                    className={`flex-1 flex items-center justify-center space-x-2 py-3 px-4 rounded-xl text-sm font-bold transition-all ${activeTab === 'overdue'
                        ? 'bg-white text-danger-600 shadow-sm border border-danger-100'
                        : 'text-gray-500 hover:text-gray-900 hover:bg-gray-200/50'
                        }`}
                >
                    <AlertTriangle className="w-4 h-4" />
                    <span>Đã quá hạn</span>
                    <span className={`px-2 py-0.5 rounded-full text-xs ml-1 ${activeTab === 'overdue' ? 'bg-danger-100 text-danger-700' : 'bg-gray-200 text-gray-600'}`}>{overdueAssets.length}</span>
                </button>
                <button
                    onClick={() => setActiveTab('due_soon')}
                    className={`flex-1 flex items-center justify-center space-x-2 py-3 px-4 rounded-xl text-sm font-bold transition-all ${activeTab === 'due_soon'
                        ? 'bg-white text-warning-600 shadow-sm border border-warning-100'
                        : 'text-gray-500 hover:text-gray-900 hover:bg-gray-200/50'
                        }`}
                >
                    <Clock className="w-4 h-4" />
                    <span>Sắp đến hạn</span>
                    <span className={`px-2 py-0.5 rounded-full text-xs ml-1 ${activeTab === 'due_soon' ? 'bg-warning-100 text-warning-700' : 'bg-gray-200 text-gray-600'}`}>{dueSoonAssets.length}</span>
                </button>
            </div>

            {/* Content List */}
            <div className="bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden">
                {currentList.length === 0 && !loading ? (
                    <div className="flex flex-col items-center justify-center py-16 text-gray-400">
                        {activeTab === 'overdue' ? <AlertTriangle className="w-10 h-10 mb-3 text-gray-300" /> : <Clock className="w-10 h-10 mb-3 text-gray-300" />}
                        <p className="font-semibold">Không có thiết bị {activeTab === 'overdue' ? 'quá hạn' : 'sắp đến hạn'}.</p>
                        {(searchQuery || filterCategory !== 'all') && (
                            <p className="text-sm mt-1">Thử xóa bộ lọc để xem toàn bộ.</p>
                        )}
                    </div>
                ) : (
                    <AssetTable
                        type={activeTab}
                        assets={currentList}
                        loading={loading}
                        siteId={selectedSiteId || undefined}
                        onLockToggle={handleLockToggle}
                    />
                )}
            </div>
        </div>
    );
};
