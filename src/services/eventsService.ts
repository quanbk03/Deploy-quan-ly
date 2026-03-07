/**
 * eventsService.ts — Service layer cho bảng asset_events (lịch sử kiểm định)
 *
 * Source of truth: asset_events → lịch sử từng lần KĐ
 * Không dùng event thay thế cho trạng thái hiện tại của assets
 */
import { supabase } from '../lib/supabase';
import type { AssetEvent } from '../types/database';

export const eventsService = {
    async listByAsset(asset_id: string): Promise<AssetEvent[]> {
        try {
            const { data, error } = await supabase
                .from('asset_events')
                .select('*')
                .eq('asset_id', asset_id)
                .order('created_at', { ascending: false });
            if (error) throw error;
            return data as AssetEvent[];
        } catch (error: unknown) {
            console.error('Lỗi lấy danh sách sự kiện:', error);
            throw new Error('Không thể tải lịch sử sự kiện của thiết bị.');
        }
    },

    /**
     * Lấy event mới nhất hợp lệ (performed_date, status done/verified).
     * Dùng để fallback lấy thông tin KĐ gần nhất khi assets.last_inspection_date bị null.
     */
    async getLatestCompleted(asset_id: string): Promise<AssetEvent | null> {
        try {
            const { data, error } = await supabase
                .from('asset_events')
                .select('*')
                .eq('asset_id', asset_id)
                .in('status', ['done', 'verified'])
                .not('performed_date', 'is', null)
                .order('performed_date', { ascending: false })
                .limit(1)
                .maybeSingle();
            if (error) throw error;
            return data as AssetEvent | null;
        } catch (error: unknown) {
            console.error('Lỗi lấy event gần nhất:', error);
            return null;
        }
    },

    async create(payload: Omit<AssetEvent, 'id' | 'created_at' | 'updated_at'>): Promise<AssetEvent> {
        try {
            const { data, error } = await supabase
                .from('asset_events')
                .insert([payload])
                .select()
                .single();
            if (error) throw error;
            return data as AssetEvent;
        } catch (error: unknown) {
            console.error('Lỗi tạo sự kiện:', error);
            throw new Error('Không thể tạo sự kiện: ' + ((error as Error).message || 'Lỗi không xác định.'));
        }
    },

    /**
     * Tạo event kế hoạch KĐ sau khi import / tạo thiết bị mới.
     * @param created_by - UUID của user tạo (từ profile.id). Không bắt buộc.
     */
    async createPlanned(
        asset_id: string,
        planned_date: string,
        interval_months: number,
        created_by?: string | null
    ): Promise<AssetEvent> {
        try {
            const payload: Omit<AssetEvent, 'id' | 'created_at' | 'updated_at'> = {
                asset_id,
                event_type: 'planned',
                status: 'planned',
                planned_date,
                interval_months,
                notes: interval_months
                    ? `Kế hoạch định kỳ (${interval_months} tháng)`
                    : 'Kế hoạch mới',
                performed_date: null,
                result: null,
                stamp_no: null,
                agency: null,
                next_due_date: null,
                created_by: created_by ?? null,
            };

            const { data, error } = await supabase
                .from('asset_events')
                .insert([payload])
                .select()
                .single();
            if (error) throw error;
            return data as AssetEvent;
        } catch (error: unknown) {
            console.error('Lỗi tạo sự kiện kế hoạch:', error);
            throw new Error('Không thể tạo kế hoạch kiểm định mới: ' + ((error as Error).message || 'Lỗi không xác định.'));
        }
    },

    async markDone(
        event_id: string,
        payload: {
            performed_date: string;
            result: string;
            next_due_date?: string;
            stamp_no?: string;
            agency?: string;
            notes?: string;
        }
    ): Promise<AssetEvent> {
        try {
            const { data, error } = await supabase
                .from('asset_events')
                .update({ ...payload, status: 'done', updated_at: new Date().toISOString() })
                .eq('id', event_id)
                .select()
                .single();
            if (error) throw error;
            return data as AssetEvent;
        } catch (error: unknown) {
            console.error('Lỗi đánh dấu hoàn thành sự kiện:', error);
            throw new Error('Không thể cập nhật kết quả kiểm định: ' + ((error as Error).message || 'Lỗi không xác định.'));
        }
    },

    async verify(event_id: string): Promise<AssetEvent> {
        try {
            const { data, error } = await supabase
                .from('asset_events')
                .update({ status: 'verified', updated_at: new Date().toISOString() })
                .eq('id', event_id)
                .select()
                .single();
            if (error) throw error;
            return data as AssetEvent;
        } catch (error: unknown) {
            console.error('Lỗi duyệt sự kiện:', error);
            throw new Error('Không thể duyệt kết quả kiểm định: ' + ((error as Error).message || 'Lỗi không xác định.'));
        }
    },
};
