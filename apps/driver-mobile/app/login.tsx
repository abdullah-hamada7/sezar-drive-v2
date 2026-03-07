import { useState } from 'react';
import { TextInput, TouchableOpacity, KeyboardAvoidingView, Platform, ScrollView, View, Text, ActivityIndicator } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Stack, useRouter } from 'expo-router';
import { Car, LogIn, Eye, EyeOff } from 'lucide-react-native';

import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import TechnicalBackground from '../components/TechnicalBackground';
import { GlassCard } from '../components/GlassCard';

export default function LoginScreen() {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const { login, loading } = useAuth();
    const { addToast } = useToast();
    const router = useRouter();

    const handleLogin = async () => {
        if (!email || !password) {
            addToast('Please enter both email and password', 'warning');
            return;
        }

        try {
            const res = await login(email, password);
            if (res?.requiresVerification) {
                router.replace({
                    pathname: '/verify-device',
                    params: { userId: res.userId, deviceFingerprint: res.deviceFingerprint }
                });
            }
        } catch (error: any) {
            addToast(error.message || 'Login failed', 'error');
        }
    };

    return (
        <>
            <Stack.Screen options={{ headerShown: false }} />
            <TechnicalBackground />

            <KeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                className="flex-1"
            >
                <ScrollView contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', padding: 24 }}>

                    <GlassCard variant="login" className="p-8">
                        <View className="items-center mb-8">
                            <View className="w-16 h-16 rounded-xl bg-[#1F2937] border border-white/10 items-center justify-center shadow-lg shadow-black/30 mb-4 overflow-hidden">
                                <LinearGradient
                                    colors={['rgba(59, 130, 246, 0.2)', 'transparent']}
                                    style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
                                />
                                <Car color="#3B82F6" size={32} />
                            </View>
                            <Text className="text-3xl font-black text-[#F9FAFB] tracking-widest text-center shadow-sm shadow-blue-500/20">
                                SEZAR DRIVE
                            </Text>
                            <Text className="text-xs text-[#9CA3AF] mt-1 tracking-widest font-semibold uppercase text-center">
                                Driver Portal
                            </Text>
                        </View>

                        <View className="mb-5 bg-transparent">
                            <Text className="text-[#9CA3AF] text-xs mb-2 font-bold tracking-wider uppercase">Email / Identification</Text>
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

                        <View className="bg-transparent mb-2">
                            <View className="flex-row justify-between mb-2">
                                <Text className="text-[#9CA3AF] text-xs font-bold tracking-wider uppercase">Access Code</Text>
                            </View>
                            <View className="relative">
                                <TextInput
                                    className="bg-[#030712]/50 rounded-lg px-4 py-3 text-[#F9FAFB] border border-white/10 font-medium pr-12"
                                    placeholder="••••••••"
                                    placeholderTextColor="#6B7280"
                                    value={password}
                                    onChangeText={setPassword}
                                    secureTextEntry={!showPassword}
                                />
                                <TouchableOpacity
                                    className="absolute right-3 top-3"
                                    onPress={() => setShowPassword(!showPassword)}
                                >
                                    {showPassword ? <EyeOff size={20} color="#9CA3AF" /> : <Eye size={20} color="#9CA3AF" />}
                                </TouchableOpacity>
                            </View>
                        </View>

                        <TouchableOpacity
                            className="rounded-lg overflow-hidden mt-6 shadow-lg shadow-[#3B82F6]/30"
                            onPress={handleLogin}
                            activeOpacity={0.8}
                            disabled={loading}
                        >
                            <LinearGradient
                                colors={['#3B82F6', '#2563EB']}
                                className="py-3.5 items-center justify-center flex-row"
                            >
                                {loading ? (
                                    <ActivityIndicator color="#fff" className="mr-2" />
                                ) : (
                                    <LogIn size={18} color="#fff" className="mr-2" />
                                )}
                                <Text className="text-[#F9FAFB] text-sm font-bold tracking-wider uppercase">
                                    {loading ? 'Authenticating...' : 'Sign In'}
                                </Text>
                            </LinearGradient>
                        </TouchableOpacity>

                        <TouchableOpacity className="mt-4 py-3 items-center" activeOpacity={0.7} onPress={() => router.push('/reset-password')}>
                            <Text className="text-[#9CA3AF] font-semibold text-sm">Recover Password</Text>
                        </TouchableOpacity>
                    </GlassCard>

                </ScrollView>
            </KeyboardAvoidingView>
        </>
    );
}
