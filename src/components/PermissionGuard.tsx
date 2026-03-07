import React from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { ShieldAlert, Home } from 'lucide-react';

/**
 * `PermissionGuard` — bảo vệ route theo role/quyền.
 *
 * Sử dụng:
 * ```tsx
 * <Route element={<PermissionGuard allowedRoles={['admin', 'hse']} />}>
 *   <Route path="/quan-tri" element={<AdminPage />} />
 * </Route>
 * ```
 */

interface PermissionGuardProps {
    /** Danh sách role được phép truy cập route này */
    allowedRoles: string[];
    /** Chuyển hướng về trang này nếu không có quyền (mặc định: '/tong-quan') */
    redirectTo?: string;
}

export const PermissionGuard: React.FC<PermissionGuardProps> = ({
    allowedRoles,
    redirectTo = '/tong-quan',
}) => {
    const { profile, loading } = useAuth();

    if (loading) {
        return null; // ProtectedRoute đã xử lý loading state
    }

    if (!profile?.role || !allowedRoles.includes(profile.role)) {
        // Nếu muốn hiển thị trang "Không có quyền" thay vì redirect:
        // return <AccessDenied />;
        return <Navigate to={redirectTo} replace />;
    }

    return <Outlet />;
};

/**
 * Trang hiển thị khi người dùng không có quyền truy cập.
 * Có thể dùng như component standalone hoặc element của Route.
 */
export const AccessDenied: React.FC = () => {
    return (
        <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
            <div className="bg-white rounded-3xl shadow-lg border border-orange-100 p-10 max-w-md w-full text-center">
                <div className="w-16 h-16 bg-orange-50 rounded-2xl flex items-center justify-center mx-auto mb-5">
                    <ShieldAlert className="w-8 h-8 text-orange-500" />
                </div>
                <h1 className="text-xl font-bold text-gray-900 mb-2">Không có quyền truy cập</h1>
                <p className="text-gray-500 text-sm mb-6">
                    Tài khoản của bạn không có quyền xem trang này. Vui lòng liên hệ quản trị viên nếu cần hỗ trợ.
                </p>
                <a
                    href="/tong-quan"
                    className="inline-flex items-center justify-center gap-2 px-6 py-2.5 bg-primary-600 text-white rounded-xl font-semibold text-sm hover:bg-primary-700 transition-colors"
                >
                    <Home className="w-4 h-4" />
                    Về Tổng quan
                </a>
            </div>
        </div>
    );
};
