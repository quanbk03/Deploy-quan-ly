/**
 * adminService.ts — Service quản trị: user, site access, alert settings, alert logs
 *
 * Tất cả hàm đều yêu cầu role 'admin'.
 * Error messages bằng tiếng Việt.
 */
import { supabase } from '../lib/supabase';

// -------------------------------------------------------
// Types
// -------------------------------------------------------

export interface ProfileWithSites {
    id: string;
    full_name: string | null;
    email: string | null;
    role: string;
    site_id: string | null;
    /** Danh sách site_id được cấp quyền */
    site_ids: string[];
}

export interface AlertSettings {
    id?: string;
    site_id: string;
    enabled: boolean;
    days_before: number;
    recipients: string[];  // mảng email
    include_due_soon: boolean;
    include_overdue: boolean;
    updated_at?: string;
    updated_by?: string;
}

export interface AlertLog {
    id: string;
    site_id: string;
    run_at: string;
    total_due_soon: number;
    total_overdue: number;
    recipients: string[];
    status: 'success' | 'error' | 'partial';
    error: string | null;
    created_at: string;
}

// -------------------------------------------------------
// User Management
// -------------------------------------------------------

export const adminService = {

    /** Lấy danh sách user với profile + sites được cấp */
    async listUsers(): Promise<ProfileWithSites[]> {
        try {
            // Lấy profiles
            const { data: profiles, error: profileError } = await supabase
                .from('profiles')
                .select('id, full_name, email, role, site_id')
                .order('full_name');
            if (profileError) throw profileError;

            // Lấy profile_sites (nếu bảng tồn tại)
            const { data: profileSites } = await supabase
                .from('profile_sites')
                .select('profile_id, site_id');

            const siteMap: Record<string, string[]> = {};
            (profileSites ?? []).forEach((ps: { profile_id: string; site_id: string }) => {
                if (!siteMap[ps.profile_id]) siteMap[ps.profile_id] = [];
                siteMap[ps.profile_id].push(ps.site_id);
            });

            return (profiles ?? []).map(p => ({
                ...p,
                site_ids: siteMap[p.id] ?? (p.site_id ? [p.site_id] : []),
            }));
        } catch (err: unknown) {
            console.error('Lỗi lấy danh sách user:', err);
            throw new Error('Không thể tải danh sách người dùng.');
        }
    },

    /** Cập nhật role của user */
    async updateUserRole(userId: string, role: string): Promise<void> {
        const { error } = await supabase
            .from('profiles')
            .update({ role })
            .eq('id', userId);
        if (error) throw new Error(`Không thể đổi role: ${error.message}`);
    },

    /** Cập nhật site mặc định của user */
    async updateUserDefaultSite(userId: string, siteId: string | null): Promise<void> {
        const { error } = await supabase
            .from('profiles')
            .update({ site_id: siteId })
            .eq('id', userId);
        if (error) throw new Error(`Không thể đổi site mặc định: ${error.message}`);
    },

    /**
     * Cấp / thu hồi site access cho user.
     * Replace toàn bộ danh sách site_ids hiện tại.
     */
    async updateUserSites(userId: string, siteIds: string[]): Promise<void> {
        try {
            // Xóa cũ
            await supabase.from('profile_sites').delete().eq('profile_id', userId);
            // Thêm mới
            if (siteIds.length > 0) {
                const rows = siteIds.map(s => ({ profile_id: userId, site_id: s }));
                const { error } = await supabase.from('profile_sites').insert(rows);
                if (error) throw error;
            }
        } catch (err: unknown) {
            throw new Error(`Không thể cập nhật quyền site: ${(err as Error).message}`);
        }
    },

    // -------------------------------------------------------
    // Alert Settings
    // -------------------------------------------------------

    /** Lấy tất cả cấu hình cảnh báo (1 record per site) */
    async listAlertSettings(): Promise<AlertSettings[]> {
        const { data, error } = await supabase
            .from('alert_settings')
            .select('*')
            .order('site_id');
        if (error) throw new Error(`Không thể tải cấu hình cảnh báo: ${error.message}`);
        return (data ?? []).map(r => ({
            ...r,
            recipients: Array.isArray(r.recipients) ? r.recipients : [],
        }));
    },

    /** Lưu cấu hình cảnh báo cho một site (upsert theo site_id) */
    async upsertAlertSettings(settings: AlertSettings): Promise<void> {
        const { data: { user } } = await supabase.auth.getUser();
        const { error } = await supabase
            .from('alert_settings')
            .upsert({
                site_id: settings.site_id,
                enabled: settings.enabled,
                days_before: settings.days_before,
                recipients: settings.recipients,
                include_due_soon: settings.include_due_soon,
                include_overdue: settings.include_overdue,
                updated_at: new Date().toISOString(),
                updated_by: user?.id ?? null,
            }, { onConflict: 'site_id' });
        if (error) throw new Error(`Không thể lưu cấu hình: ${error.message}`);
    },

    // -------------------------------------------------------
    // Alert Logs
    // -------------------------------------------------------

    /** Lấy 15 log gần nhất (tất cả site hoặc theo site_id) */
    async listAlertLogs(siteId?: string): Promise<AlertLog[]> {
        let query = supabase
            .from('alert_logs')
            .select('*')
            .order('run_at', { ascending: false })
            .limit(15);
        if (siteId) query = query.eq('site_id', siteId);
        const { data, error } = await query;
        if (error) throw new Error(`Không thể tải lịch sử cảnh báo: ${error.message}`);
        return (data ?? []).map(r => ({
            ...r,
            recipients: Array.isArray(r.recipients) ? r.recipients : [],
        }));
    },

    // -------------------------------------------------------
    // Sites (read-only list)
    // -------------------------------------------------------

    /** Lấy danh sách sites */
    async listSites(): Promise<{ id: string; name: string }[]> {
        const { data, error } = await supabase
            .from('sites')
            .select('id, name')
            .order('id');
        if (error) return [];
        return data ?? [];
    },
};
