import React from 'react';
import { NavLink } from 'react-router-dom';
import { LayoutDashboard, Wrench, AlertTriangle, X, Settings, Upload, Users, Bell } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

interface SidebarProps {
    isOpen: boolean;
    setIsOpen: (isOpen: boolean) => void;
}

const mainNavItems = [
    { name: 'Tổng quan', path: '/tong-quan', icon: LayoutDashboard },
    { name: 'Thiết bị', path: '/thiet-bi', icon: Wrench },
    { name: 'Quá hạn', path: '/qua-han', icon: AlertTriangle },
    { name: 'Nhập dữ liệu', path: '/nhap-du-lieu', icon: Upload },
];

const adminNavItems = [
    { name: 'Quản lý User', path: '/quan-tri/nguoi-dung', icon: Users },
    { name: 'Cấu hình Alert', path: '/quan-tri/canh-bao', icon: Bell },
];

export const Sidebar: React.FC<SidebarProps> = ({ isOpen, setIsOpen }) => {
    const { profile } = useAuth();
    const isAdmin = profile?.role === 'admin';

    const closeSidebar = () => {
        if (window.innerWidth < 1024) setIsOpen(false);
    };

    const navLinkClass = ({ isActive }: { isActive: boolean }) =>
        `flex items-center gap-3 px-4 py-3.5 rounded-2xl transition-all duration-300 group relative overflow-hidden ${isActive
            ? 'bg-gradient-to-r from-primary-500 to-primary-600 text-white shadow-lg shadow-primary-500/25 font-semibold translate-x-1'
            : 'text-slate-600 hover:bg-slate-100/80 hover:text-slate-900 hover:translate-x-1 font-medium'
        }`;

    const iconClass = (isActive: boolean) =>
        `w-5 h-5 flex-shrink-0 transition-all duration-300 ${isActive ? 'text-white' : 'text-slate-400 group-hover:text-primary-500 group-hover:scale-110'}`;

    return (
        <>
            {/* Mobile overlay */}
            {isOpen && (
                <div
                    className="lg:hidden fixed inset-0 z-40 bg-gray-900/50 backdrop-blur-sm transition-opacity"
                    onClick={() => setIsOpen(false)}
                />
            )}

            <aside
                className={`fixed inset-y-0 left-0 z-50 w-64 bg-white/95 backdrop-blur-xl border-r border-slate-200/60 transform transition-transform duration-300 ease-out flex flex-col
          ${isOpen ? 'translate-x-0' : '-translate-x-full'} lg:translate-x-0 lg:static lg:h-screen shadow-xl lg:shadow-none`}
            >
                {/* Logo */}
                <div className="h-16 flex items-center justify-between px-6 border-b border-slate-100">
                    <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary-500 to-primary-700 flex items-center justify-center shadow-md">
                            <Settings className="w-5 h-5 text-white" />
                        </div>
                        <div>
                            <span className="text-sm font-black bg-clip-text text-transparent bg-gradient-to-r from-gray-900 to-gray-600 leading-none">HSE Equipment</span>
                            <p className="text-[10px] text-gray-400 leading-none mt-0.5">Manager</p>
                        </div>
                    </div>
                    <button
                        onClick={() => setIsOpen(false)}
                        className="lg:hidden text-gray-500 hover:text-gray-700 focus:outline-none p-1 rounded-md hover:bg-gray-100 transition-colors"
                    >
                        <X className="w-6 h-6" />
                    </button>
                </div>

                {/* Nav */}
                <nav className="flex-1 px-4 py-6 space-y-1 overflow-y-auto">
                    {/* Main nav */}
                    {mainNavItems.map(item => {
                        const Icon = item.icon;
                        return (
                            <NavLink key={item.path} to={item.path} onClick={closeSidebar} className={navLinkClass}>
                                {({ isActive }) => (
                                    <>
                                        <Icon className={iconClass(isActive)} />
                                        <span>{item.name}</span>
                                    </>
                                )}
                            </NavLink>
                        );
                    })}

                    {/* Admin section — chỉ hiển thị nếu là admin */}
                    {isAdmin && (
                        <div className="pt-5">
                            <p className="px-4 mb-2 text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                                Quản trị
                            </p>
                            {adminNavItems.map(item => {
                                const Icon = item.icon;
                                return (
                                    <NavLink key={item.path} to={item.path} onClick={closeSidebar} className={navLinkClass}>
                                        {({ isActive }) => (
                                            <>
                                                <Icon className={iconClass(isActive)} />
                                                <span>{item.name}</span>
                                            </>
                                        )}
                                    </NavLink>
                                );
                            })}
                        </div>
                    )}
                </nav>

                <div className="p-4 border-t border-slate-100 bg-slate-50/50">
                    <p className="text-xs font-semibold text-slate-500">Quản lý Thiết bị Kiểm định</p>
                    <p className="text-xs text-slate-400 mt-0.5">Nghiêm ngặt &amp; YCNN đa nhà máy</p>
                </div>
            </aside>
        </>
    );
};
