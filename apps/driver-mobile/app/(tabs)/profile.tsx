import React from 'react';
import { ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { useRouter } from 'expo-router';
import { User, Lock, LogOut } from 'lucide-react-native';
import TechnicalBackground from '../../components/TechnicalBackground';
import { GlassCard } from '../../components/GlassCard';
import { useAuth } from '../../contexts/AuthContext';

export default function ProfileScreen() {
    const router = useRouter();
    const { user, logout } = useAuth();

    const displayName = user?.name || [user?.firstName, user?.lastName].filter(Boolean).join(' ') || 'Driver';

    return (
        <View className="flex-1 bg-[#030712]">
            <TechnicalBackground />
            <ScrollView contentContainerStyle={{ padding: 24, paddingTop: 64, paddingBottom: 100 }}>
                <View className="items-center mb-8">
                    <View className="w-24 h-24 rounded-full bg-[#1F2937] border-2 border-[#3B82F6]/40 items-center justify-center mb-4">
                        <User size={40} color="#3B82F6" />
                    </View>
                    <Text className="text-white text-2xl font-black tracking-wide text-center">{displayName}</Text>
                    <Text className="text-[#9CA3AF] text-sm mt-1">{user?.email}</Text>
                </View>

                <GlassCard className="mb-6 p-0 overflow-hidden">
                    <TouchableOpacity className="flex-row items-center px-5 py-4 border-b border-white/5" onPress={() => router.push('/change-password')}>
                        <Lock size={18} color="#3B82F6" />
                        <Text className="text-[#F9FAFB] font-semibold ml-3">Change Password</Text>
                    </TouchableOpacity>
                    <TouchableOpacity className="flex-row items-center px-5 py-4" onPress={logout}>
                        <LogOut size={18} color="#EF4444" />
                        <Text className="text-[#EF4444] font-semibold ml-3">Sign Out</Text>
                    </TouchableOpacity>
                </GlassCard>
            </ScrollView>
        </View>
    );
}
