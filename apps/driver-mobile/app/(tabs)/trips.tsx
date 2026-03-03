import React from 'react';
import { StyleSheet, ScrollView, View, TouchableOpacity } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { IconSymbol } from '@/components/ui/icon-symbol';

export default function TripsScreen() {
  const dummyTrips = [
    { id: '1', date: 'Oct 24, 2026', time: '10:30 AM', price: '45.00', status: 'Completed', route: 'Airport → Downtown' },
    { id: '2', date: 'Oct 24, 2026', time: '01:15 PM', price: '32.50', status: 'Completed', route: 'Main St → Hospital' },
  ];

  return (
    <>
      <LinearGradient colors={['#1a1a2e', '#16213e']} style={styles.background} />
      <ScrollView contentContainerStyle={styles.container}>
        <ThemedText style={styles.header}>Trip History</ThemedText>

        {dummyTrips.map(trip => (
          <ThemedView key={trip.id} style={styles.tripCard}>
            <View style={styles.cardHeader}>
              <ThemedText style={styles.cardDate}>{trip.date} • {trip.time}</ThemedText>
              <ThemedText style={styles.cardPrice}>{trip.price} SAR</ThemedText>
            </View>
            <ThemedText style={styles.cardRoute}>{trip.route}</ThemedText>
            <ThemedView style={styles.badge}>
              <ThemedText style={styles.badgeText}>{trip.status}</ThemedText>
            </ThemedView>
          </ThemedView>
        ))}

        {dummyTrips.length === 0 && (
          <ThemedView style={styles.empty}>
            <IconSymbol name="paperplane.fill" size={60} color="rgba(255,255,255,0.1)" />
            <ThemedText style={styles.emptyText}>No trips recorded yet.</ThemedText>
          </ThemedView>
        )}
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  background: { position: 'absolute', left: 0, right: 0, top: 0, height: '100%' },
  container: { padding: 20, paddingTop: 60 },
  header: { fontSize: 24, fontWeight: 'bold', color: '#fff', marginBottom: 20 },
  tripCard: { backgroundColor: 'rgba(255, 255, 255, 0.05)', borderRadius: 15, padding: 15, marginBottom: 15, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 5 },
  cardDate: { color: '#a0aec0', fontSize: 13 },
  cardPrice: { color: '#10b981', fontWeight: 'bold', fontSize: 16 },
  cardRoute: { color: '#fff', fontSize: 16, fontWeight: '600', marginVertical: 8 },
  badge: { backgroundColor: 'rgba(16, 185, 129, 0.1)', alignSelf: 'flex-start', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 5 },
  badgeText: { color: '#10b981', fontSize: 11, fontWeight: 'bold' },
  empty: { alignItems: 'center', marginTop: 100, backgroundColor: 'transparent' },
  emptyText: { color: '#a0aec0', marginTop: 15 },
});
