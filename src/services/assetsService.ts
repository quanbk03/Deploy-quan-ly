/**
 * assetsService.ts — Service layer chuẩn hóa cho bảng assets
 *
 * Tất cả query đọc/ghi đều nhất quán với canonical fields từ database.ts
 * Dùng computeDueStatus từ assetHelpers.ts thay vì tự tính inline
 */
import { supabase } from '../lib/supabase';
import type { Asset } from '../types/database';
import { computeDueStatus } from '../utils/assetHelpers';

export interface AssetFilters {
    search?: string;
    location?: string;
    /** Lọc theo equipment_type HOẶC equipment_category (dùng cùng field này) */
    equipment_type?: string;
    status?: string;
    /** Computed client-side sau khi fetch */
    due_status?: 'ok' | 'due_soon' | 'overdue';
    site_id?: string;
    declared_status?: string;
    is_strict_required?: boolean;
    /** Số ngày sắp đến hạn (từ site_settings). Mặc định 30. */
    due_soon_days?: number;
}

export { computeDueStatus };

export const assetsService = {
    computeDueStatus,

    async list(filters?: AssetFilters): Promise<Asset[]> {
        try {
            let query = supabase.from('assets').select('*');

            // Lọc theo site — bắt buộc nếu có
            if (filters?.site_id) {
                query = query.eq('site_id', filters.site_id);
            }

            // Search đa cột: asset_code, equipment_name, description_raw, location, serial_or_model
            if (filters?.search) {
                query = query.or(
                    `asset_code.ilike.%${filters.search}%,` +
                    `equipment_name.ilike.%${filters.search}%,` +
                    `description_raw.ilike.%${filters.search}%,` +
                    `location.ilike.%${filters.search}%,` +
                    `serial_or_model.ilike.%${filters.search}%`
                );
            }

            // Lọc theo location chính xác
            if (filters?.location) {
                query = query.eq('location', filters.location);
            }

            // Lọc theo equipment_type hoặc equipment_category (cùng giá trị)
            if (filters?.equipment_type) {
                query = query.or(
                    `equipment_type.eq.${filters.equipment_type},` +
                    `equipment_category.eq.${filters.equipment_type}`
                );
            }

            // Lọc theo status vận hành
            if (filters?.status) {
                query = query.eq('status', filters.status);
            }

            // Lọc theo declared_status khai báo
            if (filters?.declared_status) {
                query = query.eq('declared_status', filters.declared_status);
            }

            // Lọc theo is_strict_required (YCNN)
            if (filters?.is_strict_required !== undefined) {
                query = query.eq('is_strict_required', filters.is_strict_required);
            }

            const { data, error } = await query.order('created_at', { ascending: false });
            if (error) throw error;

            let result = data as Asset[];

            // Due status — tính client-side sau fetch (cần dueSoonDays từ site_settings)
            if (filters?.due_status) {
                const dueSoonDays = filters.due_soon_days ?? 30;
                result = result.filter(
                    a => computeDueStatus(a.next_due_date, dueSoonDays) === filters.due_status
                );
            }

            return result;
        } catch (error: unknown) {
            console.error('Lỗi lấy danh sách thiết bị:', error);
            throw new Error((error as Error).message || 'Không thể tải danh sách thiết bị. Vui lòng thử lại sau.');
        }
    },

    async getById(id: string): Promise<Asset> {
        try {
            const { data, error } = await supabase
                .from('assets')
                .select('*')
                .eq('id', id)
                .single();
            if (error) throw error;
            return data as Asset;
        } catch (error: unknown) {
            console.error('Lỗi lấy thông tin thiết bị:', error);
            throw new Error('Không thể tải thông tin chi tiết thiết bị.');
        }
    },

    async getByCode(assetCode: string): Promise<Asset> {
        try {
            const { data, error } = await supabase
                .from('assets')
                .select('*')
                .eq('asset_code', assetCode)
                .maybeSingle();
            if (error) throw error;
            if (!data) throw new Error(`Thiết bị với mã "${assetCode}" không tồn tại.`);
            return data as Asset;
        } catch (error: unknown) {
            console.error('Lỗi lấy thiết bị theo mã:', error);
            throw new Error((error as Error).message || 'Không thể tải thông tin thiết bị.');
        }
    },

    async create(payload: Omit<Asset, 'id' | 'created_at' | 'updated_at'>): Promise<Asset> {
        try {
            const { data, error } = await supabase
                .from('assets')
                .insert([payload])
                .select()
                .single();
            if (error) throw error;
            return data as Asset;
        } catch (error: unknown) {
            console.error('Lỗi tạo thiết bị:', error);
            throw new Error('Không thể tạo thiết bị mới: ' + ((error as Error).message || 'Lỗi không xác định.'));
        }
    },

    async update(id: string, payload: Partial<Asset>): Promise<Asset> {
        try {
            const { data, error } = await supabase
                .from('assets')
                .update({ ...payload, updated_at: new Date().toISOString() })
                .eq('id', id)
                .select()
                .single();
            if (error) throw error;
            return data as Asset;
        } catch (error: unknown) {
            console.error('Lỗi cập nhật thiết bị:', error);
            throw new Error('Không thể cập nhật thông tin thiết bị: ' + ((error as Error).message || 'Lỗi không xác định.'));
        }
    },

    /**
     * Upsert theo asset_code (dùng cho import hàng loạt).
     * onConflict: 'asset_code' — yêu cầu unique index trên asset_code.
     * equipment_category: free-text, không còn enforce FK (đã DROP constraint).
     */
    async upsertByAssetCode(
        payload: Omit<Asset, 'id' | 'created_at' | 'updated_at'> & { id?: string }
    ): Promise<Asset> {
        try {
            const { data, error } = await supabase
                .from('assets')
                .upsert(
                    { ...payload, updated_at: new Date().toISOString() },
                    { onConflict: 'asset_code' }
                )
                .select()
                .single();
            if (error) throw error;
            return data as Asset;
        } catch (error: unknown) {
            console.error('Lỗi import/upsert thiết bị:', error);
            throw new Error('Không thể import dữ liệu thiết bị: ' + ((error as Error).message || 'Lỗi không xác định.'));
        }
    },
};
