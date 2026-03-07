import React, { useEffect, useState } from 'react';
import { useSiteScope } from '../hooks/useSiteScope';
import { dashboardService, type DashboardFilters } from '../services/dashboardService';
import type { Asset } from '../types/database';
import { SiteDropdown } from '../components/SiteDropdown';
import { DashboardFiltersUI } from '../components/dashboard/DashboardFiltersUI';
import { KpiCards } from '../components/dashboard/KpiCards';
import { DueStatusPie } from '../components/dashboard/DueStatusPie';
import { OverdueByCategoryBar } from '../components/dashboard/OverdueByCategoryBar';
import { TrendLine } from '../components/dashboard/TrendLine';
import { AssetTable } from '../components/dashboard/AssetTable';
import { AlertCircle, Clock, ArrowDownToLine, Settings, RefreshCw } from 'lucide-react';
import { Link, useSearchParams } from 'react-router-dom';

export const Dashboard: React.FC = () => {
    const { selectedSiteId, setSelectedSiteId, sites, loading: siteLoading } = useSiteScope();
    const [searchParams] = useSearchParams();
    // ?refresh=<timestamp> from ImportData nav triggers auto-reload
    const urlRefreshKey = searchParams.get('refresh');

    const [filters, setFilters] = useState<DashboardFilters>({});
    const [dueSoonDays, setDueSoonDays] = useState(30);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);

    // Data states
    const [categories, setCategories] = useState<string[]>([]);
    const [kpis, setKpis] = useState<any>(null);
    const [pieData, setPieData] = useState<any[]>([]);
    const [barData, setBarData] = useState<any[]>([]);
    const [trendData, setTrendData] = useState<any[]>([]);
    const [overdueList, setOverdueList] = useState<Asset[]>([]);
    const [dueSoonList, setDueSoonList] = useState<Asset[]>([]);

    const [activeTab, setActiveTab] = useState<'overdue' | 'due_soon'>('overdue');

    const loadDashboardData = async (isRefresh = false) => {
        if (!selectedSiteId) return;

        if (isRefresh) setRefreshing(true);
        else setLoading(true);

        try {
            // Lấy configs cho site hiện tại
            const daysConfigs = await dashboardService.getSiteSettings(selectedSiteId);
            setDueSoonDays(daysConfigs);

            const [
                dashboardData,
                fetchedTrend
            ] = await Promise.all([
                dashboardService.getDashboardData(selectedSiteId, daysConfigs, filters),
                dashboardService.getTrend(selectedSiteId)
            ]);

            // Assuming we derive categories from the bar data or KPIs if not querying a separate table.
            // For robust dynamics, we can fetch all distinct categories for this site if assetsService had it.
            // Since dashboardService.getOverdueByCategory groups by type, let's use a simpler heuristic for now
            // or we can fetch distinct types from Supabase directly here.

            // To be precise and fast, let's just get distinct equipment_categories from due data + overdue data
            // Or better, query them separately if needed. For now, collect from current table data (not perfect).
            const dynamicCategories = Array.from(new Set([
                ...dashboardData.overdueList.map(a => a.equipment_category || a.equipment_type || 'Khác'),
                ...dashboardData.dueSoonList.map(a => a.equipment_category || a.equipment_type || 'Khác')
            ])).filter(Boolean);

            setCategories(dynamicCategories.length > 0 ? dynamicCategories : ['Thiết bị chịu áp', 'Thiết bị nâng hạ', 'Hệ thống điện', 'Khác']);

            setKpis(dashboardData.kpis);
            setPieData(dashboardData.pieData);
            setBarData(dashboardData.barData);
            setTrendData(fetchedTrend);
            setOverdueList(dashboardData.overdueList);
            setDueSoonList(dashboardData.dueSoonList);

            // Auto switch tab if overdue is 0 but due_soon is > 0
            if (dashboardData.overdueList.length === 0 && dashboardData.dueSoonList.length > 0) {
                setActiveTab('due_soon');
            } else {
                setActiveTab('overdue');
            }

        } catch (error) {
            console.error('Lỗi tải dữ liệu dashboard', error);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    // Reload when Site, Filters, or ?refresh= URL param changes
    useEffect(() => {
        loadDashboardData();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [selectedSiteId, JSON.stringify(filters), urlRefreshKey]);

    const isAppLoading = loading || siteLoading || !selectedSiteId;

    return (
        <div className="space-y-6 pb-20">
            {/* Header & Site Selector */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Dashboard Chiến Lược</h1>
                    <p className="text-sm text-gray-500 mt-1">Giám sát rủi ro và tuân thủ an toàn thời gian thực</p>
                </div>

                <div className="flex items-center gap-3">
                    <button
                        onClick={() => loadDashboardData(true)}
                        disabled={isAppLoading || refreshing}
                        className="p-2 border border-gray-200 text-gray-600 rounded-xl hover:bg-gray-50 focus:outline-none transition-colors disabled:opacity-50"
                        title="Tải lại dữ liệu"
                    >
                        <RefreshCw className={`w-5 h-5 ${refreshing ? 'animate-spin text-primary-500' : ''}`} />
                    </button>
                    <SiteDropdown
                        value={selectedSiteId}
                        onChange={setSelectedSiteId}
                        options={sites}
                        loading={siteLoading}
                    />
                </div>
            </div>

            {/* Cảnh báo cấp cao (Alert Banners) */}
            {!isAppLoading && kpis && (kpis.overdue > 0 || kpis.due_soon > 0) && (
                <div className="flex flex-col gap-3">
                    {kpis.overdue > 0 && (
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between bg-rose-50 border border-rose-200 rounded-2xl p-4 shadow-sm relative overflow-hidden gap-4">
                            <div className="absolute top-0 left-0 w-1.5 h-full bg-rose-500" />
                            <div className="flex items-start sm:items-center pl-2">
                                <div className="p-2 bg-rose-100/50 rounded-full text-rose-600 mr-3 mt-1 sm:mt-0 shadow-sm animate-pulse shrink-0">
                                    <AlertCircle className="w-6 h-6" />
                                </div>
                                <div>
                                    <h4 className="text-rose-800 font-black">CAN THIỆP NGAY: Phát hiện Thiết bị Quá hạn KĐ</h4>
                                    <p className="text-rose-700 text-sm font-medium mt-1">Có <span className="font-bold underline">{kpis.overdue}</span> thiết bị đã vi phạm thời hạn kiểm định bắt buộc tại nhà máy <span className="font-bold">{sites.find(s => s.id === selectedSiteId)?.name || selectedSiteId}</span>. Cảnh báo an toàn đang được kích hoạt.</p>
                                </div>
                            </div>
                            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 pl-12 sm:pl-0 shrink-0">
                                <Link to="/thiet-bi" className="justify-center text-rose-600 hover:text-rose-800 bg-white px-3 py-2 border border-rose-100 rounded-xl shadow-sm text-sm font-bold transition-colors flex items-center">
                                    <Settings className="w-4 h-4 mr-1.5" />
                                    Danh sách TB
                                </Link>
                                <Link to="/qua-han?tab=overdue" className="justify-center bg-rose-600 hover:bg-rose-700 text-white px-4 py-2 rounded-xl text-sm font-bold tracking-wide shadow transition-all active:scale-95 flex items-center">
                                    Xử lý ngay &rarr;
                                </Link>
                            </div>
                        </div>
                    )}

                    {kpis.due_soon > 0 && (
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between bg-amber-50 border border-amber-200 rounded-2xl p-4 shadow-sm relative overflow-hidden gap-4">
                            <div className="absolute top-0 left-0 w-1.5 h-full bg-amber-500" />
                            <div className="flex items-start sm:items-center pl-2">
                                <div className="p-2 bg-amber-100/50 rounded-full text-amber-600 mr-3 mt-1 sm:mt-0 shadow-sm shrink-0">
                                    <Clock className="w-6 h-6" />
                                </div>
                                <div>
                                    <h4 className="text-amber-800 font-bold">Lưu ý: Thiết bị sắp đến hạn KĐ</h4>
                                    <p className="text-amber-700 text-sm font-medium mt-1">Có <span className="font-bold">{kpis.due_soon}</span> thiết bị cần được lên kế hoạch kiểm định trong vòng {dueSoonDays} ngày tới.</p>
                                </div>
                            </div>
                            <Link to="/qua-han?tab=due_soon" className="ml-12 sm:ml-0 flex justify-center text-amber-800 hover:text-amber-900 bg-amber-200/50 hover:bg-amber-300/50 px-4 py-2 border border-amber-300/30 rounded-xl text-sm font-bold transition-colors">
                                Lên kế hoạch
                            </Link>
                        </div>
                    )}
                </div>
            )}

            {/* Bộ Lọc Nội Bộ Dashboard */}
            <DashboardFiltersUI filters={filters} setFilters={setFilters} categories={categories} />

            {/* KPI Cards */}
            <KpiCards kpis={kpis} loading={isAppLoading} />

            {/* Charts Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

                {/* Donut Chart: Cơ cấu hạn */}
                <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow-[0_2px_20px_-5px_rgba(0,0,0,0.05)]">
                    <div className="mb-4">
                        <h3 className="font-bold text-gray-800">Cơ cấu hạn kiểm định</h3>
                        <p className="text-xs text-slate-500">Tỷ lệ theo số lượng thiết bị</p>
                    </div>
                    <DueStatusPie data={pieData} loading={isAppLoading} />
                </div>

                {/* Bar Chart: Quá hạn theo danh mục */}
                <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow-[0_2px_20px_-5px_rgba(0,0,0,0.05)]">
                    <div className="mb-4">
                        <h3 className="font-bold text-gray-800">Quá hạn theo Danh mục</h3>
                        <p className="text-xs text-slate-500">Top 6 nhóm thiết bị cảnh báo</p>
                    </div>
                    <OverdueByCategoryBar data={barData} loading={isAppLoading} />
                </div>

                {/* Line Chart: Xu hướng 6 tháng */}
                <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow-[0_2px_20px_-5px_rgba(0,0,0,0.05)]">
                    <div className="mb-4">
                        <h3 className="font-bold text-gray-800">Xu hướng rủi ro (6 tháng)</h3>
                        <p className="text-xs text-slate-500">Snapshot định kỳ theo tháng</p>
                    </div>
                    <TrendLine data={trendData} loading={isAppLoading} />
                </div>

            </div>

            {/* Table Section */}
            <div className="bg-white rounded-3xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-slate-100/60 overflow-hidden pt-2 mt-8">

                {/* Tabs */}
                <div className="flex items-center px-6 border-b border-slate-100 space-x-6">
                    <button
                        onClick={() => setActiveTab('overdue')}
                        className={`py-4 px-1 border-b-2 font-bold text-sm transition-colors whitespace-nowrap flex items-center gap-2
                            ${activeTab === 'overdue' ? 'border-red-500 text-red-600' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}`}
                    >
                        <span>Danh sách Quá hạn</span>
                        {!isAppLoading && <span className={`px-2 py-0.5 rounded-full text-xs ${activeTab === 'overdue' ? 'bg-red-100' : 'bg-gray-100'}`}>{kpis?.overdue || 0}</span>}
                    </button>
                    <button
                        onClick={() => setActiveTab('due_soon')}
                        className={`py-4 px-1 border-b-2 font-bold text-sm transition-colors whitespace-nowrap flex items-center gap-2
                            ${activeTab === 'due_soon' ? 'border-amber-500 text-amber-600' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}`}
                    >
                        <span>Danh sách Sắp đến hạn</span>
                        {!isAppLoading && <span className={`px-2 py-0.5 rounded-full text-xs ${activeTab === 'due_soon' ? 'bg-amber-100' : 'bg-gray-100'}`}>{kpis?.due_soon || 0}</span>}
                    </button>

                    <div className="ml-auto hidden sm:flex items-center gap-2">
                        <span className="text-xs font-semibold text-gray-400">Giới hạn hiển thị: {activeTab === 'overdue' ? overdueList.length : dueSoonList.length}/50</span>
                        <Link to="/qua-han" className="text-primary-600 hover:text-primary-800 bg-primary-50 p-2 rounded-lg transition-colors" title="Xem Toàn Bộ">
                            <ArrowDownToLine className="w-4 h-4" />
                        </Link>
                    </div>
                </div>

                {/* Table Content */}
                <div className="p-0">
                    <AssetTable
                        type={activeTab}
                        assets={activeTab === 'overdue' ? overdueList : dueSoonList}
                        loading={isAppLoading}
                        siteId={selectedSiteId || undefined}
                    />
                </div>

                <div className="px-6 py-4 bg-gray-50/50 border-t border-gray-100 flex justify-between items-center sm:hidden">
                    <span className="text-xs font-semibold text-gray-400">Đang hiện {activeTab === 'overdue' ? overdueList.length : dueSoonList.length} thiết bị</span>
                    <Link to="/qua-han" className="text-xs font-bold text-primary-600">Xem Toàn Bộ &rarr;</Link>
                </div>
            </div>

            {/* Note/Legend Section */}
            {!isAppLoading && (
                <div className="flex flex-col sm:flex-row gap-4 justify-center items-center text-xs font-medium text-gray-400 mt-4">
                    <div className="flex items-center"><span className="w-2 h-2 rounded-full bg-emerald-500 mr-2"></span> An toàn dự kiến &gt; {dueSoonDays} ngày</div>
                    <div className="flex items-center"><span className="w-2 h-2 rounded-full bg-amber-500 mr-2"></span> Cảnh báo hạn &le; {dueSoonDays} ngày</div>
                    <div className="flex items-center"><span className="w-2 h-2 rounded-full bg-red-500 mr-2"></span> Vi phạm giới hạn</div>
                </div>
            )}
        </div>
    );
};
