import React from 'react';
import { LayoutDashboard, AlertCircle, Clock, ShieldAlert, CheckCircle2, FileText } from 'lucide-react';
import { Link } from 'react-router-dom';

interface Kpis {
    total: number;
    ok: number;
    due_soon: number;
    overdue: number;
    locked: number;
    declared: number;
    not_declared: number;
    compliance_rate: string;
}

interface KpiCardsProps {
    kpis: Kpis | null;
    loading: boolean;
}

export const KpiCards: React.FC<KpiCardsProps> = ({ kpis, loading }) => {
    if (loading || !kpis) {
        return (
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4">
                {Array(7).fill(0).map((_, i) => (
                    <div key={i} className="bg-white rounded-2xl p-4 h-28 animate-pulse border border-slate-100 flex flex-col justify-between">
                        <div className="h-4 bg-slate-200 rounded w-2/3"></div>
                        <div className="h-8 bg-slate-200 rounded w-1/2"></div>
                    </div>
                ))}
            </div>
        );
    }

    const cards = [
        { label: 'Tổng thiết bị', value: kpis.total, icon: LayoutDashboard, color: 'text-blue-600', bg: 'bg-blue-50', border: 'border-blue-100', to: '/thiet-bi' },
        { label: 'An toàn (OK)', value: kpis.ok, icon: CheckCircle2, color: 'text-emerald-600', bg: 'bg-emerald-50', border: 'border-emerald-100', to: '/thiet-bi?due_status=ok' },
        { label: 'Sắp đến hạn', value: kpis.due_soon, icon: Clock, color: 'text-amber-600', bg: 'bg-amber-50', border: 'border-amber-100', to: '/qua-han?tab=due_soon' },
        { label: 'Quá hạn', value: kpis.overdue, icon: AlertCircle, color: 'text-red-600', bg: 'bg-red-50', border: 'border-red-100', to: '/qua-han?tab=overdue' },
        { label: 'Tỷ lệ tuân thủ', value: `${kpis.compliance_rate}%`, icon: ShieldAlert, color: 'text-indigo-600', bg: 'bg-indigo-50', border: 'border-indigo-100', to: '/thiet-bi' },
        { label: 'Bị khóa (Locked)', value: kpis.locked, icon: ShieldAlert, color: 'text-slate-600', bg: 'bg-slate-50', border: 'border-slate-200', to: '/thiet-bi?status=locked' },
        { label: 'Đã khai báo', value: `${kpis.declared}/${kpis.total}`, icon: FileText, color: 'text-cyan-600', bg: 'bg-cyan-50', border: 'border-cyan-100', to: '/thiet-bi?declared_status=declared' },
    ];

    return (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-7 gap-4">
            {cards.map((card, idx) => {
                const Icon = card.icon;
                return (
                    <Link to={card.to} key={idx} className={`relative overflow-hidden bg-white rounded-2xl p-4 border ${card.border} hover:shadow-md transition-all group block`}>
                        <div className="flex justify-between items-start mb-2">
                            <div className={`p-2 rounded-xl ${card.bg} ${card.color} group-hover:scale-110 transition-transform`}>
                                <Icon className="w-5 h-5" />
                            </div>
                        </div>
                        <div>
                            <h3 className={`text-2xl font-black ${card.color} tracking-tight`}>{card.value}</h3>
                            <p className="text-xs font-semibold text-slate-500 mt-1 line-clamp-2 leading-snug">{card.label}</p>
                        </div>
                    </Link>
                );
            })}
        </div>
    );
};
