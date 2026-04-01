import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

interface ProgressRingProps {
    progress: number; // 0-1
    size: number;
    strokeWidth: number;
    color: string;
    bgColor?: string;
    label: string;
    value: string;
    subtitle?: string;
}

const ProgressRing: React.FC<ProgressRingProps> = ({
    progress,
    size,
    strokeWidth,
    color,
    bgColor,
    label,
    value,
    subtitle,
}) => {
    const clampedProgress = Math.min(Math.max(progress, 0), 1);
    const outerSize = size;
    const innerSize = size - strokeWidth * 2;
    const progressDegrees = clampedProgress * 360;

    return (
        <View style={styles.container}>
            {/* Ring container */}
            <View style={{
                width: outerSize,
                height: outerSize,
                borderRadius: outerSize / 2,
                backgroundColor: bgColor || 'rgba(255,255,255,0.08)',
                justifyContent: 'center',
                alignItems: 'center',
            }}>
                {/* Progress arc using conic gradient simulation with border */}
                <View style={{
                    width: outerSize,
                    height: outerSize,
                    borderRadius: outerSize / 2,
                    borderWidth: strokeWidth,
                    borderColor: clampedProgress > 0 ? color : 'transparent',
                    opacity: 0.3,
                    position: 'absolute',
                }} />

                {/* Filled portion — use a circular indicator approach */}
                {clampedProgress > 0 && (
                    <View style={{
                        position: 'absolute',
                        width: outerSize,
                        height: outerSize,
                        borderRadius: outerSize / 2,
                        borderWidth: strokeWidth,
                        borderColor: 'transparent',
                        borderTopColor: color,
                        borderRightColor: clampedProgress > 0.25 ? color : 'transparent',
                        borderBottomColor: clampedProgress > 0.5 ? color : 'transparent',
                        borderLeftColor: clampedProgress > 0.75 ? color : 'transparent',
                        transform: [{ rotate: '-90deg' }],
                    }} />
                )}

                {/* Inner circle (background) */}
                <View style={{
                    width: innerSize,
                    height: innerSize,
                    borderRadius: innerSize / 2,
                    backgroundColor: '#0D1117',
                    justifyContent: 'center',
                    alignItems: 'center',
                }}>
                    <Text style={[styles.valueText, { fontSize: size * 0.18, color }]}>{value}</Text>
                </View>
            </View>

            <Text style={styles.labelText} numberOfLines={1}>{label}</Text>
            {subtitle && <Text style={styles.subtitleText} numberOfLines={1}>{subtitle}</Text>}
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        alignItems: 'center',
        gap: 6,
    },
    valueText: {
        fontWeight: '800',
    },
    labelText: {
        fontSize: 11,
        color: '#C9D1D9',
        fontWeight: '600',
        letterSpacing: 0.3,
    },
    subtitleText: {
        fontSize: 10,
        color: '#8B949E',
        marginTop: -4,
    },
});

export default ProgressRing;
