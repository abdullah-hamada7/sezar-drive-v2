import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, ScrollView, TouchableOpacity, TextInput, ActivityIndicator, Image } from 'react-native';
import { Camera, CheckCircle, ChevronRight, AlertCircle } from 'lucide-react-native';
import { inspectionService } from '../../services/inspection.service';
import { useShift } from '../../contexts/ShiftContext';
import { useToast } from '../../contexts/ToastContext';
import { realtime } from '../../services/realtime.service';
import PhotoCapture from '../../components/PhotoCapture';
import TechnicalBackground from '../../components/TechnicalBackground';
import { GlassCard } from '../../components/GlassCard';

const DIRECTIONS = ['front', 'back', 'left', 'right'];
const CHECKLIST_KEYS = ['tires', 'lights', 'brakes', 'mirrors', 'fluids', 'seatbelts', 'horn', 'wipers'];

export default function InspectionScreen() {
    const { activeShift: shift } = useShift();
    const { addToast } = useToast();

    const [step, setStep] = useState<'checklist' | 'photos' | 'review' | 'done'>('checklist');
    const [checks, setChecks] = useState<Record<string, boolean>>(() =>
        CHECKLIST_KEYS.reduce((acc, key) => ({ ...acc, [key]: false }), {})
    );
    const [notes, setNotes] = useState('');
    const [photos, setPhotos] = useState<Record<string, string>>({});
    const [inspectionId, setInspectionId] = useState<number | null>(null);
    const [loading, setLoading] = useState(false);
    const [currentDirection, setCurrentDirection] = useState<string | null>(null);
    const [existingInspections, setExistingInspections] = useState<any[]>([]);

    const inspectionType = shift?.status === 'PendingVerification' ? 'pre' : 'post';

    const loadExistingInspections = useCallback(async () => {
        if (!shift?.id) {
            setExistingInspections([]);
            return;
        }
        try {
            const res = await inspectionService.getInspections(`shiftId=${shift.id}`);
            setExistingInspections(Array.isArray(res?.data) ? res.data : []);
        } catch {
            setExistingInspections([]);
        }
    }, [shift?.id]);

    useEffect(() => {
        loadExistingInspections();
    }, [loadExistingInspections]);

    useEffect(() => {
        const unsubscribe = realtime.subscribe((message) => {
            const messageType = message?.type;
            if (typeof messageType === 'string' && ['shift_activated', 'shift_closed', 'trip_completed'].includes(messageType)) {
                loadExistingInspections();
            }
        });
        return unsubscribe;
    }, [loadExistingInspections]);

    const isCompletedInspection = (inspection: any) => {
        const photoCount = Array.isArray(inspection?.photos) ? inspection.photos.length : 0;
        return inspection?.status === 'completed' && photoCount >= 4;
    };

    const hasPreInspection = existingInspections.some((inspection) => {
        const type = String(inspection?.type || '').toLowerCase();
        return isCompletedInspection(inspection) && ['pre', 'before', 'pre_shift'].includes(type);
    });

    const hasPostInspection = existingInspections.some((inspection) => {
        const type = String(inspection?.type || '').toLowerCase();
        if (!isCompletedInspection(inspection)) return false;
        if (!['post', 'after', 'post_shift', 'full'].includes(type)) return false;
        if (!shift?.startedAt || !inspection?.createdAt) return true;
        return new Date(inspection.createdAt) > new Date(shift.startedAt);
    });

    const isInspectionLocked = inspectionType === 'pre' ? hasPreInspection : hasPostInspection;

    const toggleCheck = (key: string) => {
        setChecks(prev => ({ ...prev, [key]: !prev[key] }));
    };

    const submitChecklist = async () => {
        if (!shift) {
            addToast('No active shift to inspect for.', 'error');
            return;
        }
        if (isInspectionLocked) {
            addToast('This inspection is already completed for the current phase.', 'warning');
            return;
        }
        const vehicleId = shift.vehicleId || shift.vehicle?.id || shift.assignments?.[0]?.vehicleId;
        if (!vehicleId) {
            addToast('No vehicle assigned.', 'error');
            return;
        }
        setLoading(true);
        try {
            const res = await inspectionService.createInspection({
                shiftId: shift.id,
                vehicleId,
                type: inspectionType,
                notes
            });
            const createdId = res?.data?.data?.id || res?.data?.id;
            if (createdId) {
                setInspectionId(createdId);
                setStep('photos');
            } else {
                setInspectionId(Date.now()); // fallback
                setStep('photos');
            }
        } catch (err: any) {
            addToast(err?.message || 'Failed to submit checklist', 'error');
        } finally {
            setLoading(false);
        }
    };

    const handlePhotoCapture = async (photoUri: string) => {
        if (!currentDirection) return;
        setPhotos(prev => ({ ...prev, [currentDirection]: photoUri }));
        setCurrentDirection(null);
    };

    const completeInspection = async () => {
        if (Object.keys(photos).length < 4) {
            addToast('Please take all 4 photos.', 'error');
            return;
        }
        setLoading(true);
        try {
            if (inspectionId) {
                const directions = Object.keys(photos);
                for (const direction of directions) {
                    const uri = photos[direction];
                    const formData: any = new FormData();
                    formData.append('photo', {
                        uri,
                        name: `${direction}.jpg`,
                        type: 'image/jpeg'
                    });
                    await inspectionService.uploadInspectionPhoto(inspectionId, direction, formData);
                }

                await inspectionService.completeInspection(inspectionId, { checklistData: { checks, notes } });
            }

            setStep('done');
            addToast('Inspection completed successfully', 'success');
            await loadExistingInspections();
        } catch (err: any) {
            addToast(err?.message || 'Failed to complete inspection', 'error');
        } finally {
            setLoading(false);
        }
    };

    if (!shift) {
        return (
            <View className="flex-1 bg-[#030712]">
                <TechnicalBackground />
                <View className="flex-1 p-6 pt-16 items-center justify-center">
                    <GlassCard className="items-center py-10 w-full">
                        <AlertCircle size={64} color="#3B82F6" className="mb-6 opacity-80" />
                        <Text className="text-white text-2xl font-black tracking-widest mb-2 uppercase">No Active Shift</Text>
                        <Text className="text-[#9CA3AF] text-center font-medium">Start a shift before completing vehicle inspections.</Text>
                    </GlassCard>
                </View>
            </View>
        );
    }

    if (currentDirection) {
        return (
            <View className="flex-1 bg-[#030712]">
                <TechnicalBackground />
                <View className="p-6 pt-16 flex-1">
                    <PhotoCapture
                        title={`Capture ${currentDirection} side`}
                        onCapture={handlePhotoCapture}
                        onCancel={() => setCurrentDirection(null)}
                    />
                </View>
            </View>
        );
    }

    if (step === 'done') {
        return (
            <View className="flex-1 bg-[#030712]">
                <TechnicalBackground />
                <View className="flex-1 p-6 pt-16 items-center justify-center">
                    <GlassCard className="items-center py-10 w-full" style={{ borderColor: 'rgba(16, 185, 129, 0.3)' }}>
                        <View className="absolute top-0 left-0 right-0 h-[2px] bg-[#10B981] opacity-80" />
                        <View className="w-20 h-20 bg-green-500/10 rounded-full border border-green-500/30 items-center justify-center mb-6">
                            <CheckCircle size={40} color="#10B981" />
                        </View>
                        <Text className="text-[#F9FAFB] text-xl font-black tracking-widest uppercase mb-2">Inspection Complete</Text>
                        <Text className="text-[#9CA3AF] text-center font-medium">Your vehicle inspection has been securely recorded.</Text>
                    </GlassCard>
                </View>
            </View>
        );
    }

    return (
        <View className="flex-1 bg-[#030712]">
            <TechnicalBackground />
            <ScrollView contentContainerStyle={{ padding: 24, paddingTop: 64, paddingBottom: 100 }}>
                <Text className="text-3xl font-black text-white tracking-widest mb-8 text-shadow-sm shadow-blue-500/20">INSPECTION</Text>

                <View className="flex-row items-center gap-2 mb-8">
                    <View className={`h-1.5 flex-1 rounded-full ${step === 'checklist' || step === 'photos' || step === 'review' ? 'bg-[#3B82F6]' : 'bg-white/10'}`} />
                    <View className={`h-1.5 flex-1 rounded-full ${step === 'photos' || step === 'review' ? 'bg-[#3B82F6]' : 'bg-white/10'}`} />
                    <View className={`h-1.5 flex-1 rounded-full ${step === 'review' ? 'bg-[#3B82F6]' : 'bg-white/10'}`} />
                </View>

                {step === 'checklist' && (
                    <GlassCard>
                        {isInspectionLocked && (
                            <View className="mb-4 bg-[#3B82F6]/10 border border-[#3B82F6]/30 rounded-xl px-4 py-3">
                                <Text className="text-[#93C5FD] text-xs font-semibold">Inspection already completed for this phase.</Text>
                            </View>
                        )}
                        <Text className="text-[#9CA3AF] mb-6 font-medium text-sm">Tap to check off components as you review them.</Text>
                        <View className="flex-row flex-wrap justify-between">
                            {CHECKLIST_KEYS.map(key => (
                                <TouchableOpacity
                                    key={key}
                                    onPress={() => toggleCheck(key)}
                                    disabled={isInspectionLocked}
                                    className={`w-[48%] py-3.5 px-4 rounded-xl border mb-4 flex-row items-center shadow-lg ${checks[key] ? 'bg-green-500/10 border-green-500/30 shadow-green-500/10' : 'bg-black/20 border-white/5'}`}
                                >
                                    <View className={`w-5 h-5 rounded-md border mr-3 items-center justify-center ${checks[key] ? 'bg-green-500 border-green-500' : 'border-[#6B7280]'}`}>
                                        {checks[key] && <CheckCircle size={14} color="#fff" />}
                                    </View>
                                    <Text className={`capitalize font-bold text-xs flex-1 ${checks[key] ? 'text-green-500' : 'text-[#F9FAFB]'}`}>{key}</Text>
                                </TouchableOpacity>
                            ))}
                        </View>

                        <View className="mt-4 mb-8">
                            <Text className="text-[#9CA3AF] mb-3 font-bold tracking-wider text-xs uppercase">Additional Notes</Text>
                            <TextInput
                                className="bg-black/20 text-[#F9FAFB] p-4 rounded-xl border border-white/5 h-28 font-medium"
                                multiline
                                placeholder="Any issues or damage to report?"
                                placeholderTextColor="#6B7280"
                                value={notes}
                                onChangeText={setNotes}
                                textAlignVertical="top"
                                editable={!isInspectionLocked}
                            />
                        </View>

                        <TouchableOpacity
                            disabled={loading || isInspectionLocked}
                            onPress={submitChecklist}
                            className={`py-3.5 rounded-xl flex-row justify-center items-center shadow-lg ${isInspectionLocked ? 'bg-[#1F2937] border border-white/10' : 'bg-[#3B82F6] shadow-blue-500/30'}`}
                        >
                            {loading ? <ActivityIndicator color="#fff" /> : <Text className={`font-bold tracking-widest uppercase text-sm mr-2 ${isInspectionLocked ? 'text-[#6B7280]' : 'text-[#F9FAFB]'}`}>Continue to Photos</Text>}
                            {!loading && <ChevronRight color={isInspectionLocked ? '#6B7280' : '#fff'} size={20} />}
                        </TouchableOpacity>
                    </GlassCard>
                )}

                {step === 'photos' && (
                    <GlassCard>
                        <Text className="text-[#9CA3AF] mb-6 text-sm font-medium">Capture clear photos of the vehicle from all 4 sides.</Text>
                        <View className="flex-row flex-wrap justify-between gap-y-4 mb-8">
                            {DIRECTIONS.map(dir => (
                                <TouchableOpacity
                                    key={dir}
                                    onPress={() => setCurrentDirection(dir)}
                                    className={`w-[48%] aspect-square rounded-2xl border items-center justify-center overflow-hidden ${photos[dir] ? 'border-[#10B981] bg-transparent' : 'border-white/10 bg-black/20'}`}
                                >
                                    {photos[dir] ? (
                                        <Image source={{ uri: photos[dir] }} className="w-full h-full" />
                                    ) : (
                                        <>
                                            <Camera color="#6B7280" size={32} className="mb-3" />
                                            <Text className="text-[#9CA3AF] font-bold uppercase tracking-widest text-[10px]">{dir}</Text>
                                        </>
                                    )}
                                </TouchableOpacity>
                            ))}
                        </View>

                        <TouchableOpacity
                            disabled={Object.keys(photos).length < 4}
                            onPress={() => setStep('review')}
                            className={`py-3.5 rounded-xl flex-row justify-center items-center shadow-lg ${Object.keys(photos).length < 4 ? 'bg-[#1F2937] border border-white/5' : 'bg-[#3B82F6] shadow-blue-500/30'}`}
                        >
                            <Text className={`font-bold tracking-widest uppercase text-sm mr-2 ${Object.keys(photos).length < 4 ? 'text-[#6B7280]' : 'text-[#F9FAFB]'}`}>Review Inspection</Text>
                            <ChevronRight color={Object.keys(photos).length < 4 ? '#6B7280' : '#fff'} size={20} />
                        </TouchableOpacity>
                    </GlassCard>
                )}

                {step === 'review' && (
                    <GlassCard>
                        <Text className="text-[#9CA3AF] mb-6 text-sm font-medium">Review your inspection criteria before final submission.</Text>

                        <View className="bg-black/20 rounded-xl border border-white/5 p-5 mb-6 gap-4">
                            <Text className="text-[#6B7280] font-bold uppercase tracking-widest text-[10px] mb-1">Checklist Audit</Text>
                            {CHECKLIST_KEYS.map(key => (
                                <View key={key} className="flex-row justify-between items-center border-b border-white/5 pb-2">
                                    <Text className="text-[#9CA3AF] capitalize text-sm font-medium">{key}</Text>
                                    <Text className={`text-xs tracking-wider uppercase font-black ${checks[key] ? 'text-[#10B981]' : 'text-[#EF4444]'}`}>{checks[key] ? 'PASS' : 'FAIL'}</Text>
                                </View>
                            ))}
                        </View>

                        <View className="bg-black/20 rounded-xl border border-white/5 p-5 mb-8 gap-4">
                            <Text className="text-[#6B7280] font-bold uppercase tracking-widest text-[10px] mb-1">Visual Evidence</Text>
                            {DIRECTIONS.map(dir => (
                                <View key={dir} className="flex-row justify-between items-center border-b border-white/5 pb-2">
                                    <Text className="text-[#9CA3AF] capitalize text-sm font-medium">{dir}</Text>
                                    <Text className={`text-xs tracking-wider uppercase font-black ${photos[dir] ? 'text-[#10B981]' : 'text-[#EF4444]'}`}>{photos[dir] ? 'UPLOADED' : 'MISSING'}</Text>
                                </View>
                            ))}
                        </View>

                        <TouchableOpacity
                            disabled={loading}
                            onPress={completeInspection}
                            className="bg-[#10B981] py-3.5 rounded-xl flex-row justify-center items-center shadow-lg shadow-green-500/30"
                        >
                            {loading ? <ActivityIndicator color="#fff" /> : <CheckCircle color="#fff" size={20} />}
                            <Text className="text-[#F9FAFB] font-bold tracking-widest text-sm uppercase ml-2">Submit Final Inspection</Text>
                        </TouchableOpacity>
                    </GlassCard>
                )}
            </ScrollView>
        </View>
    );
}
