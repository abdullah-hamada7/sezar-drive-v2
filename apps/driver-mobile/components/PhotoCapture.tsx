import React, { useRef, useState } from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { Camera } from 'lucide-react-native';

interface PhotoCaptureProps {
    onCapture: (photoUri: string) => void;
    onCancel: () => void;
    title?: string;
}

export default function PhotoCapture({ onCapture, onCancel, title = "Take Photo" }: PhotoCaptureProps) {
    const [permission, requestPermission] = useCameraPermissions();
    const cameraRef = useRef<CameraView>(null);
    const [capturing, setCapturing] = useState(false);

    if (!permission) {
        return <View className="flex-1 items-center justify-center"><ActivityIndicator color="#3B82F6" /></View>;
    }

    if (!permission.granted) {
        return (
            <View className="items-center justify-center p-4">
                <Text className="text-white text-center mb-4">We need camera permission to take vehicle photos.</Text>
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
            <Text className="text-xl font-bold text-white text-center mb-2">{title}</Text>
            <View className="w-full aspect-[4/3] bg-black rounded-2xl overflow-hidden border border-white/10 relative">
                <CameraView
                    ref={cameraRef}
                    style={{ flex: 1 }}
                    facing="back"
                />
                <View className="absolute bottom-4 left-0 right-0 items-center">
                    <TouchableOpacity
                        onPress={takePicture}
                        disabled={capturing}
                        className="bg-[#3B82F6] w-16 h-16 rounded-full items-center justify-center border-4 border-white/50 shadow-lg shadow-black/50"
                    >
                        {capturing ? <ActivityIndicator color="#fff" /> : <Camera color="#fff" size={24} />}
                    </TouchableOpacity>
                </View>
            </View>
            <TouchableOpacity onPress={onCancel} className="items-center py-4">
                <Text className="text-[#9CA3AF] font-bold uppercase tracking-wider">Cancel</Text>
            </TouchableOpacity>
        </View>
    );
}
