import React from 'react';
import type { Site } from '../types/database';
import { Building2, Loader2, ChevronDown } from 'lucide-react';

interface SiteDropdownProps {
    value: string | null;
    onChange: (siteId: string) => void;
    options: Site[];
    loading?: boolean;
    disabled?: boolean;
}

export const SiteDropdown: React.FC<SiteDropdownProps> = ({
    value,
    onChange,
    options,
    loading = false,
    disabled = false
}) => {
    return (
        <div className="flex items-center space-x-3 bg-white border border-gray-200 shadow-sm rounded-xl px-4 py-2 hover:border-primary-300 transition-colors">
            <div className="flex items-center text-primary-600 bg-primary-50 p-1.5 rounded-lg">
                <Building2 className="w-4 h-4" />
            </div>

            <div className="flex flex-col relative w-48 sm:w-56">
                <label className="text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-0.5" htmlFor="site-select">
                    Nhà máy
                </label>

                <div className="relative">
                    {loading ? (
                        <div className="flex items-center text-sm font-semibold text-gray-500 py-1 cursor-wait">
                            <Loader2 className="w-3.5 h-3.5 mr-2 animate-spin" />
                            Đang tải...
                        </div>
                    ) : (
                        <select
                            id="site-select"
                            value={value || ''}
                            onChange={(e) => onChange(e.target.value)}
                            disabled={disabled || loading || options.length === 0}
                            className="appearance-none bg-transparent w-full text-sm font-bold text-gray-800 focus:outline-none cursor-pointer pr-6 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            <option value="" disabled>Chọn nhà máy</option>
                            {options.map((site) => (
                                <option key={site.id} value={site.id}>
                                    {site.id} - {site.name}
                                </option>
                            ))}
                        </select>
                    )}

                    {!loading && (
                        <ChevronDown className="w-4 h-4 text-gray-400 absolute right-0 top-1/2 -translate-y-1/2 pointer-events-none" />
                    )}
                </div>
            </div>
        </div>
    );
};
