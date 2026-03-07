import { supabase } from '../lib/supabase';
import type { Site } from '../types/database';

export const sitesService = {
    async listMySites(): Promise<Site[]> {
        const { data: { session } } = await supabase.auth.getSession();
        const user = session?.user;
        if (!user) throw new Error('Chưa đăng nhập');

        const { data: profileSites, error: psError } = await supabase
            .from('profile_sites')
            .select('site_id, sites!inner(id, name, created_at)')
            .eq('profile_id', user.id);

        let finalSites: Site[] = [];

        if (!psError && profileSites && profileSites.length > 0) {
            finalSites = profileSites.map(ps => {
                // Supabase join returns object for 1:1 or N:1 
                return (Array.isArray(ps.sites) ? ps.sites[0] : ps.sites) as unknown as Site;
            });
        }

        if (finalSites.length === 0) {
            // Fallback: get from profiles.site_id
            const { data: profile } = await supabase
                .from('profiles')
                .select('site_id')
                .eq('id', user.id)
                .single();

            if (profile?.site_id) {
                const { data: fallbackSite } = await supabase
                    .from('sites')
                    .select('*')
                    .eq('id', profile.site_id)
                    .single();

                if (fallbackSite) {
                    finalSites = [fallbackSite as Site];
                }
            }
        }

        // Final fallback to hardcoded list if DB is completely empty and no profile site found
        if (finalSites.length === 0) {
            finalSites = [
                { id: 'RG1', name: 'Nhà máy RG1', created_at: new Date().toISOString() },
                { id: 'RG2', name: 'Nhà máy RG2', created_at: new Date().toISOString() },
                { id: 'RG3', name: 'Nhà máy RG3', created_at: new Date().toISOString() },
                { id: 'CSVL', name: 'Cơ sở Vĩnh Long', created_at: new Date().toISOString() },
                { id: 'RG5', name: 'Nhà máy RG5', created_at: new Date().toISOString() }
            ];
        }

        return finalSites;
    },

    async getDefaultSite(): Promise<string | null> {
        try {
            const { data: { session } } = await supabase.auth.getSession();
            const user = session?.user;
            if (!user) return null;

            const { data: profileSites, error: psError } = await supabase
                .from('profile_sites')
                .select('site_id, is_default')
                .eq('profile_id', user.id);

            if (!psError && profileSites && profileSites.length > 0) {
                const defaultPs = profileSites.find(ps => ps.is_default);
                if (defaultPs?.site_id) return defaultPs.site_id;
                if (profileSites[0].site_id) return profileSites[0].site_id;
            }

            const { data: profile } = await supabase
                .from('profiles')
                .select('site_id')
                .eq('id', user.id)
                .single();

            return profile?.site_id || 'RG1';
        } catch (error) {
            console.error('Lỗi khi lấy default site:', error);
            return 'RG1';
        }
    }
};
