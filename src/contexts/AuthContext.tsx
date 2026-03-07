import React, { createContext, useContext, useEffect, useState } from 'react';
import type { User } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import type { Profile } from '../types/database';

interface AuthContextType {
    user: User | null;
    profile: Profile | null;
    loading: boolean;
    signOut: () => Promise<void>;
    updateRole: (role: 'viewer' | 'engineering' | 'hse') => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
    user: null,
    profile: null,
    loading: true,
    signOut: async () => { },
    updateRole: async () => { },
});

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [user, setUser] = useState<User | null>(null);
    const [profile, setProfile] = useState<Profile | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        // Lấy session hiện tại
        const initAuth = async () => {
            try {
                const { data: { session }, error } = await supabase.auth.getSession();
                if (error) {
                    console.error('Lỗi khi lấy session:', error);
                    setLoading(false);
                    return;
                }

                setUser(session?.user ?? null);
                if (session?.user) {
                    await fetchProfile(session.user.id);
                } else {
                    setLoading(false);
                }
            } catch (err) {
                console.error('Lỗi hệ thống khi khởi tạo Auth:', err);
                setLoading(false);
            }
        };

        initAuth();

        // Fallback an toàn: Nếu sau 5 giây vẫn loading thì ép thoát trạng thái
        const timeoutId = setTimeout(() => {
            if (loading) {
                console.warn('Auth timeout: Khởi tạo lâu hơn dự kiến, đóng loading.');
                setLoading(false);
            }
        }, 5000);

        // Lắng nghe thay đổi auth
        const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
            setUser(session?.user ?? null);
            if (session?.user) {
                await fetchProfile(session.user.id);
            } else {
                setProfile(null);
                setLoading(false);
            }
        });

        return () => {
            clearTimeout(timeoutId);
            subscription.unsubscribe();
        };
    }, []);

    const fetchProfile = async (userId: string) => {
        try {
            const { data, error } = await supabase
                .from('profiles')
                .select('*')
                .eq('id', userId)
                .single();

            if (error) {
                console.error('Lỗi khi lấy profile:', error);
            } else {
                setProfile(data as Profile);
            }
        } catch (error) {
            console.error('Lỗi fetch profile:', error);
        } finally {
            setLoading(false);
        }
    };

    const signOut = async () => {
        await supabase.auth.signOut();
    };

    const updateRole = async (newRole: 'viewer' | 'engineering' | 'hse') => {
        if (!user || !profile) return;

        try {
            const { error } = await supabase
                .from('profiles')
                .update({ role: newRole })
                .eq('id', user.id);

            if (error) throw error;

            // Cập nhật state cục bộ
            setProfile({ ...profile, role: newRole });
        } catch (error) {
            console.error('Lỗi khi cập nhật quyền:', error);
            // Re-throw để caller có thể hiển thị thông báo lỗi phù hợp
            throw error;
        }
    };

    return (
        <AuthContext.Provider value={{ user, profile, loading, signOut, updateRole }}>
            {children}
        </AuthContext.Provider>
    );
};

// eslint-disable-next-line react-refresh/only-export-components
export const useAuth = () => useContext(AuthContext);
