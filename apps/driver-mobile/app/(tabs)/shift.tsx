import React, { useState } from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator, ScrollView } from 'react-native';
import { ShieldCheck, Play, Camera, QrCode, Square, CheckCircle2 } from 'lucide-react-native';
import { useShift } from '../../contexts/ShiftContext';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import { shiftService } from '../../services/shift.service';
import { vehicleService } from '../../services/vehicle.service';
import { tripService } from '../../services/trip.service';
import { inspectionService } from '../../services/inspection.service';
import FaceCapture from '../../components/FaceCapture';
import QRScanner from '../../components/QRScanner';
import TechnicalBackground from '../../components/TechnicalBackground';
import { GlassCard } from '../../components/GlassCard';

export default function ShiftScreen() {
    const { activeShift, loading: shiftLoading, refreshShift } = useShift();
    const { user } = useAuth();
    const { addToast } = useToast();
    const [actionLoading, setActionLoading] = useState(false);
    const [activeStep, setActiveStep] = useState<'face' | 'qr' | null>(null);

    const startShift = async () => {
        if (!user?.avatarUrl && !user?.profilePhotoUrl) {
            addToast('Profile photo is required before starting a shift', 'warning');
            return;
        }
        setActionLoading(true);
        try {
            await shiftService.createShift();
            await refreshShift();
            setActiveStep('face');
        } catch (err: any) {
            addToast(err?.message || 'Failed to start shift', 'error');
        } finally {
            setActionLoading(false);
        }
    };

    const handleFaceCapture = async (photoUri: string) => {
        if (!activeShift) return;
        setActionLoading(true);
        try {
            const formData: any = new FormData();
            formData.append('photo', { uri: photoUri, name: 'selfie.jpg', type: 'image/jpeg' });
            const result = await shiftService.verifyShift(formData);
            if (result.data.status === 'VERIFIED') {
                addToast('Identity Verified', 'success');
                setActiveStep(null);
                await refreshShift();
            } else if (result.data.status === 'MANUAL_REVIEW') {
                addToast('Flagged for manual review', 'info');
                setActiveStep(null);
                await refreshShift();
            } else {
                addToast('Verification failed', 'error');
            }
        } catch (err: any) {
            addToast(err?.message || 'Verification error', 'error');
        } finally {
            setActionLoading(false);
        }
    };

    const handleQRScan = async (qrCode: string) => {
        setActionLoading(true);
        try {
            await vehicleService.assignSelfVehicle(qrCode);
            addToast('Vehicle assigned', 'success');
            setActiveStep(null);
            await refreshShift();
        } catch (err: any) {
            addToast(err?.message || 'QR Scan failed', 'error');
        } finally {
            setActionLoading(false);
        }
    };

    const activateShift = async () => {
        if (!activeShift) return;
        setActionLoading(true);
        try {
            const inspectionsRes = await inspectionService.getInspections(`shiftId=${activeShift.id}`);
            const inspections = inspectionsRes.data || [];
            const hasCompletedInspection = inspections.some((insp: any) => {
                const photoCount = Array.isArray(insp.photos) ? insp.photos.length : 0;
                return insp.status === 'completed' && photoCount >= 4;
            });
            if (!hasCompletedInspection) {
                addToast('Inspection required before activation', 'warning');
                return;
            }
            await shiftService.activateShift(activeShift.id);
            addToast('Shift activated', 'success');
            await refreshShift();
        } catch (err: any) {
            addToast(err?.message || 'Failed to activate shift', 'error');
        } finally {
            setActionLoading(false);
        }
    };

    const endShift = async () => {
        if (!activeShift) return;
        setActionLoading(true);
        try {
            const inspectionsRes = await inspectionService.getInspections(`shiftId=${activeShift.id}`);
            const inspections = inspectionsRes.data || [];
            const startedAt = activeShift?.startedAt ? new Date(activeShift.startedAt) : null;

            const hasEndInspection = inspections.some((inspection: any) => {
                const createdAt = inspection?.createdAt ? new Date(inspection.createdAt) : null;
                const isAfterStart = startedAt && createdAt && createdAt > startedAt;
                const photoCount = Array.isArray(inspection?.photos) ? inspection.photos.length : 0;
                return inspection?.status === 'completed' && isAfterStart && photoCount >= 4;
            });

            if (startedAt && !hasEndInspection) {
                addToast('End-of-shift inspection required before closing your shift', 'warning');
                return;
            }

            const tripsRes = await tripService.getTrips('limit=50');
            const trips = tripsRes.data?.trips || [];
            const hasActiveTrip = trips.some((t: any) => t.status === 'ASSIGNED' || t.status === 'IN_PROGRESS');
            if (hasActiveTrip) {
                addToast('You cannot end shift with an active trip', 'warning');
                return;
            }
            await shiftService.closeShift(activeShift.id);
            addToast('Shift ended successfully', 'success');
            await refreshShift();
        } catch (err: any) {
            addToast(err?.message || 'Failed to end shift', 'error');
        } finally {
            setActionLoading(false);
        }
    };

    const cancelPendingShift = async () => {
        if (!activeShift) return;
        setActionLoading(true);
        try {
            await shiftService.closeShift(activeShift.id);
            addToast('Shift request cancelled', 'success');
            await refreshShift();
        } catch (err: any) {
            addToast(err?.message || 'Failed to cancel shift request', 'error');
        } finally {
            setActionLoading(false);
        }
    };

    if (shiftLoading) {
        return (
            <View className="flex-1 bg-[#030712] items-center justify-center">
                <TechnicalBackground />
                <ActivityIndicator color="#3B82F6" size="large" />
            </View>
        );
    }

    if (activeStep === 'face') {
        return (
            <View className="flex-1 bg-[#030712]">
                <TechnicalBackground />
                <View className="p-6 pt-16 flex-1">
                    <Text className="text-2xl font-black text-white mb-6">Biometric Check</Text>
                    <FaceCapture onCapture={handleFaceCapture} onCancel={() => setActiveStep(null)} />
                </View>
            </View>
        );
    }

    if (activeStep === 'qr') {
        return (
            <View className="flex-1 bg-[#030712]">
                <TechnicalBackground />
                <View className="p-6 pt-16 flex-1">
                    <Text className="text-2xl font-black text-white mb-6">Scan Vehicle</Text>
                    <QRScanner onScan={handleQRScan} onCancel={() => setActiveStep(null)} />
                </View>
            </View>
        );
    }

    const isVerified = activeShift?.verificationStatus === 'VERIFIED';
    const hasVehicle = !!activeShift?.vehicleId || !!activeShift?.vehicle;

    return (
        <View className="flex-1 bg-[#030712]">
            <TechnicalBackground />
            <ScrollView contentContainerStyle={{ padding: 24, paddingTop: 64, paddingBottom: 100 }}>
                <Text className="text-3xl font-black text-white tracking-widest mb-8 text-shadow-sm shadow-blue-500/20">SHIFT STATUS</Text>

                {!activeShift ? (
                    <GlassCard className="items-center py-8">
                        <View className="bg-white/5 p-4 rounded-full mb-6 border border-white/10">
                            <ShieldCheck size={48} color="#9CA3AF" />
                        </View>
                        <Text className="text-white text-xl font-bold mb-2 tracking-wide uppercase">No Active Shift</Text>
                        <Text className="text-[#9CA3AF] text-center mb-8 text-sm">Begin your shift to get vehicle assignments and access to the dispatch queue.</Text>

                        <TouchableOpacity
                            className="bg-[#3B82F6] flex-row items-center justify-center py-3.5 px-8 rounded-xl shadow-lg shadow-[#3B82F6]/40 w-full"
                            disabled={actionLoading}
                            onPress={startShift}
                        >
                            {actionLoading ? <ActivityIndicator color="#fff" /> : <Play size={20} color="#fff" />}
                            <Text className="text-white font-bold ml-2 text-sm tracking-wider uppercase">Start New Shift</Text>
                        </TouchableOpacity>
                    </GlassCard>
                ) : activeShift.status === 'PendingVerification' ? (
                    <GlassCard style={{ borderColor: 'rgba(234, 179, 8, 0.3)' }}>
                        <View className="absolute top-0 left-0 right-0 h-[2px] bg-[#EAB308] opacity-80" />
                        <View className="flex-row items-center mb-6">
                            <View className="bg-[#EAB308]/20 p-3 rounded-xl mr-4 border border-[#EAB308]/30">
                                <ShieldCheck size={28} color="#EAB308" />
                            </View>
                            <View className="flex-1">
                                <Text className="text-[#F9FAFB] font-bold text-lg tracking-wide uppercase">Security Gate</Text>
                                <Text className="text-[#EAB308] text-xs font-medium">Clearance required to drive</Text>
                            </View>
                        </View>

                        <View className="space-y-4 mb-8 gap-4">
                            {/* Step 1: Face */}
                            <TouchableOpacity
                                disabled={isVerified}
                                onPress={() => setActiveStep('face')}
                                className={`flex-row items-center p-4 rounded-xl border flex-1 ${isVerified ? 'bg-green-500/10 border-green-500/30' : 'bg-white/5 border-white/10'}`}
                            >
                                {isVerified ? <CheckCircle2 size={24} color="#10B981" /> : <Camera size={24} color="#9CA3AF" />}
                                <View className="ml-4 flex-1">
                                    <Text className={`font-bold uppercase tracking-wider text-sm ${isVerified ? 'text-green-500' : 'text-[#F9FAFB]'}`}>Face Verification</Text>
                                    <Text className="text-[#9CA3AF] text-[10px] mt-0.5">{isVerified ? 'Identity Confirmed' : activeShift?.verificationStatus || 'Pending'}</Text>
                                </View>
                                {!isVerified && <Play size={20} color="#666" />}
                            </TouchableOpacity>

                            {/* Step 2: QR */}
                            <TouchableOpacity
                                disabled={hasVehicle}
                                onPress={() => setActiveStep('qr')}
                                className={`flex-row items-center p-4 rounded-xl border flex-1 ${hasVehicle ? 'bg-green-500/10 border-green-500/30' : 'bg-white/5 border-white/10'}`}
                            >
                                {hasVehicle ? <CheckCircle2 size={24} color="#10B981" /> : <QrCode size={24} color="#9CA3AF" />}
                                <View className="ml-4 flex-1">
                                    <Text className={`font-bold uppercase tracking-wider text-sm ${hasVehicle ? 'text-green-500' : 'text-[#F9FAFB]'}`}>Vehicle Check-in</Text>
                                    <Text className="text-[#9CA3AF] text-[10px] mt-0.5">{hasVehicle ? `Assigned: ${activeShift.vehicle?.plateNumber || ''}` : 'Scan Vehicle QR'}</Text>
                                </View>
                                {!hasVehicle && <Play size={20} color="#666" />}
                            </TouchableOpacity>
                        </View>

                        <TouchableOpacity
                            disabled={!isVerified || !hasVehicle || actionLoading}
                            onPress={activateShift}
                            className={`py-3.5 flex-row items-center justify-center rounded-xl ${isVerified && hasVehicle ? 'bg-[#3B82F6]' : 'bg-[#1F2937] border border-white/10'}`}
                        >
                            {actionLoading ? <ActivityIndicator color="#fff" /> : <Play size={20} color={isVerified && hasVehicle ? '#fff' : '#666'} />}
                            <Text className={`font-bold ml-2 text-sm tracking-wider uppercase ${isVerified && hasVehicle ? 'text-[#F9FAFB]' : 'text-gray-500'}`}>
                                Activate & Drive
                            </Text>
                        </TouchableOpacity>

                        <TouchableOpacity className="mt-5 py-3 items-center" onPress={cancelPendingShift} disabled={actionLoading}>
                            <Text className="text-[#9CA3AF] font-bold uppercase tracking-widest text-xs">Cancel Shift Request</Text>
                        </TouchableOpacity>
                    </GlassCard>
                ) : (
                    <GlassCard style={{ borderColor: 'rgba(16, 185, 129, 0.3)' }}>
                        <View className="absolute top-0 left-0 right-0 h-[2px] bg-[#10B981] opacity-80" />
                        <View className="flex-row items-center justify-between mb-6 border-b border-white/10 pb-6">
                            <View className="flex-row items-center">
                                <View className="w-4 h-4 rounded-full bg-[#10B981] shadow-sm shadow-green-500/50 mr-3" />
                                <Text className="text-[#F9FAFB] text-xl font-bold uppercase tracking-wide">Shift Active</Text>
                            </View>
                            <View className="bg-[#10B981]/20 px-3 py-1 rounded-full border border-[#10B981]/30">
                                <Text className="text-[#10B981] font-bold text-[10px] uppercase">IN PROGRESS</Text>
                            </View>
                        </View>

                        <View className="mb-8">
                            <View className="flex-row justify-between mb-4 border-b border-white/5 pb-4">
                                <Text className="text-[#9CA3AF] text-sm uppercase font-bold tracking-wider">Vehicle</Text>
                                <Text className="text-[#3B82F6] font-bold">{activeShift.vehicle?.plateNumber || activeShift.assignments?.[0]?.vehicle?.plateNumber || 'Unknown'}</Text>
                            </View>
                            <View className="flex-row justify-between">
                                <Text className="text-[#9CA3AF] text-sm uppercase font-bold tracking-wider">Started</Text>
                                <Text className="text-[#F9FAFB] font-medium">{activeShift.startedAt ? new Date(activeShift.startedAt).toLocaleTimeString() : '—'}</Text>
                            </View>
                        </View>

                        <TouchableOpacity
                            disabled={actionLoading}
                            onPress={endShift}
                            className="bg-red-500/10 border border-red-500/50 flex-row justify-center items-center py-3.5 rounded-xl"
                        >
                            {actionLoading ? <ActivityIndicator color="#EF4444" /> : <Square size={20} color="#EF4444" />}
                            <Text className="text-red-500 font-bold ml-2 tracking-widest text-sm uppercase">End Shift</Text>
                        </TouchableOpacity>
                    </GlassCard>
                )}
            </ScrollView>
        </View>
    );
}
