import { useState } from 'react';
import { StyleSheet, TouchableOpacity, ScrollView, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { IconSymbol } from '@/components/ui/icon-symbol';

enum ShiftWorkflowState {
  IDLE = 'IDLE',
  QR_SCAN = 'QR_SCAN',
  FACE_MATCH = 'FACE_MATCH',
  INSPECTION = 'INSPECTION',
  ACTIVE = 'ACTIVE'
}

export default function ShiftScreen() {
  const [workflowState, setWorkflowState] = useState<ShiftWorkflowState>(ShiftWorkflowState.IDLE);

  const renderIdle = () => (
    <ThemedView style={styles.content}>
      <IconSymbol name="car.fill" size={80} color="#D46340" />
      <ThemedText style={styles.title}>Ready to Deploy?</ThemedText>
      <ThemedText style={styles.subtitle}>Initialize shift to access terminal.</ThemedText>

      <TouchableOpacity
        style={styles.primaryButton}
        onPress={() => setWorkflowState(ShiftWorkflowState.QR_SCAN)}
        activeOpacity={0.8}
      >
        <LinearGradient colors={['#D46340', '#B54D2E']} style={styles.buttonGradient}>
          <ThemedText style={styles.buttonText}>INITIALIZE SHIFT</ThemedText>
        </LinearGradient>
      </TouchableOpacity>
    </ThemedView>
  );

  const renderWorkflow = () => {
    switch (workflowState) {
      case ShiftWorkflowState.QR_SCAN:
        return (
          <ThemedView style={styles.content}>
            <ThemedText style={styles.title}>Scan Vehicle QR</ThemedText>
            <ThemedView style={styles.cameraPlaceholder}>
              <IconSymbol name="qrcode" size={100} color="rgba(255,255,255,0.3)" />
            </ThemedView>
            <TouchableOpacity style={styles.secondaryButton} onPress={() => setWorkflowState(ShiftWorkflowState.FACE_MATCH)}>
              <ThemedText style={styles.buttonText}>[Mock] Scan Successful</ThemedText>
            </TouchableOpacity>
          </ThemedView>
        );
      case ShiftWorkflowState.FACE_MATCH:
        return (
          <ThemedView style={styles.content}>
            <ThemedText style={styles.title}>Face Verification</ThemedText>
            <ThemedView style={[styles.cameraPlaceholder, { borderRadius: 100 }]}>
              <IconSymbol name="person.fill" size={100} color="rgba(255,255,255,0.3)" />
            </ThemedView>
            <TouchableOpacity style={styles.secondaryButton} onPress={() => setWorkflowState(ShiftWorkflowState.INSPECTION)}>
              <ThemedText style={styles.buttonText}>[Mock] Match Confirmed</ThemedText>
            </TouchableOpacity>
          </ThemedView>
        );
      case ShiftWorkflowState.INSPECTION:
        return (
          <ThemedView style={styles.content}>
            <ThemedText style={styles.title}>Vehicle Inspection</ThemedText>
            <ThemedText style={styles.subtitle}>Capture photos from 4 directions</ThemedText>
            <View style={styles.grid}>
              {[1, 2, 3, 4].map(i => (
                <View key={i} style={styles.photoBox}>
                  <IconSymbol name="camera.fill" size={24} color="#666" />
                </View>
              ))}
            </View>
            <TouchableOpacity style={styles.primaryButton} onPress={() => setWorkflowState(ShiftWorkflowState.ACTIVE)}>
              <ThemedText style={styles.buttonText}>SUBMIT INSPECTION</ThemedText>
            </TouchableOpacity>
          </ThemedView>
        );
      case ShiftWorkflowState.ACTIVE:
        return (
          <ThemedView style={styles.content}>
            <ThemedView style={styles.badge}>
              <ThemedText style={styles.badgeText}>ACTIVE SHIFT</ThemedText>
            </ThemedView>
            <ThemedText style={styles.title}>Vehicle: Toyota Camry</ThemedText>
            <ThemedText style={styles.subtitle}>Plate: ABC-1234</ThemedText>

            <ThemedView style={styles.statsRow}>
              <ThemedView style={styles.statBox}>
                <ThemedText style={styles.statVal}>0</ThemedText>
                <ThemedText style={styles.statLab}>Trips</ThemedText>
              </ThemedView>
              <ThemedView style={styles.statBox}>
                <ThemedText style={styles.statVal}>0.00</ThemedText>
                <ThemedText style={styles.statLab}>Earnings</ThemedText>
              </ThemedView>
            </ThemedView>

            <TouchableOpacity
              style={[styles.primaryButton, { backgroundColor: '#ef4444' }]}
              onPress={() => setWorkflowState(ShiftWorkflowState.IDLE)}
            >
              <ThemedText style={styles.buttonText}>END SHIFT</ThemedText>
            </TouchableOpacity>
          </ThemedView>
        );
      default: return renderIdle();
    }
  };

  return (
    <>
      <LinearGradient colors={['#1F1D1B', '#141311', '#0B0A0A']} style={styles.background} />
      <ScrollView contentContainerStyle={styles.container}>
        {renderWorkflow()}
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  background: { position: 'absolute', left: 0, right: 0, top: 0, height: '100%' },
  container: { flexGrow: 1, justifyContent: 'center', padding: 24 },
  content: { alignItems: 'center', backgroundColor: 'transparent' },
  title: { fontSize: 28, fontWeight: '900', color: '#F7F3EB', marginTop: 24, textAlign: 'center', letterSpacing: 1 },
  subtitle: { fontSize: 14, color: '#C5A880', marginTop: 8, textAlign: 'center', marginBottom: 40, textTransform: 'uppercase', letterSpacing: 2 },
  primaryButton: { borderRadius: 16, width: '100%', overflow: 'hidden', shadowColor: '#D46340', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.4, shadowRadius: 12, elevation: 8 },
  buttonGradient: { paddingVertical: 18, paddingHorizontal: 40, alignItems: 'center', justifyContent: 'center' },
  secondaryButton: { backgroundColor: 'rgba(20, 19, 17, 0.8)', paddingVertical: 18, paddingHorizontal: 30, borderRadius: 16, width: '100%', alignItems: 'center', marginTop: 24, borderWidth: 1, borderColor: '#4A5D4E' },
  buttonText: { color: '#F7F3EB', fontSize: 16, fontWeight: '800', letterSpacing: 1 },
  cameraPlaceholder: { width: 280, height: 280, backgroundColor: 'rgba(31, 29, 27, 0.8)', borderRadius: 24, borderStyle: 'dashed', borderWidth: 2, borderColor: '#4A5D4E', justifyContent: 'center', alignItems: 'center', marginBottom: 24, shadowColor: '#000', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.5, shadowRadius: 15 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 16, justifyContent: 'center', marginBottom: 40 },
  photoBox: { width: 110, height: 110, backgroundColor: 'rgba(31, 29, 27, 0.8)', borderRadius: 16, justifyContent: 'center', alignItems: 'center', borderStyle: 'dashed', borderWidth: 1, borderColor: '#C5A880' },
  badge: { backgroundColor: 'rgba(74, 93, 78, 0.2)', paddingHorizontal: 16, paddingVertical: 6, borderRadius: 100, marginBottom: 16, borderWidth: 1, borderColor: '#4A5D4E' },
  badgeText: { color: '#F7F3EB', fontWeight: '800', fontSize: 13, letterSpacing: 1.5 },
  statsRow: { flexDirection: 'row', gap: 16, marginVertical: 32, backgroundColor: 'transparent' },
  statBox: { backgroundColor: 'rgba(31, 29, 27, 0.9)', padding: 24, borderRadius: 20, width: 150, alignItems: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)', shadowColor: '#000', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.4, shadowRadius: 10 },
  statVal: { color: '#F7F3EB', fontSize: 32, fontWeight: '900' },
  statLab: { color: '#8A867D', fontSize: 12, marginTop: 8, textTransform: 'uppercase', letterSpacing: 1, fontWeight: '700' },
});
