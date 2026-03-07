import { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, Text, TextInput, TouchableOpacity, View, ActivityIndicator } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import TechnicalBackground from '../components/TechnicalBackground';
import { GlassCard } from '../components/GlassCard';
import { useToast } from '../contexts/ToastContext';
import { authService } from '../services/auth.service';

export default function ResetPasswordScreen() {
    const [email, setEmail] = useState('');
    const [loading, setLoading] = useState(false);
    const router = useRouter();
    const { addToast } = useToast();

    const handleResetRequest = async () => {
        if (!email) {
            addToast('Please enter your email', 'warning');
            return;
        }

        setLoading(true);
        try {
            await authService.requestRescue(email);
            addToast('Recovery request sent. Please check with support/admin for your rescue code.', 'success');
            router.replace('/login');
        } catch (err: any) {
            addToast(err?.message || 'Failed to send recovery request', 'error');
        } finally {
            setLoading(false);
        }
    };

    return (
        <>
            <Stack.Screen options={{ headerShown: false }} />
            <TechnicalBackground />

            <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} className="flex-1">
                <ScrollView contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', padding: 24 }}>
                    <GlassCard variant="login" className="p-8">
                        <View className="items-center mb-8">
                            <Text className="text-3xl font-black text-[#F9FAFB] tracking-widest text-center">ACCOUNT RECOVERY</Text>
                            <Text className="text-xs text-[#9CA3AF] mt-2 tracking-wider font-semibold uppercase text-center">
                                Request Rescue Access
                            </Text>
                        </View>

                        <View className="mb-6">
                            <Text className="text-[#9CA3AF] text-xs mb-2 font-bold tracking-wider uppercase">Email</Text>
                            <TextInput
                                className="bg-[#030712]/50 rounded-lg px-4 py-3 text-[#F9FAFB] border border-white/10 font-medium"
                                placeholder="driver@example.com"
                                placeholderTextColor="#6B7280"
                                value={email}
                                onChangeText={setEmail}
                                keyboardType="email-address"
                                autoCapitalize="none"
                            />
                        </View>

                        <TouchableOpacity
                            className="rounded-lg bg-[#3B82F6] py-3.5 items-center justify-center"
                            onPress={handleResetRequest}
                            activeOpacity={0.8}
                            disabled={loading}
                        >
                            {loading ? <ActivityIndicator color="#fff" /> : <Text className="text-[#F9FAFB] text-sm font-bold tracking-wider uppercase">Send Request</Text>}
                        </TouchableOpacity>

                        <TouchableOpacity className="mt-4 py-2 items-center" onPress={() => router.replace('/login')}>
                            <Text className="text-[#9CA3AF] font-semibold text-sm">Back to Login</Text>
                        </TouchableOpacity>
                    </GlassCard>
                </ScrollView>
            </KeyboardAvoidingView>
        </>
    );
}
