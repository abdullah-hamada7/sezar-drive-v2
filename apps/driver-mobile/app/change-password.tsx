import { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { authService } from '../services/auth.service';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { http } from '../services/http.service';

export default function ChangePasswordScreen() {
    const [currentPassword, setCurrentPassword] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const { user, updateUser } = useAuth();
    const { addToast } = useToast();
    const router = useRouter();

    const handleSubmit = async () => {
        if (!currentPassword || !newPassword || !confirmPassword) {
            addToast('Please fill all fields', 'warning');
            return;
        }

        if (newPassword !== confirmPassword) {
            addToast('Passwords do not match', 'error');
            return;
        }

        if (newPassword.length < 8) {
            addToast('Password must be at least 8 characters', 'error');
            return;
        }

        setLoading(true);
        try {
            const res = await authService.changePassword({ currentPassword, newPassword });
            const { user: updatedUser, accessToken, refreshToken } = res.data;

            if (accessToken) {
                await http.setTokens(accessToken, refreshToken);
                await updateUser(updatedUser);
            } else {
                await updateUser({ mustChangePassword: false });
            }

            addToast('Password changed successfully!', 'success');
            setTimeout(() => {
                if (updatedUser?.role === 'driver' || user?.role === 'driver') {
                    router.replace('/(tabs)');
                }
            }, 1000);
        } catch (err: any) {
            addToast(err.message || 'Change password failed', 'error');
        } finally {
            setLoading(false);
        }
    };

    return (
        <>
            <LinearGradient
                colors={['#1F2937', '#111827', '#030712']}
                className="absolute left-0 right-0 top-0 h-full"
            />
            <KeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                className="flex-1"
            >
                <ScrollView contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', padding: 24 }}>
                    <View className="items-center mb-8">
                        <Text className="text-3xl font-black text-[#F9FAFB] tracking-widest text-shadow-sm shadow-[#3B82F6]">SECURE ACCOUNT</Text>
                        <Text className="text-sm text-[#60A5FA] mt-2 font-semibold uppercase text-center">
                            {user?.mustChangePassword ? 'Mandatory Password Update' : 'Update Security Credentials'}
                        </Text>
                    </View>

                    <View className="bg-black/40 rounded-3xl p-8 border border-white/5 shadow-2xl">
                        <View className="mb-5">
                            <Text className="text-[#9CA3AF] text-xs mb-2 font-bold tracking-wider uppercase">Current Password</Text>
                            <TextInput
                                className="bg-white/5 rounded-2xl p-4 text-[#F9FAFB] text-base border border-white/10 font-medium"
                                placeholder="••••••••"
                                placeholderTextColor="#9CA3AF"
                                value={currentPassword}
                                onChangeText={setCurrentPassword}
                                secureTextEntry
                            />
                        </View>

                        <View className="mb-5">
                            <Text className="text-[#9CA3AF] text-xs mb-2 font-bold tracking-wider uppercase">New Password (Min 8 Chars)</Text>
                            <TextInput
                                className="bg-white/5 rounded-2xl p-4 text-[#F9FAFB] text-base border border-white/10 font-medium"
                                placeholder="••••••••"
                                placeholderTextColor="#9CA3AF"
                                value={newPassword}
                                onChangeText={setNewPassword}
                                secureTextEntry
                            />
                        </View>

                        <View className="mb-8">
                            <Text className="text-[#9CA3AF] text-xs mb-2 font-bold tracking-wider uppercase">Confirm New Password</Text>
                            <TextInput
                                className="bg-white/5 rounded-2xl p-4 text-[#F9FAFB] text-base border border-white/10 font-medium"
                                placeholder="••••••••"
                                placeholderTextColor="#9CA3AF"
                                value={confirmPassword}
                                onChangeText={setConfirmPassword}
                                secureTextEntry
                            />
                        </View>

                        <TouchableOpacity
                            className="rounded-2xl overflow-hidden shadow-lg shadow-[#3B82F6]/40"
                            onPress={handleSubmit}
                            activeOpacity={0.8}
                            disabled={loading}
                        >
                            <LinearGradient
                                colors={['#3B82F6', '#2563EB']}
                                className="p-4 items-center justify-center flex-row"
                            >
                                {loading && <ActivityIndicator color="#fff" className="mr-2" />}
                                <Text className="text-[#F9FAFB] text-lg font-extrabold tracking-wider uppercase">
                                    {loading ? 'Updating...' : 'Confirm Update'}
                                </Text>
                            </LinearGradient>
                        </TouchableOpacity>
                    </View>
                </ScrollView>
            </KeyboardAvoidingView>
        </>
    );
}
