import React, { useEffect } from 'react';
import { View, StyleSheet } from 'react-native';
import Svg, { Defs, Pattern, Rect, Path } from 'react-native-svg';
import Animated, { useSharedValue, useAnimatedStyle, withRepeat, withTiming, withSequence, Easing } from 'react-native-reanimated';
import { BlurView } from 'expo-blur';

export default function TechnicalBackground() {
    const pulse1 = useSharedValue(1);
    const pulse2 = useSharedValue(1);

    useEffect(() => {
        pulse1.value = withRepeat(
            withSequence(
                withTiming(1.1, { duration: 5000, easing: Easing.inOut(Easing.ease) }),
                withTiming(1, { duration: 5000, easing: Easing.inOut(Easing.ease) })
            ),
            -1,
            true
        );
        pulse2.value = withRepeat(
            withSequence(
                withTiming(1.1, { duration: 6000, easing: Easing.inOut(Easing.ease) }),
                withTiming(1, { duration: 6000, easing: Easing.inOut(Easing.ease) })
            ),
            -1,
            true
        );
    }, [pulse1, pulse2]);

    const animatedStyle1 = useAnimatedStyle(() => ({
        transform: [{ scale: pulse1.value }],
        opacity: (pulse1.value - 0.9) * 1.5,
    }));

    const animatedStyle2 = useAnimatedStyle(() => ({
        transform: [{ scale: pulse2.value }],
        opacity: (pulse2.value - 0.9) * 1.5,
    }));

    return (
        <View style={StyleSheet.absoluteFillObject} className="bg-[#030712]">
            {/* Background Grid */}
            <Svg height="100%" width="100%" style={StyleSheet.absoluteFillObject}>
                <Defs>
                    <Pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
                        <Path d="M 40 0 L 0 0 0 40" fill="none" stroke="rgba(255,255,255,0.03)" strokeWidth="1" />
                    </Pattern>
                </Defs>
                <Rect width="100%" height="100%" fill="url(#grid)" />
            </Svg>

            {/* Glowing Shapes */}
            <View style={StyleSheet.absoluteFillObject} className="overflow-hidden">
                {/* Shape 1 - Primary Blue */}
                <Animated.View
                    style={[
                        {
                            position: 'absolute',
                            width: 600,
                            height: 600,
                            borderRadius: 300,
                            backgroundColor: '#3B82F6',
                            top: -150,
                            right: -150,
                        },
                        animatedStyle1,
                    ]}
                >
                    <BlurView intensity={100} tint="dark" style={StyleSheet.absoluteFillObject} />
                </Animated.View>

                {/* Shape 2 - Accent/White Glow */}
                <Animated.View
                    style={[
                        {
                            position: 'absolute',
                            width: 500,
                            height: 500,
                            borderRadius: 250,
                            backgroundColor: '#8B5CF6', // Slightly purplish blue for secondary glow
                            bottom: -150,
                            left: -150,
                        },
                        animatedStyle2,
                    ]}
                >
                    <BlurView intensity={100} tint="dark" style={StyleSheet.absoluteFillObject} />
                </Animated.View>
            </View>

            {/* Overall overlay to soften the sharp blurs */}
            <BlurView intensity={80} tint="dark" style={StyleSheet.absoluteFillObject} className="opacity-90" />
        </View>
    );
}
