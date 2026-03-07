import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, TextInput, ActivityIndicator, Image } from 'react-native';
import { AlertTriangle, Camera, CheckCircle, X } from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { damageService } from '../../services/damage.service';
import { tripService } from '../../services/trip.service';
import { useShift } from '../../contexts/ShiftContext';
import { useToast } from '../../contexts/ToastContext';
import PhotoCapture from '../../components/PhotoCapture';
import TechnicalBackground from '../../components/TechnicalBackground';
import { GlassCard } from '../../components/GlassCard';
import { realtime } from '../../services/realtime.service';

export default function DamageScreen() {
    const router = useRouter();
    const { activeShift: shift } = useShift();
    const { addToast } = useToast();

    const [description, setDescription] = useState('');
    const [photos, setPhotos] = useState<string[]>([]);
    const [loading, setLoading] = useState(false);
    const [showCamera, setShowCamera] = useState(false);
    const [reported, setReported] = useState(false);
    const [activeTrip, setActiveTrip] = useState<any>(null);

    useEffect(() => {
        const loadContext = async () => {
            try {
                const tripRes = await tripService.getTrips('limit=1&status=IN_PROGRESS');
                setActiveTrip(tripRes.data?.trips?.[0] || null);
            } catch {
                setActiveTrip(null);
            }
        };
        loadContext();
        const unsubscribe = realtime.subscribe((message) => {
            const messageType = message?.type;
            if (typeof messageType === 'string' && ['damage_reported', 'damage_reviewed', 'trip_completed', 'shift_closed'].includes(messageType)) {
                loadContext();
            }
        });
        return unsubscribe;
    }, []);

    if (!shift) {
        return (
            <View className="flex-1 bg-[#030712]">
                <TechnicalBackground />
                <View className="flex-1 p-6 pt-16 items-center justify-center">
                    <GlassCard className="items-center py-10 w-full">
                        <AlertTriangle size={56} color="#EAB308" className="mb-6" />
                        <Text className="text-[#F9FAFB] text-xl font-black tracking-widest uppercase mb-2">No Active Shift</Text>
                        <Text className="text-[#9CA3AF] text-center mb-6">Start a shift before submitting damage reports.</Text>
                        <TouchableOpacity className="bg-[#3B82F6] py-3 px-6 rounded-xl" onPress={() => router.push('/(tabs)/shift')}>
                            <Text className="text-[#F9FAFB] font-bold uppercase tracking-wider text-xs">Go to Shift</Text>
                        </TouchableOpacity>
                    </GlassCard>
                </View>
            </View>
        );
    }

    const handleSubmit = async () => {
        if (!shift) {
            addToast('You need an active shift to submit a damage report', 'error');
            return;
        }

        if (!description.trim()) {
            addToast('Please provide a description', 'error');
            return;
        }

        const vehicleId = shift?.vehicleId || shift?.assignments?.[0]?.vehicleId || shift?.vehicle?.id;
        if (!vehicleId) {
            addToast('No vehicle assigned for this shift', 'error');
            return;
        }

        setLoading(true);
        try {
            const reportPayload: any = {
                description,
                shiftId: shift.id,
                vehicleId,
                tripId: activeTrip?.id,
            };

            const reportRes = await damageService.report(reportPayload);
            const reportId = reportRes.data?.data?.id || reportRes.data?.id;

            if (reportId && photos.length) {
                for (let i = 0; i < photos.length; i += 1) {
                    const photoPayload: any = new FormData();
                    photoPayload.append('photo', {
                        uri: photos[i],
                        name: `damage-${i + 1}.jpg`,
                        type: 'image/jpeg'
                    });
                    await damageService.uploadPhoto(reportId, photoPayload);
                }
            }

            addToast('Damage reported successfully. The vehicle may be marked for maintenance.', 'success');
            setReported(true);
            setDescription('');
            setPhotos([]);
        } catch (err: any) {
            addToast(err?.message || 'Failed to submit damage report', 'error');
        } finally {
            setLoading(false);
        }
    };

    if (reported) {
        return (
            <View className="flex-1 bg-[#030712]">
                <TechnicalBackground />
                <View className="flex-1 p-6 pt-16 items-center justify-center">
                    <GlassCard className="items-center py-10 w-full" style={{ borderColor: 'rgba(239, 68, 68, 0.3)' }}>
                        <View className="absolute top-0 left-0 right-0 h-[2px] bg-[#EF4444] opacity-80" />
                        <View className="bg-red-500/10 p-6 rounded-full mb-6 border border-red-500/20">
                            <CheckCircle size={56} color="#EF4444" />
                        </View>
                        <Text className="text-[#F9FAFB] text-xl font-black tracking-widest uppercase mb-4 text-center">Report Submitted</Text>
                        <Text className="text-[#9CA3AF] text-center mb-8 font-medium leading-relaxed">
                            Your damage report has been sent to fleet administration.
                            Depending on severity, this vehicle may be locked for maintenance.
                        </Text>

                        <TouchableOpacity
                            onPress={() => setReported(false)}
                            className="bg-black/20 border border-white/10 py-3.5 px-8 rounded-xl shadow-lg"
                        >
                            <Text className="text-[#F9FAFB] font-bold uppercase tracking-widest text-xs">Submit Another Report</Text>
                        </TouchableOpacity>
                    </GlassCard>
                </View>
            </View>
        );
    }

    if (showCamera) {
        return (
            <View className="flex-1 bg-[#030712]">
                <TechnicalBackground />
                <View className="p-6 pt-16 flex-1">
                    <PhotoCapture
                        title="Capture Damage"
                        onCapture={(uri) => {
                            setPhotos((prev) => [...prev, uri]);
                            setShowCamera(false);
                        }}
                        onCancel={() => setShowCamera(false)}
                    />
                </View>
            </View>
        );
    }

    return (
        <View className="flex-1 bg-[#030712]">
            <TechnicalBackground />
            <ScrollView contentContainerStyle={{ padding: 24, paddingTop: 64, paddingBottom: 100 }}>
                <Text className="text-3xl font-black text-white tracking-widest mb-4 text-shadow-sm shadow-blue-500/20">REPORT DAMAGE</Text>
                <Text className="text-[#9CA3AF] mb-8 font-medium">Report any new damages, scratches, or vehicle issues instantly.</Text>

                {!shift.vehicle && (
                    <GlassCard className="mb-6" style={{ borderColor: 'rgba(234, 179, 8, 0.3)' }}>
                        <View className="flex-row items-start">
                            <AlertTriangle color="#EAB308" size={20} className="mt-0.5" />
                            <View className="ml-3 flex-1">
                                <Text className="text-[#EAB308] font-black uppercase tracking-wider text-xs mb-1.5">No Vehicle Assigned</Text>
                                <Text className="text-[#9CA3AF] text-xs font-medium leading-relaxed">You must be logged into an active shift with an assigned vehicle to report damage accurately. If you continue, the report might lack context.</Text>
                            </View>
                        </View>
                    </GlassCard>
                )}

                <GlassCard className="mb-6 pb-6">
                    <View className="flex-row items-center justify-between mb-3">
                        <Text className="text-[#6B7280] font-black uppercase tracking-widest text-[10px]">Damage Photos (Optional)</Text>
                        <TouchableOpacity onPress={() => setShowCamera(true)} className="bg-black/20 border border-white/10 px-3 py-2 rounded-lg flex-row items-center">
                            <Camera color="#9CA3AF" size={14} />
                            <Text className="text-[#9CA3AF] font-bold text-[10px] uppercase tracking-wider ml-2">Add Photo</Text>
                        </TouchableOpacity>
                    </View>

                    {photos.length === 0 ? (
                        <TouchableOpacity
                            onPress={() => setShowCamera(true)}
                            className="w-full aspect-video bg-black/20 rounded-2xl border-2 border-dashed border-white/10 items-center justify-center shadow-lg"
                        >
                            <View className="bg-white/5 p-4 rounded-full mb-4 border border-white/5">
                                <Camera color="#9CA3AF" size={32} />
                            </View>
                            <Text className="text-[#F9FAFB] font-bold text-sm tracking-wide">Tap to Open Camera</Text>
                            <Text className="text-[#6B7280] mt-2 text-xs font-medium">Attach one or more photos if available.</Text>
                        </TouchableOpacity>
                    ) : (
                        <View className="flex-row flex-wrap gap-3">
                            {photos.map((uri, index) => (
                                <View key={`${uri}-${index}`} className="relative w-[31%] aspect-square rounded-xl overflow-hidden border border-white/10">
                                    <Image source={{ uri }} className="w-full h-full" />
                                    <TouchableOpacity
                                        onPress={() => setPhotos((prev) => prev.filter((_, i) => i !== index))}
                                        className="absolute top-1 right-1 w-6 h-6 rounded-full bg-black/70 items-center justify-center"
                                    >
                                        <X color="#fff" size={14} />
                                    </TouchableOpacity>
                                </View>
                            ))}
                        </View>
                    )}
                </GlassCard>

                <GlassCard className="mb-8">
                    <Text className="text-[#6B7280] font-black uppercase tracking-widest text-[10px] mb-3">Description (Required)</Text>
                    <TextInput
                        className="bg-black/20 text-[#F9FAFB] p-5 rounded-2xl border border-white/5 text-sm font-medium leading-relaxed h-32"
                        multiline
                        textAlignVertical="top"
                        placeholder="Describe the damage..."
                        placeholderTextColor="#6B7280"
                        value={description}
                        onChangeText={setDescription}
                    />
                </GlassCard>

                <TouchableOpacity
                    disabled={loading}
                    onPress={handleSubmit}
                    className="bg-[#EF4444] py-4 rounded-xl flex-row justify-center items-center shadow-lg shadow-red-500/30"
                >
                    {loading ? <ActivityIndicator color="#fff" /> : <AlertTriangle color="#fff" size={20} />}
                    <Text className="text-white font-black tracking-widest text-sm uppercase ml-2.5">CONFIRM SUBMIT</Text>
                </TouchableOpacity>
            </ScrollView>
        </View>
    );
}
