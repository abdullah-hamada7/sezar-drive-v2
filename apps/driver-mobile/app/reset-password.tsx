import { useState } from 'react';
import { StyleSheet, TextInput, TouchableOpacity, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Stack, useRouter } from 'expo-router';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';

export default function ResetPasswordScreen() {
    const [email, setEmail] = useState('');
    const [loading, setLoading] = useState(false);
    const router = useRouter();

    const handleResetRequest = () => {
        if (!email) return;
        setLoading(true);
        // Logic for sending reset link will go here
        console.log('Reset link requested for:', email);
        setTimeout(() => setLoading(false), 2000);
    };

    return (
        <>
            <Stack.Screen options={{ headerShown: false }} />
            <LinearGradient
                colors={['#1a1a2e', '#16213e']}
                style={styles.background}
            />
            <KeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                style={styles.container}
            >
                <ScrollView contentContainerStyle={styles.scrollContent}>
                    <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
                        <ThemedText style={styles.backButtonText}>← Back</ThemedText>
                    </TouchableOpacity>

                    <ThemedView style={styles.logoContainer}>
                        <ThemedText style={styles.title}>RESET</ThemedText>
                        <ThemedText style={styles.subtitle}>Password Recovery</ThemedText>
                    </ThemedView>

                    <ThemedView style={styles.formCard}>
                        <ThemedText style={styles.label}>Enter your email address</ThemedText>
                        <TextInput
                            style={styles.input}
                            placeholder="driver@sezar.com"
                            placeholderTextColor="#666"
                            value={email}
                            onChangeText={setEmail}
                            keyboardType="email-address"
                            autoCapitalize="none"
                        />

                        <TouchableOpacity style={styles.resetButton} onPress={handleResetRequest} disabled={loading}>
                            <ThemedText style={styles.resetButtonText}>
                                {loading ? 'Sending...' : 'Send Reset Link'}
                            </ThemedText>
                        </TouchableOpacity>
                    </ThemedView>
                </ScrollView>
            </KeyboardAvoidingView>
        </>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    background: { position: 'absolute', left: 0, right: 0, top: 0, height: '100%' },
    scrollContent: { flexGrow: 1, justifyContent: 'center', padding: 20 },
    backButton: { marginBottom: 20 },
    backButtonText: { color: '#6366f1', fontSize: 16, fontWeight: '600' },
    logoContainer: { alignItems: 'center', marginBottom: 40, backgroundColor: 'transparent' },
    title: { fontSize: 40, fontWeight: '900', color: '#fff', letterSpacing: 2 },
    subtitle: { fontSize: 14, color: '#6366f1', marginTop: 5, letterSpacing: 1, fontWeight: '500' },
    formCard: { backgroundColor: 'rgba(255, 255, 255, 0.05)', borderRadius: 20, padding: 25, borderWidth: 1, borderColor: 'rgba(255, 255, 255, 0.08)' },
    label: { color: '#a0aec0', fontSize: 14, marginBottom: 12, fontWeight: '500' },
    input: { backgroundColor: 'rgba(0, 0, 0, 0.2)', borderRadius: 12, padding: 15, color: '#fff', fontSize: 16, borderWidth: 1, borderColor: 'rgba(255, 255, 255, 0.1)', marginBottom: 20 },
    resetButton: { backgroundColor: '#6366f1', borderRadius: 12, padding: 16, alignItems: 'center' },
    resetButtonText: { color: '#fff', fontSize: 18, fontWeight: 'bold' },
});
