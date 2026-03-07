import { supabase } from '../lib/supabase';
import type { AssetDocument } from '../types/database';

export const docsService = {
    async listByAsset(asset_id: string) {
        try {
            const { data, error } = await supabase
                .from('asset_documents')
                .select('*')
                .eq('asset_id', asset_id)
                .order('created_at', { ascending: false });

            if (error) throw error;
            return data as AssetDocument[];
        } catch (error: unknown) {
            console.error('Lỗi lấy danh sách tài liệu:', error);
            throw new Error('Không thể tải danh sách tài liệu của thiết bị.');
        }
    },

    async create(payload: Omit<AssetDocument, 'id' | 'created_at' | 'uploaded_by'>) {
        try {
            const { data: { user } } = await supabase.auth.getUser();

            const { data, error } = await supabase
                .from('asset_documents')
                .insert([{
                    ...payload,
                    uploaded_by: user?.id
                }])
                .select()
                .single();

            if (error) throw error;
            return data as AssetDocument;
        } catch (error: unknown) {
            console.error('Lỗi thêm tài liệu:', error);
            throw new Error('Không thể đính kèm tài liệu: ' + ((error as Error).message || 'Lỗi không xác định.'));
        }
    },

    async delete(id: string) {
        try {
            const { error } = await supabase
                .from('asset_documents')
                .delete()
                .eq('id', id);

            if (error) throw error;
            return true;
        } catch (error: unknown) {
            console.error('Lỗi xóa tài liệu:', error);
            throw new Error('Không thể xóa tài liệu: ' + ((error as Error).message || 'Lỗi không xác định.'));
        }
    }
};
