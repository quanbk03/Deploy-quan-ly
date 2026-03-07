import React from 'react';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from 'recharts';

interface DueStatusData {
    name: string;
    value: number;
    fill: string;
}

interface DueStatusPieProps {
    data: DueStatusData[];
    loading: boolean;
}

export const DueStatusPie: React.FC<DueStatusPieProps> = ({ data, loading }) => {
    if (loading) {
        return <div className="h-64 flex items-center justify-center bg-gray-50 animate-pulse rounded-2xl"><div className="w-32 h-32 rounded-full border-4 border-gray-200"></div></div>;
    }

    if (data.every(d => d.value === 0)) {
        return <div className="h-64 flex items-center justify-center text-gray-400">Không có dữ liệu thiết bị</div>;
    }

    return (
        <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                    <Pie
                        data={data}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={90}
                        paddingAngle={4}
                        dataKey="value"
                        nameKey="name"
                        stroke="none"
                        animationDuration={800}
                    >
                        {data.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.fill} />
                        ))}
                    </Pie>
                    <Tooltip
                        contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 15px rgba(0,0,0,0.1)' }}
                        itemStyle={{ fontWeight: 'bold' }}
                    />
                    <Legend verticalAlign="bottom" height={36} iconType="circle" />
                </PieChart>
            </ResponsiveContainer>
        </div>
    );
};
