import { useState, useEffect } from 'react';
import { sitesService } from '../services/sitesService';
import type { Site } from '../types/database';

export const useSiteScope = () => {
    const [selectedSiteId, setSelectedSiteIdState] = useState<string | null>(() => {
        return localStorage.getItem('selectedSiteId');
    });
    const [sites, setSites] = useState<Site[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        let isMounted = true;
        const initializeScope = async () => {
            try {
                setLoading(true);
                const [mySites, defaultSite] = await Promise.all([
                    sitesService.listMySites(),
                    sitesService.getDefaultSite()
                ]);

                if (isMounted) {
                    setSites(mySites);

                    // Nếu chưa có trong storage thì lấy default từ CSDL
                    if (!localStorage.getItem('selectedSiteId')) {
                        const initialSite = defaultSite || mySites[0]?.id || 'RG1';
                        setSelectedSiteIdState(initialSite);
                        localStorage.setItem('selectedSiteId', initialSite);
                    }
                }
            } catch (err: unknown) {
                if (isMounted) {
                    setError((err as Error).message || 'Lỗi tải danh sách nhà máy');
                }
            } finally {
                if (isMounted) setLoading(false);
            }
        };

        initializeScope();
        return () => { isMounted = false; };
    }, []);

    const setSelectedSiteId = (id: string) => {
        setSelectedSiteIdState(id);
        localStorage.setItem('selectedSiteId', id);
    };

    return { selectedSiteId, setSelectedSiteId, sites, loading, error };
};
