import React from 'react';
import { Search, Filter, ShieldAlert, XCircle } from 'lucide-react';
import type { DashboardFilters } from '../../services/dashboardService';

interface DashboardFiltersUIProps {
    filters: DashboardFilters;
    setFilters: React.Dispatch<React.SetStateAction<DashboardFilters>>;
    categories: string[];
}

export const DashboardFiltersUI: React.FC<DashboardFiltersUIProps> = ({ filters, setFilters, categories }) => {
    const hasActiveFilters = Object.keys(filters).length > 0 &&
        (filters.search || filters.status || filters.category || filters.isStrict);

    const clearFilters = () => setFilters({});

    return (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 mb-6">
            <div className="flex flex-col md:flex-row gap-4 items-center">

                {/* Search */}
                <div className="relative flex-1 w-full">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <Search className="h-4 w-4 text-gray-400" />
                    </div>
                    <input
                        type="text"
                        placeholder="Tìm mã thiết bị, tên, vị trí, đơn vị KĐ..."
                        className="block w-full pl-10 pr-3 py-2.5 border border-gray-200 rounded-xl leading-5 bg-gray-50 placeholder-gray-400 focus:outline-none focus:bg-white focus:ring-2 focus:ring-primary-500 focus:border-primary-500 sm:text-sm transition-all"
                        value={filters.search || ''}
                        onChange={(e) => setFilters(f => ({ ...f, search: e.target.value }))}
                    />
                </div>

                {/* Status Dropdown */}
                <div className="w-full md:w-auto min-w-[160px]">
                    <select
                        className="block w-full px-3 py-2.5 border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 rounded-xl bg-gray-50 text-gray-700 font-medium appearance-none"
                        value={filters.status || ''}
                        onChange={(e) => setFilters(f => ({ ...f, status: e.target.value || undefined }))}
                    >
                        <option value="">Tất cả trạng thái</option>
                        <option value="in_service">Đang sử dụng</option>
                        <option value="locked">Bị khóa (Locked)</option>
                        <option value="out_of_service">Ngừng sử dụng</option>
                    </select>
                </div>

                {/* Category Dropdown */}
                <div className="w-full md:w-auto min-w-[200px]">
                    <div className="relative flex items-center">
                        <Filter className="w-4 h-4 absolute left-3 text-gray-400 pointer-events-none" />
                        <select
                            className="block w-full pl-9 pr-3 py-2.5 border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 rounded-xl bg-gray-50 text-gray-700 font-medium appearance-none"
                            value={filters.category || ''}
                            onChange={(e) => setFilters(f => ({ ...f, category: e.target.value || undefined }))}
                        >
                            <option value="">Tất cả Nhóm TB</option>
                            {categories.map((cat, idx) => (
                                <option key={idx} value={cat}>{cat}</option>
                            ))}
                        </select>
                    </div>
                </div>

                {/* Is Strict Toggle */}
                <div className="flex items-center w-full md:w-auto pl-2 gap-4">
                    <label className="flex items-center cursor-pointer group">
                        <div className="relative">
                            <input
                                type="checkbox"
                                className="sr-only"
                                checked={filters.isStrict || false}
                                onChange={(e) => setFilters(f => ({ ...f, isStrict: e.target.checked ? true : undefined }))}
                            />
                            <div className={`block w-10 h-6 rounded-full transition-colors ${filters.isStrict ? 'bg-indigo-500' : 'bg-gray-200'}`}></div>
                            <div className={`dot absolute left-1 top-1 bg-white w-4 h-4 rounded-full transition-transform ${filters.isStrict ? 'transform translate-x-4' : ''}`}></div>
                        </div>
                        <div className="ml-3 text-sm font-semibold text-gray-700 flex items-center">
                            <ShieldAlert className="w-4 h-4 mr-1 text-indigo-500 opacity-70 group-hover:opacity-100 transition-opacity" />
                            Nghiêm ngặt
                        </div>
                    </label>

                    {hasActiveFilters && (
                        <button
                            onClick={clearFilters}
                            className="text-xs font-bold text-gray-500 hover:text-danger-600 flex items-center bg-gray-50 hover:bg-danger-50 px-2 py-1.5 rounded-lg border border-gray-200 hover:border-danger-200 transition-all"
                            title="Xóa bộ lọc"
                        >
                            <XCircle className="w-3.5 h-3.5 mr-1" />
                            Xóa Lọc
                        </button>
                    )}
                </div>

            </div>
        </div>
    );
};
