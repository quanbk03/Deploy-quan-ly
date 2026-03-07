import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

const isValidUrl = (url: string) => {
    try {
        new URL(url);
        return true;
    } catch {
        return false;
    }
};

const finalUrl = isValidUrl(supabaseUrl) ? supabaseUrl : 'https://placeholder.supabase.co';
const finalKey = supabaseAnonKey || 'placeholder';

if (!isValidUrl(supabaseUrl)) {
    console.error('Lỗi: VITE_SUPABASE_URL không hợp lệ trong .env. Ứng dụng sẽ dùng URL tạm thời để không bị trắng trang.');
}

export const supabase = createClient(finalUrl, finalKey);
