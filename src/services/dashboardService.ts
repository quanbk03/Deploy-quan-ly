import { supabase } from '../lib/supabase';
import { isPast, isBefore, addDays, format, subMonths, startOfMonth, endOfMonth } from 'date-fns';
import type { Asset } from '../types/database';

export interface DashboardFilters {
    status?: string | 'all';
    dueStatus?: 'all' | 'ok' | 'due_soon' | 'overdue';
    category?: string | 'all';
    search?: string;
    isStrict?: boolean;
}

export const computeDueStatus = (next_due_date: string | null, dueSoonDays: number): 'ok' | 'due_soon' | 'overdue' => {
    if (!next_due_date) return 'ok';
    const dueDate = new Date(next_due_date);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    if (isPast(dueDate) && dueDate.getTime() < today.getTime()) return 'overdue';
    if (isBefore(dueDate, addDays(today, dueSoonDays))) return 'due_soon';
    return 'ok';
};

const applyFilters = (query: any, filters?: DashboardFilters) => {
    if (filters?.category && filters.category !== 'all') {
        // Có thể filter theo equipment_category hoặc equipment_type
        query = query.or(`equipment_category.eq.${filters.category},equipment_type.eq.${filters.category}`);
    }
    if (filters?.search) {
        query = query.or(`asset_code.ilike.%${filters.search}%,equipment_name.ilike.%${filters.search}%,location.ilike.%${filters.search}%`);
    }
    if (filters?.isStrict) {
        query = query.eq('is_strict_required', true);
    }
    if (filters?.status && filters.status !== 'all') {
        query = query.eq('status', filters.status);
    }
    return query;
};

export const dashboardService = {
    async getSiteSettings(siteId: string) {
        const { data, error } = await supabase
            .from('site_settings')
            .select('due_soon_days')
            .eq('site_id', siteId)
            .single();
        if (error || !data) return 30; // fallback default
        return data.due_soon_days;
    },

    async getDashboardData(siteId: string, dueSoonDays: number, filters?: DashboardFilters) {
        let query = supabase.from('assets')
            .select(`
                id, asset_code, equipment_name, equipment_category, equipment_type, 
                location, last_inspection_date, next_due_date, inspection_agency, 
                declared_status, declaration_doc_no, status
            `)
            .eq('site_id', siteId);

        query = applyFilters(query, filters);
        const { data, error } = await query;
        if (error) throw error;

        const assets = data as Asset[];

        // 1. Calculate KPIs
        let total = assets.length;
        let ok = 0, due_soon = 0, overdue = 0, locked = 0, declared = 0, not_declared = 0;

        const overdueList: Asset[] = [];
        const dueSoonList: Asset[] = [];
        const categoryCounts: Record<string, number> = {};

        assets.forEach(asset => {
            if (asset.status === 'locked') locked++;
            if (asset.declared_status === 'declared') declared++;
            else not_declared++;

            const dStatus = computeDueStatus(asset.next_due_date, dueSoonDays);
            if (dStatus === 'ok') ok++;
            else if (dStatus === 'due_soon') {
                due_soon++;
                dueSoonList.push(asset);
            }
            else if (dStatus === 'overdue') {
                overdue++;
                overdueList.push(asset);
                const type = asset.equipment_type || 'Khác';
                categoryCounts[type] = (categoryCounts[type] || 0) + 1;
            }
        });

        const total_for_compliance = ok + due_soon + overdue;
        const compliance_rate = total_for_compliance > 0 ? ((ok / total_for_compliance) * 100).toFixed(1) : '100.0';

        const kpis = { total, ok, due_soon, overdue, locked, declared, not_declared, compliance_rate };

        // 2. Pie Chart Data
        const pieData = [
            { name: 'An toàn (OK)', value: kpis.ok, fill: '#10b981' },
            { name: 'Sắp đến hạn', value: kpis.due_soon, fill: '#f59e0b' },
            { name: 'Quá hạn', value: kpis.overdue, fill: '#ef4444' }
        ];

        // 3. Bar Chart Data (Overdue by Category)
        const barData = Object.entries(categoryCounts)
            .map(([name, count]) => ({ name, overdue: count }))
            .sort((a, b) => b.overdue - a.overdue)
            .slice(0, 6);

        // 4. Sort Lists (nearest due date first)
        const sortByDate = (a: Asset, b: Asset) => {
            if (!a.next_due_date) return 1;
            if (!b.next_due_date) return -1;
            return new Date(a.next_due_date).getTime() - new Date(b.next_due_date).getTime();
        };

        overdueList.sort(sortByDate);
        dueSoonList.sort(sortByDate);

        return {
            kpis,
            pieData,
            barData,
            overdueList: overdueList.slice(0, 50),
            dueSoonList: dueSoonList.slice(0, 50)
        };
    },


    async getTrend(siteId: string) {
        // Ưu tiên đọc từ KPI Snapshots
        const endDay = new Date();
        const startDay = subMonths(endDay, 6);

        const { data, error } = await supabase
            .from('kpi_snapshots')
            .select('*')
            .eq('site_id', siteId)
            .eq('period_type', 'month')
            .gte('generated_at', startOfMonth(startDay).toISOString())
            .lte('generated_at', endOfMonth(endDay).toISOString())
            .order('generated_at', { ascending: true });

        if (!error && data && data.length > 0) {
            return data.map(snap => ({
                month: snap.period_value,
                ok: snap.ok_count,
                dueSoon: snap.due_soon_count,
                overdue: snap.overdue_count
            }));
        }

        // Fallback: Nếu không có snapshots, giả lập dữ liệu tĩnh để render UI được
        // Bằng cách nhóm các Overdue theo tháng đến hạn trong tương lai
        const { data: assets } = await supabase
            .from('assets')
            .select('next_due_date')
            .eq('site_id', siteId)
            .neq('next_due_date', null);

        const mockTrend = Array.from({ length: 6 }).map((_, i) => {
            const d = subMonths(new Date(), 5 - i);
            const mStr = format(d, 'MM/yyyy');
            return {
                month: mStr,
                ok: 0,
                dueSoon: 0,
                overdue: 0
            };
        });

        if (assets) {
            assets.forEach(a => {
                const d = new Date(a.next_due_date!);
                const mStr = format(d, 'MM/yyyy');
                const match = mockTrend.find(m => m.month === mStr);
                if (match) {
                    match.overdue += 1; // Giả lập đếm next_due_date
                }
            });
        }

        return mockTrend;
    }
};
