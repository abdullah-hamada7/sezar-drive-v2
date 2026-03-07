import { useState, useRef, useEffect } from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { LinearGradient } from 'expo-linear-gradient';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { authService } from '../services/auth.service';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { http } from '../services/http.service';

export default function VerifyDeviceScreen() {
    const { userId, deviceFingerprint } = useLocalSearchParams();
    const router = useRouter();
    const { updateUser } = useAuth();
    const { addToast } = useToast();

    const [permission, requestPermission] = useCameraPermissions();
    const cameraRef = useRef<CameraView>(null);
    const [loading, setLoading] = useState(false);
    const [success, setSuccess] = useState(false);

    useEffect(() => {
        if (!userId || !deviceFingerprint) {
            router.replace('/login');
        }
    }, [userId, deviceFingerprint, router]);

    if (!permission) {
        // Camera permissions are still loading.
        return <View className="flex-1 bg-[#111827] items-center justify-center"><ActivityIndicator color="#3B82F6" /></View>;
    }

    if (!permission.granted) {
        // Camera permissions are not granted yet.
        return (
            <View className="flex-1 bg-[#111827] items-center justify-center p-6">
                <Text className="text-white text-center text-lg mb-6">We need your permission to show the camera for facial verification.</Text>
                <TouchableOpacity onPress={requestPermission} className="bg-[#3B82F6] px-6 py-3 rounded-full">
                    <Text className="text-white font-bold">Grant Permission</Text>
                </TouchableOpacity>
            </View>
        );
    }

    const captureAndVerify = async () => {
        if (!cameraRef.current) return;

        setLoading(true);
        try {
            const photo = await cameraRef.current.takePictureAsync({
                quality: 0.8,
                base64: false
            });

            if (!photo || !photo.uri) {
                throw new Error("Failed to capture image");
            }

            const formData: any = new FormData();
            formData.append('userId', userId);
            formData.append('deviceFingerprint', deviceFingerprint);
            formData.append('photo', {
                uri: photo.uri,
                name: 'selfie.jpg',
                type: 'image/jpeg'
            });

            const res = await authService.verifyDevice(formData);
            const { user: userData, accessToken, refreshToken } = res.data;

            await http.setTokens(accessToken, refreshToken);
            await updateUser(userData);
            setSuccess(true);
            addToast('Identity Verified!', 'success');

            setTimeout(() => {
                if (userData.mustChangePassword) {
                    router.replace('/change-password');
                } else if (userData.role === 'driver') {
                    router.replace('/(tabs)');
                }
            }, 1500);

        } catch (err: any) {
            const message = err.message || 'Verification failed';
            addToast(message, 'error');
        } finally {
            setLoading(false);
        }
    };

    return (
        <View className="flex-1 bg-[#030712]">
            <View className="pt-20 pb-8 px-6 items-center">
                <Text className="text-2xl font-black text-[#F9FAFB] tracking-widest text-center mb-2">IDENTITY CHECK</Text>
                <Text className="text-sm text-[#60A5FA] font-semibold text-center uppercase tracking-wider">
                    Position your face within the frame
                </Text>
            </View>

            {success ? (
                <View className="flex-1 items-center justify-center">
                    <View className="w-32 h-32 rounded-full bg-green-500/20 items-center justify-center mb-6">
                        <Text className="text-green-500 text-6xl">✓</Text>
                    </View>
                    <Text className="text-white text-xl font-bold">Verification Successful</Text>
                    <Text className="text-gray-400 mt-2">Redirecting to portal...</Text>
                </View>
            ) : (
                <View className="flex-1 items-center px-6 pb-12">
                    <View className="w-full aspect-[3/4] rounded-3xl overflow-hidden border-2 border-white/10 mb-8 bg-black">
                        <CameraView
                            ref={cameraRef}
                            style={{ flex: 1 }}
                            facing="front"
                        />
                    </View>

                    <TouchableOpacity
                        className="w-full rounded-2xl overflow-hidden shadow-lg shadow-[#3B82F6]/40"
                        onPress={captureAndVerify}
                        activeOpacity={0.8}
                        disabled={loading}
                    >
                        <LinearGradient
                            colors={['#3B82F6', '#2563EB']}
                            className="p-5 items-center justify-center flex-row"
                        >
                            {loading && <ActivityIndicator color="#fff" className="mr-2" />}
                            <Text className="text-[#F9FAFB] text-lg font-extrabold tracking-wider uppercase">
                                {loading ? 'Analyzing...' : 'Scan Biometrics'}
                            </Text>
                        </LinearGradient>
                    </TouchableOpacity>

                    <TouchableOpacity className="mt-6 p-2" onPress={() => router.replace('/login')}>
                        <Text className="text-[#9CA3AF] font-bold uppercase tracking-wider">Cancel</Text>
                    </TouchableOpacity>
                </View>
            )}
        </View>
    );
}
