import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { statsService } from '../../services/stats.service';

export default function DailyEarningsChart() {
    const { t } = useTranslation();
    const [data, setData] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        async function loadStats() {
            try {
                const res = await statsService.getDriverDailyStats();
                // Handle both { success: true, data: [...] } and direct [...]
                const result = res.data || res;
                setData(Array.isArray(result) ? result : []);
            } catch (err) {
                console.error('Failed to load daily earnings:', err);
            } finally {
                setLoading(false);
            }
        }
        loadStats();

        // Listen for trip updates to refresh chart
        window.addEventListener('ws:trip_completed', loadStats);
        window.addEventListener('ws:trip_cancelled', loadStats);

        return () => {
            window.removeEventListener('ws:trip_completed', loadStats);
            window.removeEventListener('ws:trip_cancelled', loadStats);
        };
    }, []);

    if (loading) return <div className="card mb-md h-40 flex items-center justify-center text-muted">...</div>;

    return (
        <div className="card mb-md">
            <h3 className="text-lg font-bold mb-sm" style={{ color: 'var(--color-primary)' }}>{t('driver_home.daily_earnings')}</h3>
            <div style={{ height: 200, width: '100%' }}>
                <ResponsiveContainer>
                    <AreaChart data={data}>
                        <defs>
                            <linearGradient id="colorEarnings" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="#00F5FF" stopOpacity={0.8} />
                                <stop offset="95%" stopColor="#00F5FF" stopOpacity={0} />
                            </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                        <XAxis dataKey="hour" stroke="#888" interval={3} />
                        <YAxis stroke="#888" />
                        <Tooltip
                            contentStyle={{ backgroundColor: '#161B22', borderColor: '#333', color: '#fff' }}
                            itemStyle={{ color: '#00F5FF' }}
                            formatter={(value) => [`${value} ${t('common.currency')}`, t('common.revenue')]}
                        />
                        <Area type="monotone" dataKey="amount" stroke="#00F5FF" fillOpacity={1} fill="url(#colorEarnings)" />
                    </AreaChart>
                </ResponsiveContainer>
            </div>
        </div>
    );
}
