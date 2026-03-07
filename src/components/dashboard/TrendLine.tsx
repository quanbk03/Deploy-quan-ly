import React from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';

interface TrendData {
    month: string;
    ok: number;
    dueSoon: number;
    overdue: number;
}

interface TrendLineProps {
    data: TrendData[];
    loading: boolean;
}

export const TrendLine: React.FC<TrendLineProps> = ({ data, loading }) => {
    if (loading) {
        return <div className="h-80 flex items-center justify-center bg-gray-50 animate-pulse rounded-2xl">Đang tải biểu đồ xu hướng...</div>;
    }

    return (
        <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
                <LineChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
                    <XAxis
                        dataKey="month"
                        tick={{ fontSize: 12, fill: '#9ca3af' }}
                        axisLine={false}
                        tickLine={false}
                        padding={{ left: 10, right: 10 }}
                    />
                    <YAxis
                        tick={{ fontSize: 12, fill: '#9ca3af' }}
                        axisLine={false}
                        tickLine={false}
                    />
                    <Tooltip
                        contentStyle={{ borderRadius: '12px', border: '1px solid #f3f4f6', boxShadow: '0 4px 20px rgba(0,0,0,0.08)' }}
                    />
                    <Legend verticalAlign="top" height={36} iconType="circle" />
                    <Line type="monotone" dataKey="ok" name="An toàn (OK)" stroke="#10b981" strokeWidth={3} strokeLinecap="round" dot={{ r: 4, strokeWidth: 0, fill: '#10b981' }} activeDot={{ r: 6 }} />
                    <Line type="monotone" dataKey="dueSoon" name="Sắp đến hạn" stroke="#f59e0b" strokeWidth={3} strokeLinecap="round" dot={{ r: 4, strokeWidth: 0, fill: '#f59e0b' }} activeDot={{ r: 6 }} />
                    <Line type="monotone" dataKey="overdue" name="Quá hạn" stroke="#ef4444" strokeWidth={3} strokeLinecap="round" dot={{ r: 4, strokeWidth: 0, fill: '#ef4444' }} activeDot={{ r: 6 }} />
                </LineChart>
            </ResponsiveContainer>
        </div>
    );
};
