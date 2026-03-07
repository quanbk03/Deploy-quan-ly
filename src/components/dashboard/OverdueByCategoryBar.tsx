import React from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

interface CategoryData {
    name: string;
    overdue: number;
}

interface OverdueByCategoryBarProps {
    data: CategoryData[];
    loading: boolean;
}

export const OverdueByCategoryBar: React.FC<OverdueByCategoryBarProps> = ({ data, loading }) => {
    if (loading) {
        return (
            <div className="h-64 flex items-end justify-around p-4 border-b border-gray-100 animate-pulse bg-gray-50 rounded-2xl">
                {Array(6).fill(0).map((_, i) => (
                    <div key={i} className="w-8 bg-gray-200 rounded-t" style={{ height: `${Math.random() * 80 + 20}%` }}></div>
                ))}
            </div>
        );
    }

    if (data.length === 0) {
        return <div className="h-64 flex items-center justify-center text-gray-400">Không có thiết bị quá hạn</div>;
    }

    return (
        <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data} margin={{ top: 20, right: 10, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
                    <XAxis
                        dataKey="name"
                        scale="point"
                        padding={{ left: 20, right: 20 }}
                        tick={{ fontSize: 12, fill: '#6B7280' }}
                        axisLine={false}
                        tickLine={false}
                        tickFormatter={(value) => value.length > 10 ? value.substring(0, 10) + '...' : value}
                    />
                    <YAxis
                        tick={{ fontSize: 12, fill: '#6B7280' }}
                        axisLine={false}
                        tickLine={false}
                        allowDecimals={false}
                    />
                    <Tooltip
                        cursor={{ fill: 'rgba(239, 68, 68, 0.05)' }}
                        contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 15px rgba(0,0,0,0.1)' }}
                        itemStyle={{ color: '#ef4444', fontWeight: 'bold' }}
                    />
                    <Bar
                        dataKey="overdue"
                        name="Số lượng quá hạn"
                        fill="#ef4444"
                        radius={[4, 4, 0, 0]}
                        barSize={32}
                        animationDuration={1000}
                    />
                </BarChart>
            </ResponsiveContainer>
        </div>
    );
};
