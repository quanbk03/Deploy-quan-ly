import React from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Loader2 } from 'lucide-react';

/**
 * `ProtectedRoute` — chặn truy cập nếu chưa đăng nhập.
 * Xem thêm: `PermissionGuard` để giới hạn theo quyền/role.
 */
export const ProtectedRoute: React.FC = () => {
    const { user, loading } = useAuth();

    if (loading) {
        return (
            <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 gap-3">
                <Loader2 className="w-8 h-8 md:w-12 md:h-12 text-primary-600 animate-spin" />
                <p className="text-sm text-gray-400 font-medium">Đang xác thực...</p>
            </div>
        );
    }

    if (!user) {
        return <Navigate to="/dang-nhap" replace />;
    }

    return <Outlet />;
};
