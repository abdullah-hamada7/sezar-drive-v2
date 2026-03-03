import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from 'recharts';
import { statsService } from '../../services/stats.service';

export default function ShiftPerformanceChart() {
  const { t } = useTranslation();
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadStats() {
      try {
        const res = await statsService.getDriverShiftStats();
        // Handle both { success: true, data: [...] } and direct [...]
        const result = res.data || res;
        setData(Array.isArray(result) ? result : []);
      } catch (err) {
        console.error('Failed to load shift performance:', err);
      } finally {
        setLoading(false);
      }
    }
    loadStats();
  }, []);

  if (loading) return <div className="card mb-md h-40 flex items-center justify-center text-muted">...</div>;

  return (
    <div className="card mb-md">
      <h3 className="text-lg font-bold mb-sm" style={{ color: 'var(--color-primary)' }}>{t('driver_home.shift_performance')}</h3>
      <div style={{ height: 200, width: '100%' }}>
        <ResponsiveContainer>
          <PieChart>
            <Pie
              data={data}
              cx="50%"
              cy="50%"
              innerRadius={60}
              outerRadius={80}
              paddingAngle={5}
              dataKey="value"
            >
              {data.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.color} stroke="none" />
              ))}
            </Pie>
            <Tooltip contentStyle={{ backgroundColor: '#161B22', borderColor: '#333', color: '#fff' }} />
            <Legend verticalAlign="bottom" height={36} />
          </PieChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
