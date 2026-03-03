import React from 'react';
import { StyleSheet, ScrollView, View, TouchableOpacity, Image } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { IconSymbol } from '@/components/ui/icon-symbol';

export default function ProfileScreen() {
    const router = useRouter();

    const handleLogout = () => {
        router.replace('/login');
    };

    return (
        <>
            <LinearGradient colors={['#1a1a2e', '#16213e']} style={styles.background} />
            <ScrollView contentContainerStyle={styles.container}>
                <ThemedView style={styles.profileHeader}>
                    <View style={styles.avatar}>
                        <IconSymbol name="person.fill" size={50} color="#fff" />
                    </View>
                    <ThemedText style={styles.name}>Abdullah Driver</ThemedText>
                    <ThemedText style={styles.phone}>+966 50 123 4567</ThemedText>
                </ThemedView>

                <ThemedView style={styles.menu}>
                    <TouchableOpacity style={styles.menuItem}>
                        <IconSymbol name="lock.fill" size={20} color="#6366f1" />
                        <ThemedText style={styles.menuText}>Change Password</ThemedText>
                        <ThemedText style={styles.arrow}>›</ThemedText>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.menuItem}>
                        <IconSymbol name="globe" size={20} color="#6366f1" />
                        <ThemedText style={styles.menuText}>Language: English</ThemedText>
                        <ThemedText style={styles.arrow}>›</ThemedText>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.menuItem}>
                        <IconSymbol name="info.circle.fill" size={20} color="#6366f1" />
                        <ThemedText style={styles.menuText}>About sezar drive</ThemedText>
                        <ThemedText style={styles.arrow}>›</ThemedText>
                    </TouchableOpacity>
                </ThemedView>

                <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
                    <ThemedText style={styles.logoutText}>Sign Out</ThemedText>
                </TouchableOpacity>
            </ScrollView>
        </>
    );
}

const styles = StyleSheet.create({
    background: { position: 'absolute', left: 0, right: 0, top: 0, height: '100%' },
    container: { padding: 20, paddingTop: 60 },
    profileHeader: { alignItems: 'center', backgroundColor: 'transparent', marginBottom: 40 },
    avatar: { width: 100, height: 100, borderRadius: 50, backgroundColor: 'rgba(99, 102, 241, 0.4)', justifyContent: 'center', alignItems: 'center', marginBottom: 15, borderWidth: 2, borderColor: '#6366f1' },
    name: { fontSize: 24, fontWeight: 'bold', color: '#fff' },
    phone: { fontSize: 14, color: '#a0aec0', marginTop: 5 },
    menu: { backgroundColor: 'rgba(255, 255, 255, 0.05)', borderRadius: 20, overflow: 'hidden' },
    menuItem: { flexDirection: 'row', alignItems: 'center', padding: 20, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.05)' },
    menuText: { flex: 1, color: '#fff', marginLeft: 15, fontSize: 16 },
    arrow: { color: 'rgba(255,255,255,0.3)', fontSize: 24 },
    logoutButton: { marginTop: 30, padding: 18, borderRadius: 15, alignItems: 'center', backgroundColor: 'rgba(239, 68, 68, 0.1)', borderWidth: 1, borderColor: 'rgba(239, 68, 68, 0.2)' },
    logoutText: { color: '#ef4444', fontWeight: 'bold', fontSize: 16 },
});
