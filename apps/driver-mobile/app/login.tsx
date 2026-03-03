import { useState } from 'react';
import { StyleSheet, TextInput, TouchableOpacity, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Stack, useRouter } from 'expo-router';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';

export default function LoginScreen() {
    const [phone, setPhone] = useState('');
    const [password, setPassword] = useState('');
    const router = useRouter();

    const handleLogin = () => {
        // Auth logic will go here
        console.log('Login attempt:', phone);
        // router.replace('/(tabs)');
    };

    return (
        <>
            <Stack.Screen options={{ headerShown: false }} />
            <LinearGradient
                colors={['#1F1D1B', '#141311', '#0B0A0A']}
                style={styles.background}
            />
            <KeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                style={styles.container}
            >
                <ScrollView contentContainerStyle={styles.scrollContent}>
                    <ThemedView style={styles.logoContainer}>
                        <ThemedText style={styles.title}>SEZAR DRIVE</ThemedText>
                        <ThemedText style={styles.subtitle}>Tactile Driver Portal</ThemedText>
                    </ThemedView>

                    <ThemedView style={styles.formCard}>
                        <ThemedText style={styles.formTitle}>Terminal Access</ThemedText>

                        <ThemedView style={styles.inputContainer}>
                            <ThemedText style={styles.label}>Identification (Phone)</ThemedText>
                            <TextInput
                                style={styles.input}
                                placeholder="+966..."
                                placeholderTextColor="#8A867D"
                                value={phone}
                                onChangeText={setPhone}
                                keyboardType="phone-pad"
                                autoCapitalize="none"
                            />
                        </ThemedView>

                        <ThemedView style={styles.inputContainer}>
                            <ThemedText style={styles.label}>Access Code</ThemedText>
                            <TextInput
                                style={styles.input}
                                placeholder="••••••••"
                                placeholderTextColor="#8A867D"
                                value={password}
                                onChangeText={setPassword}
                                secureTextEntry
                            />
                        </ThemedView>

                        <TouchableOpacity style={styles.loginButton} onPress={handleLogin} activeOpacity={0.8}>
                            <LinearGradient
                                colors={['#D46340', '#B54D2E']}
                                style={styles.buttonGradient}
                            >
                                <ThemedText style={styles.loginButtonText}>Engage Shift</ThemedText>
                            </LinearGradient>
                        </TouchableOpacity>
                    </ThemedView>
                </ScrollView>
            </KeyboardAvoidingView>
        </>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    background: {
        position: 'absolute',
        left: 0,
        right: 0,
        top: 0,
        height: '100%',
    },
    scrollContent: {
        flexGrow: 1,
        justifyContent: 'center',
        padding: 24,
    },
    logoContainer: {
        alignItems: 'center',
        marginBottom: 48,
        backgroundColor: 'transparent',
    },
    title: {
        fontSize: 36,
        fontWeight: '900',
        color: '#F7F3EB',
        letterSpacing: 3,
        textShadowColor: 'rgba(212, 99, 64, 0.4)',
        textShadowOffset: { width: 0, height: 4 },
        textShadowRadius: 10,
    },
    subtitle: {
        fontSize: 14,
        color: '#C5A880',
        marginTop: 8,
        letterSpacing: 2,
        fontWeight: '600',
        textTransform: 'uppercase',
    },
    formCard: {
        backgroundColor: 'rgba(20, 19, 17, 0.85)',
        borderRadius: 24,
        padding: 30,
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.05)',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 20 },
        shadowOpacity: 0.5,
        shadowRadius: 30,
        elevation: 15,
    },
    formTitle: {
        fontSize: 20,
        fontWeight: '800',
        color: '#F7F3EB',
        marginBottom: 30,
        textAlign: 'center',
        letterSpacing: 1,
        textTransform: 'uppercase',
    },
    inputContainer: {
        marginBottom: 24,
        backgroundColor: 'transparent',
    },
    label: {
        color: '#8A867D',
        fontSize: 13,
        marginBottom: 10,
        fontWeight: '700',
        letterSpacing: 1,
        textTransform: 'uppercase',
    },
    input: {
        backgroundColor: 'rgba(255, 255, 255, 0.03)',
        borderRadius: 16,
        padding: 18,
        color: '#F7F3EB',
        fontSize: 16,
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.08)',
        fontWeight: '500',
    },
    loginButton: {
        borderRadius: 16,
        overflow: 'hidden',
        marginTop: 16,
        shadowColor: '#D46340',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.4,
        shadowRadius: 12,
        elevation: 8,
    },
    buttonGradient: {
        padding: 18,
        alignItems: 'center',
        justifyContent: 'center',
    },
    loginButtonText: {
        color: '#F7F3EB',
        fontSize: 17,
        fontWeight: '800',
        letterSpacing: 1,
        textTransform: 'uppercase',
    },
});
