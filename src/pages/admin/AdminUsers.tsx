/**
 * AdminUsers.tsx — Trang quản lý người dùng (chỉ dành cho admin)
 *
 * Features:
 * - Danh sách user: tên, email, role badge, site mặc định, sites được cấp
 * - Search theo tên/email
 * - Click row → inline edit panel: đổi role, đổi site mặc định, cấp/bỏ sites
 * - Toast khi lưu thành công
 */
import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { Search, Users, Shield, ChevronRight, Save, Loader2, RefreshCw } from 'lucide-react';
import { adminService, type ProfileWithSites } from '../../services/adminService';
import { useToast, ToastContainer } from '../../components/Toast';

const ROLES = [
    { value: 'admin', label: 'Admin', color: 'bg-red-50 text-red-700 border-red-200' },
    { value: 'hse', label: 'HSE', color: 'bg-violet-50 text-violet-700 border-violet-200' },
    { value: 'engineering', label: 'Engineering', color: 'bg-blue-50 text-blue-700 border-blue-200' },
    { value: 'viewer', label: 'Viewer', color: 'bg-gray-50 text-gray-600 border-gray-200' },
];

const ALL_SITES = ['RG1', 'RG2', 'RG3', 'RG5', 'CSVL'];

function RoleBadge({ role }: { role: string }) {
    const r = ROLES.find(x => x.value === role) ?? ROLES[3];
    return (
        <span className={`inline-flex items-center px-2.5 py-0.5 text-xs font-bold rounded-full border ${r.color}`}>
            {r.label}
        </span>
    );
}

// -------------------------------------------------------
// Inline Edit Panel
// -------------------------------------------------------
interface EditPanelProps {
    user: ProfileWithSites;
    onSave: () => void;
    onClose: () => void;
    addToast: ReturnType<typeof useToast>['addToast'];
}

