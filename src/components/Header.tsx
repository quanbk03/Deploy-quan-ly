import React from 'react';
import { Menu, LogOut } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

interface HeaderProps {
    onMenuClick: () => void;
}

export const Header: React.FC<HeaderProps> = ({ onMenuClick }) => {
    const { profile, signOut } = useAuth();

    const getRoleBadgeColor = (role?: string) => {
        switch (role) {
            case 'hse': return 'bg-danger-100 text-danger-700 border-danger-200';
            case 'engineering': return 'bg-warning-100 text-warning-700 border-warning-200';
            default: return 'bg-gray-100 text-gray-700 border-gray-200';
        }
    };
    const getRoleName = (role?: string) => {
        switch (role) {
            case 'admin': return 'Quản trị viên (Admin)';
            case 'hse': return 'Quản lý (HSE)';
            case 'engineering': return 'Kỹ thuật viên';
            default: return 'Người xem (Viewer)';
        }
    };
    return (
        <header className="h-16 bg-white/70 backdrop-blur-xl border-b border-slate-200/60 flex items-center justify-between px-4 sm:px-6 lg:px-8 z-10 shadow-sm sticky top-0 transition-all">
            <div className="flex items-center gap-4">
                <button
                    onClick={onMenuClick}
                    className="lg:hidden p-2 -ml-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
                >
                    <Menu className="w-6 h-6" />
                </button>
                <h1 className="text-lg font-bold text-gray-800 lg:hidden">QC Thiết Bị</h1>
            </div>

            <div className="flex items-center gap-4">
                <div className="hidden sm:flex items-center gap-3 text-sm mr-4">
                    <div className="text-right">
                        <p className="font-medium text-gray-900">{profile?.full_name || 'Người dùng'}</p>
                        <p className="text-gray-500 text-xs">{profile?.email}</p>
                    </div>
                    <span
                        className={`px-3 py-1 text-xs font-bold rounded-full border ${getRoleBadgeColor(profile?.role)}`}
                    >
                        {getRoleName(profile?.role)}
                    </span>
                </div>

                <button
                    onClick={signOut}
                    className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-gray-600 hover:text-danger-600 hover:bg-danger-50 rounded-lg transition-all"
                >
                    <LogOut className="w-5 h-5" />
                    <span className="hidden sm:inline">Đăng xuất</span>
                </button>
            </div>
        </header>
    );
};
