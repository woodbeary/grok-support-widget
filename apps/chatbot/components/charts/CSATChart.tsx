'use client';

import { Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis, CartesianGrid } from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface CSATChartProps {
    data: {
        sessionId: string;
        score: number;
        date: string;
    }[];
}

export function CSATChart({ data }: CSATChartProps) {
    return (
        <Card>
            <CardHeader>
                <CardTitle>CSAT Trend (Last 10 Sessions)</CardTitle>
            </CardHeader>
            <CardContent className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={data}>
                        <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                        <XAxis
                            dataKey="date"
                            fontSize={12}
                            tickLine={false}
                            axisLine={false}
                            tickFormatter={(value) => new Date(value).toLocaleDateString()}
                        />
                        <YAxis
                            domain={[0, 10]}
                            fontSize={12}
                            tickLine={false}
                            axisLine={false}
                        />
                        <Tooltip
                            contentStyle={{ background: '#111', border: '1px solid #333', borderRadius: '8px' }}
                            itemStyle={{ color: '#fff' }}
                            labelStyle={{ color: '#888' }}
                        />
                        <Line
                            type="monotone"
                            dataKey="score"
                            stroke="#2563eb"
                            strokeWidth={3}
                            dot={{ fill: '#2563eb', strokeWidth: 2 }}
                            activeDot={{ r: 6 }}
                        />
                    </LineChart>
                </ResponsiveContainer>
            </CardContent>
        </Card>
    );
}