const EditPanel: React.FC<EditPanelProps> = ({ user, onSave, onClose, addToast }) => {
    const [role, setRole] = useState(user.role);
    const [defaultSite, setDefaultSite] = useState(user.site_id ?? '');
    const [selectedSites, setSelectedSites] = useState<string[]>(user.site_ids);
    const [saving, setSaving] = useState(false);

    const toggleSite = (s: string) =>
        setSelectedSites(prev => prev.includes(s) ? prev.filter(x => x !== s) : [...prev, s]);

    const handleSave = async () => {
        setSaving(true);
        try {
            await Promise.all([
                adminService.updateUserRole(user.id, role),
                adminService.updateUserDefaultSite(user.id, defaultSite || null),
                adminService.updateUserSites(user.id, selectedSites),
            ]);
            addToast(`Đã cập nhật quyền cho ${user.full_name || user.email}.`, 'success');
            onSave();
        } catch (err: unknown) {
            addToast((err as Error).message, 'error');
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 bg-black/30 flex items-center justify-center p-4" onClick={onClose}>
            <div
                className="bg-white rounded-2xl shadow-xl w-full max-w-md"
                onClick={e => e.stopPropagation()}
            >
                <div className="p-5 border-b border-gray-100">
                    <h3 className="text-base font-bold text-gray-900 flex items-center gap-2">
                        <Shield className="w-4 h-4 text-primary-500" />
                        Chỉnh quyền: {user.full_name || user.email}
                    </h3>
                    <p className="text-xs text-gray-500 mt-0.5">{user.email}</p>
                </div>

                <div className="p-5 space-y-4">
                    {/* Role */}
                    <div>
                        <label className="block text-xs font-semibold text-gray-700 mb-2">Vai trò *</label>
                        <div className="grid grid-cols-2 gap-2">
                            {ROLES.map(r => (
                                <button
                                    key={r.value}
                                    onClick={() => setRole(r.value)}
                                    className={`px-3 py-2 rounded-xl border text-sm font-semibold transition-all ${role === r.value
                                            ? `${r.color} shadow-sm`
                                            : 'border-gray-200 text-gray-500 hover:border-gray-300'
                                        }`}
                                >
                                    {r.label}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Site mặc định */}
                    <div>
                        <label className="block text-xs font-semibold text-gray-700 mb-2">Site mặc định</label>
                        <select
                            value={defaultSite}
                            onChange={e => setDefaultSite(e.target.value)}
                            className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2 focus:ring-2 focus:ring-primary-500 outline-none"
                        >
                            <option value="">— Chưa gán —</option>
                            {ALL_SITES.map(s => <option key={s} value={s}>{s}</option>)}
                        </select>
                    </div>

                    {/* Sites được cấp */}
                    <div>
                        <label className="block text-xs font-semibold text-gray-700 mb-2">Sites được cấp quyền truy cập</label>
                        <div className="flex flex-wrap gap-2">
                            {ALL_SITES.map(s => (
                                <button
                                    key={s}
                                    onClick={() => toggleSite(s)}
                                    className={`px-3 py-1.5 rounded-lg border text-xs font-bold transition-all ${selectedSites.includes(s)
                                            ? 'bg-primary-50 text-primary-700 border-primary-200'
                                            : 'bg-gray-50 text-gray-500 border-gray-200 hover:border-gray-300'
                                        }`}
                                >
                                    {s}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>

                <div className="flex gap-3 p-5 border-t border-gray-100">
                    <button
                        onClick={onClose}
                        disabled={saving}
                        className="flex-1 px-4 py-2.5 border border-gray-200 text-gray-700 rounded-xl hover:bg-gray-50 text-sm font-medium disabled:opacity-50"
                    >
                        Hủy
                    </button>
                    <button
                        onClick={handleSave}
                        disabled={saving}
                        className="flex-1 px-4 py-2.5 bg-primary-600 text-white rounded-xl hover:bg-primary-700 text-sm font-semibold disabled:opacity-50 flex items-center justify-center gap-2"
                    >
                        {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                        {saving ? 'Đang lưu...' : 'Lưu thay đổi'}
                    </button>
                </div>
            </div>
        </div>
    );
};

// -------------------------------------------------------
// Main Page
// -------------------------------------------------------
export const AdminUsers: React.FC = () => {
    const { toasts, addToast, dismiss } = useToast();
    const [users, setUsers] = useState<ProfileWithSites[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [editingUser, setEditingUser] = useState<ProfileWithSites | null>(null);

    const loadUsers = useCallback(async () => {
        setLoading(true);
        try {
            const data = await adminService.listUsers();
            setUsers(data);
        } catch (err: unknown) {
            addToast((err as Error).message, 'error');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { loadUsers(); }, [loadUsers]);

    const filtered = useMemo(() => {
        if (!search.trim()) return users;
        const q = search.toLowerCase();
        return users.filter(u =>
            u.full_name?.toLowerCase().includes(q) ||
            u.email?.toLowerCase().includes(q)
        );
    }, [users, search]);

    return (
        <div className="space-y-6 max-w-5xl mx-auto px-4 sm:px-6 pb-20">
            <ToastContainer toasts={toasts} onDismiss={dismiss} />

            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                        <Users className="w-6 h-6 text-primary-500" /> Quản lý Người dùng
                    </h1>
                    <p className="text-sm text-gray-500 mt-1">Phân quyền và cấp site access cho từng tài khoản.</p>
                </div>
                <button
                    onClick={loadUsers}
                    disabled={loading}
                    className="p-2 border border-gray-200 rounded-xl text-gray-500 hover:bg-gray-50 transition-colors disabled:opacity-50"
                >
                    <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                </button>
            </div>

            {/* Search */}
            <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                    type="text"
                    placeholder="Tìm theo tên hoặc email..."
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    className="w-full pl-9 pr-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-primary-500 outline-none"
                />
            </div>

            {/* Table */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                {loading ? (
                    <div className="flex justify-center items-center py-20">
                        <Loader2 className="w-7 h-7 animate-spin text-primary-500" />
                    </div>
                ) : filtered.length === 0 ? (
                    <div className="text-center py-16 text-gray-500 text-sm">Không tìm thấy người dùng nào.</div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="border-b border-gray-100 bg-gray-50/50">
                                    <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Tên</th>
                                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider hidden sm:table-cell">Email</th>
                                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Role</th>
                                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider hidden md:table-cell">Site mặc định</th>
                                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider hidden lg:table-cell">Sites được cấp</th>
                                    <th className="px-4 py-3 w-10"></th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-50">
                                {filtered.map(user => (
                                    <tr
                                        key={user.id}
                                        onClick={() => setEditingUser(user)}
                                        className="hover:bg-gray-50 cursor-pointer transition-colors"
                                    >
                                        <td className="px-5 py-3.5">
                                            <span className="font-semibold text-gray-900">
                                                {user.full_name || '—'}
                                            </span>
                                        </td>
                                        <td className="px-4 py-3.5 text-gray-500 hidden sm:table-cell">
                                            {user.email || '—'}
                                        </td>
                                        <td className="px-4 py-3.5">
                                            <RoleBadge role={user.role} />
                                        </td>
                                        <td className="px-4 py-3.5 text-gray-700 hidden md:table-cell">
                                            {user.site_id || <span className="text-gray-400 italic">—</span>}
                                        </td>
                                        <td className="px-4 py-3.5 hidden lg:table-cell">
                                            <div className="flex flex-wrap gap-1">
                                                {user.site_ids.length > 0
                                                    ? user.site_ids.map(s => (
                                                        <span key={s} className="px-2 py-0.5 bg-primary-50 text-primary-700 border border-primary-100 text-xs rounded-md font-medium">
                                                            {s}
                                                        </span>
                                                    ))
                                                    : <span className="text-gray-400 italic text-xs">Chưa cấp</span>}
                                            </div>
                                        </td>
                                        <td className="px-4 py-3.5 text-gray-400">
                                            <ChevronRight className="w-4 h-4" />
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>

                        <div className="px-5 py-3 border-t border-gray-50 bg-gray-50/30">
                            <p className="text-xs text-gray-400">{filtered.length} / {users.length} người dùng</p>
                        </div>
                    </div>
                )}
            </div>

            {/* Edit Panel */}
            {editingUser && (
                <EditPanel
                    user={editingUser}
                    onClose={() => setEditingUser(null)}
                    onSave={() => { setEditingUser(null); loadUsers(); }}
                    addToast={addToast}
                />
            )}
        </div>
    );
};
