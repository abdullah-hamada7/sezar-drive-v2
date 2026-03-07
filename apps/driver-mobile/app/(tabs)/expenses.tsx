import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, ScrollView, RefreshControl, TouchableOpacity, TextInput, ActivityIndicator } from 'react-native';
import { Receipt, Camera, Plus, CheckCircle, AlertCircle } from 'lucide-react-native';
import { expenseService } from '../../services/expense.service';
import { useShift } from '../../contexts/ShiftContext';
import { useToast } from '../../contexts/ToastContext';
import PhotoCapture from '../../components/PhotoCapture';
import TechnicalBackground from '../../components/TechnicalBackground';
import { GlassCard } from '../../components/GlassCard';
import { realtime } from '../../services/realtime.service';

export default function ExpensesScreen() {
    const { activeShift: shift } = useShift();
    const { addToast } = useToast();

    const [expenses, setExpenses] = useState<any[]>([]);
    const [categories, setCategories] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [isFormVisible, setIsFormVisible] = useState(false);
    const [showCamera, setShowCamera] = useState(false);

    const [form, setForm] = useState({
        categoryId: '',
        amount: '',
        description: '',
        receiptUri: null as string | null
    });

    const loadData = useCallback(async () => {
        setLoading(true);
        try {
            const [expensesRes, categoriesRes] = await Promise.all([
                expenseService.getRecent(),
                expenseService.getCategories()
            ]);
            setExpenses(expensesRes.data.expenses || expensesRes.data.data || []);
            setCategories(categoriesRes.data || []);
        } catch (err: any) {
            console.error(err);
            addToast('Failed to load data', 'error');
        } finally {
            setLoading(false);
        }
    }, [addToast]);

    useEffect(() => {
        loadData();
        const unsubscribe = realtime.subscribe((message) => {
            const messageType = message?.type;
            if (typeof messageType === 'string' && ['expense_pending', 'expense_reviewed', 'trip_completed', 'shift_closed'].includes(messageType)) {
                loadData();
            }
        });
        return unsubscribe;
    }, [loadData]);

    const handleSubmit = async () => {
        if (!shift) {
            addToast('No active shift', 'error');
            return;
        }
        if (!form.categoryId || !form.amount) {
            addToast('Please fill out all required fields', 'error');
            return;
        }

        setSubmitting(true);
        try {
            const payload: any = {
                shiftId: shift.id,
                categoryId: form.categoryId,
                amount: parseFloat(form.amount),
                description: form.description
            };

            if (form.receiptUri) {
                payload.receipt = {
                    uri: form.receiptUri,
                    name: 'receipt.jpg',
                    type: 'image/jpeg'
                };
            }

            await expenseService.create(payload);

            addToast('Expense submitted successfully', 'success');
            setIsFormVisible(false);
            setForm({ categoryId: '', amount: '', description: '', receiptUri: null });
            loadData();
        } catch (err: any) {
            addToast(err?.response?.data?.error?.message || err?.message || 'Failed to submit expense', 'error');
        } finally {
            setSubmitting(false);
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
                        <Text className="text-[#9CA3AF] text-center font-medium">Start a shift to submit and track expenses.</Text>
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
                        title="Capture Receipt"
                        onCapture={(uri) => {
                            setForm(prev => ({ ...prev, receiptUri: uri }));
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
            <ScrollView
                contentContainerStyle={{ padding: 24, paddingTop: 64, paddingBottom: 100 }}
                refreshControl={<RefreshControl refreshing={loading} onRefresh={loadData} tintColor="#3B82F6" />}
            >
                <View className="flex-row items-center justify-between mb-8">
                    <Text className="text-3xl font-black text-white tracking-widest text-shadow-sm shadow-blue-500/20">EXPENSES</Text>
                    {!isFormVisible && (
                        <TouchableOpacity
                            onPress={() => setIsFormVisible(true)}
                            className="bg-[#3B82F6] w-12 h-12 rounded-full items-center justify-center shadow-lg shadow-blue-500/30"
                        >
                            <Plus color="#fff" size={24} />
                        </TouchableOpacity>
                    )}
                </View>

                {isFormVisible ? (
                    <GlassCard className="mb-8">
                        <Text className="text-[#6B7280] font-black uppercase tracking-widest text-[10px] mb-4">New Expense Registration</Text>

                        <View className="flex-row flex-wrap gap-2.5 mb-6">
                            {categories.map(cat => (
                                <TouchableOpacity
                                    key={cat.id}
                                    onPress={() => setForm({ ...form, categoryId: cat.id })}
                                    className={`px-4 py-2.5 rounded-xl border ${form.categoryId === cat.id ? 'bg-[#3B82F6]/10 border-[#3B82F6]' : 'bg-black/20 border-white/5'}`}
                                >
                                    <Text className={`font-bold text-xs tracking-wide ${form.categoryId === cat.id ? 'text-[#3B82F6]' : 'text-[#9CA3AF]'}`}>{cat.name}</Text>
                                </TouchableOpacity>
                            ))}
                        </View>

                        <View className="mb-5">
                            <Text className="text-[#6B7280] font-bold mb-2 text-[10px] tracking-widest uppercase">Amount (SAR)</Text>
                            <TextInput
                                className="bg-black/20 text-[#F9FAFB] p-4 rounded-xl border border-white/5 font-black text-xl"
                                keyboardType="decimal-pad"
                                placeholder="0.00"
                                placeholderTextColor="#6B7280"
                                value={form.amount}
                                onChangeText={val => setForm({ ...form, amount: val })}
                            />
                        </View>

                        <View className="mb-6">
                            <Text className="text-[#6B7280] font-bold mb-2 text-[10px] tracking-widest uppercase">Description</Text>
                            <TextInput
                                className="bg-black/20 text-[#F9FAFB] p-4 rounded-xl border border-white/5 h-24 font-medium text-sm leading-relaxed"
                                multiline
                                textAlignVertical="top"
                                placeholder="Add any notes..."
                                placeholderTextColor="#6B7280"
                                value={form.description}
                                onChangeText={val => setForm({ ...form, description: val })}
                            />
                        </View>

                        <TouchableOpacity
                            onPress={() => setShowCamera(true)}
                            className={`p-4 rounded-xl items-center justify-center mb-8 border border-dashed flex-row gap-3 ${form.receiptUri ? 'border-[#10B981] bg-[#10B981]/10' : 'border-white/10 bg-black/20'}`}
                        >
                            {form.receiptUri ? (
                                <>
                                    <CheckCircle color="#10B981" size={20} />
                                    <Text className="text-[#10B981] font-bold text-sm tracking-wide">Receipt Attached</Text>
                                </>
                            ) : (
                                <>
                                    <Camera color="#9CA3AF" size={20} />
                                    <Text className="text-[#9CA3AF] font-bold text-sm tracking-wide">Attach Receipt (Optional)</Text>
                                </>
                            )}
                        </TouchableOpacity>

                        <View className="flex-row gap-4">
                            <TouchableOpacity
                                disabled={submitting}
                                onPress={() => setIsFormVisible(false)}
                                className="flex-1 p-3.5 rounded-xl border border-white/10 items-center justify-center bg-black/20"
                            >
                                <Text className="text-[#F9FAFB] font-bold text-sm tracking-widest uppercase">Cancel</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                disabled={submitting}
                                onPress={handleSubmit}
                                className="flex-1 p-3.5 rounded-xl bg-[#3B82F6] items-center justify-center shadow-lg shadow-blue-500/30"
                            >
                                {submitting ? <ActivityIndicator color="#fff" /> : <Text className="text-[#F9FAFB] font-bold text-sm tracking-widest uppercase">Submit</Text>}
                            </TouchableOpacity>
                        </View>
                    </GlassCard>
                ) : expenses.length === 0 ? (
                    <GlassCard className="items-center justify-center py-12">
                        <View className="bg-white/5 p-4 rounded-full mb-4 border border-white/10">
                            <Receipt size={32} color="#9CA3AF" />
                        </View>
                        <Text className="text-[#9CA3AF] font-medium tracking-wide text-sm uppercase">No recent expenses.</Text>
                    </GlassCard>
                ) : (
                    <View className="gap-4">
                        <Text className="text-[#6B7280] font-black uppercase tracking-widest text-[10px] mb-1">Recent Logs</Text>
                        {expenses.map((exp: any, i: number) => (
                            <GlassCard key={i} className="p-4 flex-row items-center">
                                <View className="bg-[#3B82F6]/10 p-3 rounded-xl border border-[#3B82F6]/20 mr-4">
                                    <Receipt color="#3B82F6" size={20} />
                                </View>
                                <View className="flex-1">
                                    <Text className="text-[#F9FAFB] font-bold text-base mb-0.5">{exp.category?.name || 'Other'}</Text>
                                    <Text className="text-[#6B7280] text-xs font-medium tracking-wide uppercase">{new Date(exp.createdAt).toLocaleDateString()}</Text>
                                </View>
                                <View className="items-end">
                                    <Text className="text-[#3B82F6] font-black text-lg">{exp.amount} SAR</Text>
                                    <Text className={`text-[10px] font-bold uppercase ${exp.status === 'approved' ? 'text-green-500' : exp.status === 'pending' ? 'text-orange-500' : 'text-red-500'}`}>
                                        {exp.status}
                                    </Text>
                                </View>
                            </GlassCard>
                        ))}
                    </View>
                )}
            </ScrollView>
        </View>
    );
}
