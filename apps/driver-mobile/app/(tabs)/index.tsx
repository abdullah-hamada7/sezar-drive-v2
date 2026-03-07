import { useEffect, useMemo, useState, useCallback } from 'react';
import { View, Text, ScrollView, RefreshControl, TouchableOpacity } from 'react-native';
import { User, ClipboardCheck, Eye } from 'lucide-react-native';

import { useAuth } from '../../contexts/AuthContext';
import { useShift } from '../../contexts/ShiftContext';
import TechnicalBackground from '../../components/TechnicalBackground';
import { GlassCard } from '../../components/GlassCard';
import { authService } from '../../services/auth.service';
import { statsService } from '../../services/stats.service';
import { realtime } from '../../services/realtime.service';
import { useToast } from '../../contexts/ToastContext';

export default function HomeWrapper() {
  const { user, updateUser } = useAuth();
  const { activeShift, loading, refreshShift } = useShift();
  const { addToast } = useToast();
  const displayName = user?.name || [user?.firstName, user?.lastName].filter(Boolean).join(' ') || 'Driver';
  const [dailyStats, setDailyStats] = useState<any[]>([]);
  const [activity, setActivity] = useState<any[]>([]);
  const [showDetails, setShowDetails] = useState(false);

  const isShiftActive = activeShift?.status === 'Active';
  const isShiftPending = activeShift?.status === 'PendingVerification';

  const todayEarnings = useMemo(() => {
    return (dailyStats || []).reduce((sum, item) => sum + Number(item?.amount || 0), 0);
  }, [dailyStats]);

  const refreshStatus = useCallback(async () => {
    try {
      const res = await authService.me();
      if (res.data?.user) {
        await updateUser(res.data.user);
      }
    } catch (err: any) {
      addToast(err?.message || 'Failed to refresh profile status', 'error');
    }
  }, [addToast, updateUser]);

  const loadDashboard = useCallback(async () => {
    try {
      const [dailyRes, activityRes] = await Promise.all([
        statsService.getDriverDailyStats(),
        statsService.getDriverActivity(),
      ]);
      setDailyStats(Array.isArray(dailyRes.data) ? dailyRes.data : []);
      setActivity(Array.isArray(activityRes.data) ? activityRes.data : []);
    } catch {
      setDailyStats([]);
      setActivity([]);
    }
  }, []);

  const onRefresh = useCallback(async () => {
    await Promise.all([refreshShift(), loadDashboard(), refreshStatus()]);
  }, [refreshShift, loadDashboard, refreshStatus]);

  useEffect(() => {
    loadDashboard();
  }, [loadDashboard]);

  useEffect(() => {
    const unsubscribe = realtime.subscribe((message) => {
      if (!message?.type) return;
      if (['trip_assigned', 'trip_cancelled', 'trip_completed', 'identity_reviewed'].includes(message.type)) {
        refreshStatus();
        loadDashboard();
      }
    });
    return unsubscribe;
  }, [loadDashboard, refreshStatus]);

  return (
    <View className="flex-1 bg-[#030712]">
      <TechnicalBackground />
        <ScrollView
          contentContainerStyle={{ padding: 24, paddingTop: 64, paddingBottom: 100 }}
          refreshControl={<RefreshControl refreshing={loading} onRefresh={onRefresh} tintColor="#3B82F6" />}
        >
        {/* Profile & Avatar */}
        <GlassCard className="mb-6 flex-row items-center justify-between py-5">
          <View className="flex-row items-center">
            <View className="w-16 h-16 rounded-full bg-[#1F2937] border-2 border-[#3B82F6] items-center justify-center overflow-hidden shadow-lg shadow-[#3B82F6]/30 mr-4">
              <User size={32} color="#3B82F6" />
            </View>
            <View>
              <Text className="text-xl font-bold text-[#F9FAFB] tracking-tight">{displayName}</Text>
              <Text className="text-xs text-[#9CA3AF] mb-1">{user?.email}</Text>
              <View className={`self-start px-2 py-0.5 rounded-full border ${user?.identityVerified ? 'bg-[#10B981]/10 border-[#10B981]/20' : 'bg-[#F59E0B]/10 border-[#F59E0B]/20'}`}>
                <Text className={`text-[10px] uppercase font-bold ${user?.identityVerified ? 'text-[#10B981]' : 'text-[#F59E0B]'}`}>
                  {user?.identityVerified ? 'VERIFIED' : 'PENDING'}
                </Text>
              </View>
            </View>
          </View>
          <TouchableOpacity onPress={() => setShowDetails((prev) => !prev)} className="w-10 h-10 rounded-full border border-white/10 items-center justify-center bg-black/20">
            <Eye size={18} color="#9CA3AF" />
          </TouchableOpacity>
        </GlassCard>

        {showDetails && (
          <GlassCard className="mb-6">
            <Text className="text-[#9CA3AF] text-[10px] font-bold uppercase tracking-widest mb-2">Driver Details</Text>
            <Text className="text-[#F9FAFB] text-sm mb-1">Name: {displayName}</Text>
            <Text className="text-[#F9FAFB] text-sm mb-1">Email: {user?.email || '—'}</Text>
            <Text className="text-[#F9FAFB] text-sm mb-1">Phone: {user?.phone || '—'}</Text>
            <Text className="text-[#F9FAFB] text-sm">License: {user?.licenseNumber || '—'}</Text>
          </GlassCard>
        )}

        {/* Shift Status */}
        {isShiftActive && (
          <GlassCard className="mb-6 opacity-100" style={{ borderColor: 'rgba(16, 185, 129, 0.3)' }}>
            <View className="absolute top-0 left-0 right-0 h-[2px] bg-[#10B981] opacity-80" />
            <View className="flex-row items-center">
              <ClipboardCheck size={28} color="#10B981" />
              <View className="ml-4">
                <Text className="font-bold text-[#10B981] text-lg">Active Shift</Text>
                <Text className="text-xs text-[#9CA3AF] mt-1">Vehicle: {activeShift?.vehicle?.plateNumber || '—'}</Text>
              </View>
            </View>
          </GlassCard>
        )}

        {isShiftPending && (
          <GlassCard className="mb-6" style={{ borderColor: 'rgba(245, 158, 11, 0.3)' }}>
            <View className="absolute top-0 left-0 right-0 h-[2px] bg-[#F59E0B] opacity-80" />
            <View className="flex-row items-center">
              <ClipboardCheck size={28} color="#F59E0B" />
              <View className="ml-4">
                <Text className="font-bold text-[#F59E0B] text-lg">Pending Verification</Text>
                <Text className="text-xs text-[#9CA3AF] mt-1">Awaiting Face Scan</Text>
              </View>
            </View>
          </GlassCard>
        )}

        {!activeShift && (
          <GlassCard className="mb-6" style={{ borderColor: 'rgba(59, 130, 246, 0.3)' }}>
            <View className="flex-row items-center">
              <ClipboardCheck size={28} color="#3B82F6" />
              <View className="ml-4">
                <Text className="font-bold text-[#3B82F6] text-lg">No Active Shift</Text>
                <Text className="text-xs text-[#9CA3AF] mt-1">Start a shift to begin receiving trips.</Text>
              </View>
            </View>
          </GlassCard>
        )}

        <GlassCard className="mb-6" style={{ borderColor: 'rgba(59, 130, 246, 0.3)' }}>
          <Text className="text-[#9CA3AF] text-[10px] font-bold uppercase tracking-widest mb-2">Daily Earnings</Text>
          <Text className="text-[#3B82F6] text-2xl font-black mb-3">{todayEarnings.toFixed(2)} SAR</Text>
          <Text className="text-[#6B7280] text-xs">Hourly points: {dailyStats.length}</Text>
        </GlassCard>

        <GlassCard>
          <Text className="text-[#9CA3AF] text-[10px] font-bold uppercase tracking-widest mb-3">Recent Activity</Text>
          {activity.length === 0 ? (
            <Text className="text-[#6B7280] text-xs">No recent activity</Text>
          ) : (
            activity.slice(0, 6).map((item, index) => (
              <View key={item.id || index} className="flex-row items-center justify-between py-2 border-b border-white/5">
                <View className="flex-1 pr-3">
                  <Text className="text-[#F9FAFB] text-xs font-bold uppercase">{item.type || 'activity'} • {item.status || '—'}</Text>
                  <Text className="text-[#9CA3AF] text-xs" numberOfLines={1}>{item.title || '—'}</Text>
                </View>
                <Text className={`text-xs font-bold ${Number(item.amount) < 0 ? 'text-[#EF4444]' : 'text-[#10B981]'}`}>
                  {Number(item.amount || 0).toFixed(2)}
                </Text>
              </View>
            ))
          )}
        </GlassCard>

      </ScrollView>
    </View>
  );
}
