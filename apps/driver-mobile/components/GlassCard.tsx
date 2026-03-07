import React from 'react';
import { View, ViewProps, StyleSheet } from 'react-native';
import { BlurView } from 'expo-blur';

export interface GlassCardProps extends ViewProps {
    children: React.ReactNode;
    className?: string;
    variant?: 'login' | 'panel';
}

export function GlassCard({ children, className = '', variant = 'panel', ...props }: GlassCardProps) {
    return (
        <View
            className={`overflow-hidden border border-white/10 rounded-2xl ${className}`}
            style={[
                styles.shadow,
                variant === 'login' ? {
                    backgroundColor: 'rgba(21, 25, 33, 0.7)',
                } : {
                    backgroundColor: 'rgba(31, 41, 55, 0.7)', // Slightly lighter for internal panels
                }
            ]}
            {...props}
        >
            <BlurView intensity={30} tint="dark" style={StyleSheet.absoluteFillObject} />
            {/* Top accent line */}
            <View className="absolute top-0 left-0 right-0 h-[2px] bg-[#3B82F6] opacity-80" />
            <View className="relative z-10 px-6 py-6">
                {children}
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    shadow: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.5,
        shadowRadius: 20,
        elevation: 15,
    }
});
