import React, { useState } from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';

interface QRScannerProps {
    onScan: (data: string) => void;
    onCancel: () => void;
}

export default function QRScanner({ onScan, onCancel }: QRScannerProps) {
    const [permission, requestPermission] = useCameraPermissions();
    const [scanned, setScanned] = useState(false);

    if (!permission) {
        return <View className="flex-1 items-center justify-center"><ActivityIndicator color="#3B82F6" /></View>;
    }

    if (!permission.granted) {
        return (
            <View className="items-center justify-center p-4">
                <Text className="text-white text-center mb-4">We need camera permission to scan Vehicle QR codes.</Text>
                <TouchableOpacity onPress={requestPermission} className="bg-[#3B82F6] px-4 py-2 rounded-xl">
                    <Text className="text-white font-bold">Grant Permission</Text>
                </TouchableOpacity>
            </View>
        );
    }

    const handleBarcodeScanned = ({ data }: { data: string }) => {
        if (scanned) return;
        setScanned(true);
        onScan(data);
    };

    return (
        <View className="gap-4">
            <View className="w-full aspect-square bg-black rounded-2xl overflow-hidden border-2 border-white/10 relative">
                <CameraView
                    style={{ flex: 1 }}
                    facing="back"
                    onBarcodeScanned={scanned ? undefined : handleBarcodeScanned}
                    barcodeScannerSettings={{
                        barcodeTypes: ["qr"]
                    }}
                />
                <View className="absolute inset-0 items-center justify-center pointer-events-none">
                    <View className="w-48 h-48 border-2 border-[#3B82F6]/50 rounded-xl" />
                </View>
            </View>

            <Text className="text-center text-gray-400 mb-2">Point camera at vehicle QR code</Text>

            <TouchableOpacity onPress={onCancel} className="items-center py-2">
                <Text className="text-[#9CA3AF] font-bold uppercase tracking-wider">Cancel</Text>
            </TouchableOpacity>
        </View>
    );
}
