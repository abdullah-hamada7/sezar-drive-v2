import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, ScrollView, RefreshControl, TouchableOpacity, ActivityIndicator } from 'react-native';
import { Route, Play, CheckCircle, MapPin, Clock, Phone, User, AlertTriangle } from 'lucide-react-native';
import { tripService } from '../../services/trip.service';
import { useToast } from '../../contexts/ToastContext';
import { useShift } from '../../contexts/ShiftContext';
import TechnicalBackground from '../../components/TechnicalBackground';
import { GlassCard } from '../../components/GlassCard';
import { realtime } from '../../services/realtime.service';

const STATUS_COLORS: Record<string, string> = {
  ASSIGNED: 'bg-blue-500/20 text-blue-500 border-blue-500/30',
  IN_PROGRESS: 'bg-yellow-500/20 text-yellow-500 border-yellow-500/30',
  COMPLETED: 'bg-green-500/20 text-green-500 border-green-500/30',
  CANCELLED: 'bg-red-500/20 text-red-500 border-red-500/30'
};

export default function TripsScreen() {
  const [trips, setTrips] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<number | null>(null);
  const { addToast } = useToast();
  const { activeShift } = useShift();

  const loadTrips = useCallback(async () => {
    setLoading(true);
    try {
      const res = await tripService.getTrips('limit=20');
      setTrips(res.data.trips || []);
    } catch (err: any) {
      console.error(err);
      addToast(err?.message || 'Failed to load trips', 'error');
    } finally {
      setLoading(false);
    }
  }, [addToast]);

  useEffect(() => {
    loadTrips();
    const interval = setInterval(loadTrips, 30000); // Polling as alternative to WS for now
    const unsubscribe = realtime.subscribe((message) => {
      const messageType = message?.type;
      if (typeof messageType === 'string' && ['trip_assigned', 'trip_cancelled', 'trip_completed', 'trip_accepted'].includes(messageType)) {
        loadTrips();
      }
    });
    return () => {
      clearInterval(interval);
      unsubscribe();
    };
  }, [loadTrips]);

  const handleStart = async (id: number) => {
    setActionLoading(id);
    try {
      await tripService.startTrip(id);
      addToast('Trip started', 'success');
      loadTrips();
    } catch (err: any) {
      addToast(err?.message || 'Failed to start trip', 'error');
    } finally {
      setActionLoading(null);
    }
  };

  const handleComplete = async (id: number) => {
    setActionLoading(id);
    try {
      await tripService.completeTrip(id);
      addToast('Trip completed', 'success');
      loadTrips();
    } catch (err: any) {
      addToast(err?.message || 'Failed to complete trip', 'error');
    } finally {
      setActionLoading(null);
    }
  };

  return (
    <View className="flex-1 bg-[#030712]">
      <TechnicalBackground />
      <ScrollView
        contentContainerStyle={{ padding: 24, paddingTop: 64, paddingBottom: 100 }}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={loadTrips} tintColor="#3B82F6" />}
      >
        <Text className="text-3xl font-black text-white tracking-widest mb-8 text-shadow-sm shadow-blue-500/20">MY TRIPS</Text>

        {!activeShift && (
          <GlassCard className="mb-6" style={{ borderColor: 'rgba(234, 179, 8, 0.3)' }}>
            <View className="flex-row items-center justify-center py-2">
              <AlertTriangle color="#EAB308" size={20} />
              <Text className="text-[#EAB308] font-bold ml-3 text-sm text-center">You must start a shift to begin trips.</Text>
            </View>
          </GlassCard>
        )}

        {trips.length === 0 && !loading ? (
          <GlassCard className="items-center py-12">
            <View className="bg-white/5 p-4 rounded-full mb-4 border border-white/10">
              <Route size={32} color="#9CA3AF" />
            </View>
            <Text className="text-[#9CA3AF] font-medium tracking-wide uppercase text-sm">No trips assigned yet.</Text>
          </GlassCard>
        ) : (
          <View className="gap-6">
            {trips.map(trip => (
              <GlassCard key={trip.id} className="p-0">
                <View className="flex-row items-center justify-between mb-5 border-b border-white/5 pb-4">
                  <View className={`px-3 py-1 rounded-full border ${STATUS_COLORS[trip.status] || 'bg-gray-800'}`}>
                    <Text className={`text-[10px] font-bold uppercase tracking-wider ${STATUS_COLORS[trip.status] ? STATUS_COLORS[trip.status].split(' ')[1] : 'text-white'}`}>
                      {trip.status}
                    </Text>
                  </View>
                  <Text className="text-[#3B82F6] font-black text-lg">{trip.price} SAR</Text>
                </View>

                <View className="gap-4 mb-6">
                  <View className="flex-row items-center">
                    <View className="w-8 h-8 rounded-full bg-green-500/10 border border-green-500/20 items-center justify-center mr-3">
                      <MapPin size={16} color="#10B981" />
                    </View>
                    <View className="flex-1">
                      <Text className="text-[10px] text-[#9CA3AF] uppercase font-bold tracking-wider mb-0.5">Pickup</Text>
                      <Text className="text-[#F9FAFB] font-medium text-sm">{trip.pickupLocation}</Text>
                    </View>
                  </View>

                  <View className="flex-row items-center">
                    <View className="w-8 h-8 rounded-full bg-red-500/10 border border-red-500/20 items-center justify-center mr-3">
                      <MapPin size={16} color="#EF4444" />
                    </View>
                    <View className="flex-1">
                      <Text className="text-[10px] text-[#9CA3AF] uppercase font-bold tracking-wider mb-0.5">Dropoff</Text>
                      <Text className="text-[#F9FAFB] font-medium text-sm">{trip.dropoffLocation}</Text>
                    </View>
                  </View>

                  {trip.scheduledTime && (
                    <View className="flex-row items-center">
                      <View className="w-8 h-8 rounded-full bg-white/5 border border-white/10 items-center justify-center mr-3">
                        <Clock size={16} color="#9CA3AF" />
                      </View>
                      <View className="flex-1">
                        <Text className="text-[10px] text-[#9CA3AF] uppercase font-bold tracking-wider mb-0.5">Scheduled</Text>
                        <Text className="text-[#9CA3AF] text-sm">{new Date(trip.scheduledTime).toLocaleString()}</Text>
                      </View>
                    </View>
                  )}
                </View>

                {trip.passengers && trip.passengers.length > 0 && (
                  <View className="bg-black/20 rounded-xl p-4 mb-6 border border-white/5">
                    <Text className="text-[10px] font-bold text-[#6B7280] uppercase tracking-widest mb-3">Passenger Contact</Text>
                    <View className="flex-row items-center justify-between">
                      <View className="flex-row items-center flex-1">
                        <View className="bg-[#1F2937] p-2 rounded-lg border border-white/10 mr-3">
                          <User size={16} color="#9CA3AF" />
                        </View>
                        <Text className="text-[#F9FAFB] font-semibold" numberOfLines={1}>{trip.passengers[0].name || 'Guest'}</Text>
                      </View>
                      <View className="flex-row items-center bg-[#3B82F6]/10 px-3 py-1.5 rounded-lg border border-[#3B82F6]/20">
                        <Phone size={14} color="#3B82F6" />
                        <Text className="text-[#3B82F6] ml-2 font-bold text-xs">{trip.passengers[0].phone}</Text>
                      </View>
                    </View>
                    <View className="mt-3 flex-row items-center justify-end">
                      <Text className="text-[#9CA3AF] text-xs font-semibold">Bags: {trip.passengers[0].bags || 0}</Text>
                    </View>
                  </View>
                )}

                {trip.status === 'ASSIGNED' && (
                  <TouchableOpacity
                    className="bg-[#3B82F6] flex-row items-center justify-center p-4 rounded-xl shadow-lg shadow-blue-500/30"
                    disabled={actionLoading === trip.id}
                    onPress={() => handleStart(trip.id)}
                  >
                    {actionLoading === trip.id ? <ActivityIndicator color="#fff" /> : <Play size={20} color="#fff" />}
                    <Text className="text-[#F9FAFB] font-bold ml-2 text-sm tracking-widest uppercase">START TRIP</Text>
                  </TouchableOpacity>
                )}

                {trip.status === 'IN_PROGRESS' && (
                  <TouchableOpacity
                    className="bg-[#10B981] flex-row items-center justify-center p-4 rounded-xl shadow-lg shadow-green-500/30"
                    disabled={actionLoading === trip.id}
                    onPress={() => handleComplete(trip.id)}
                  >
                    {actionLoading === trip.id ? <ActivityIndicator color="#fff" /> : <CheckCircle size={20} color="#fff" />}
                    <Text className="text-[#F9FAFB] font-bold ml-2 text-sm tracking-widest uppercase">COMPLETE TRIP</Text>
                  </TouchableOpacity>
                )}
              </GlassCard>
            ))}
          </View>
        )}
      </ScrollView>
    </View>
  );
}
