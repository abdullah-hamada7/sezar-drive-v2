import React, { useRef, useState } from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { Camera, RefreshCw } from 'lucide-react-native';

interface FaceCaptureProps {
    onCapture: (photoUri: string) => void;
    onCancel: () => void;
}

export default function FaceCapture({ onCapture, onCancel }: FaceCaptureProps) {
    const [permission, requestPermission] = useCameraPermissions();
    const cameraRef = useRef<CameraView>(null);
    const [capturing, setCapturing] = useState(false);

    if (!permission) {
        return <View className="flex-1 items-center justify-center"><ActivityIndicator color="#3B82F6" /></View>;
    }

    if (!permission.granted) {
        return (
            <View className="items-center justify-center p-4">
                <Text className="text-white text-center mb-4">We need your permission to show the camera for facial verification.</Text>
                <TouchableOpacity onPress={requestPermission} className="bg-[#3B82F6] px-4 py-2 rounded-xl">
                    <Text className="text-white font-bold">Grant Permission</Text>
                </TouchableOpacity>
            </View>
        );
    }

    const takePicture = async () => {
        if (!cameraRef.current || capturing) return;
        setCapturing(true);
        try {
            const photo = await cameraRef.current.takePictureAsync({
                quality: 0.7,
                base64: false
            });
            if (photo?.uri) {
                onCapture(photo.uri);
            }
        } catch (e) {
            console.error(e);
            setCapturing(false);
        }
    };

    return (
        <View className="gap-4">
            <View className="w-full aspect-[3/4] bg-black rounded-2xl overflow-hidden border border-white/10 relative">
                <CameraView
                    ref={cameraRef}
                    style={{ flex: 1 }}
                    facing="front"
                />
                <View className="absolute bottom-4 left-0 right-0 items-center">
                    <TouchableOpacity
                        onPress={takePicture}
                        disabled={capturing}
                        className="bg-[#3B82F6] px-6 py-3 rounded-full flex-row items-center shadow-lg shadow-black/50"
                    >
                        {capturing ? <RefreshCw color="#fff" size={20} /> : <Camera color="#fff" size={20} />}
                        <Text className="text-white font-bold ml-2">Verify Identity</Text>
                    </TouchableOpacity>
                </View>
            </View>
            <TouchableOpacity onPress={onCancel} className="items-center py-2">
                <Text className="text-[#9CA3AF] font-bold uppercase tracking-wider">Cancel</Text>
            </TouchableOpacity>
        </View>
    );
}
