
import React from 'react';
import { View, StyleSheet, Text, ScrollView } from 'react-native';
import GradientBackground from '../../components/GradientBackground';
import CustomButton from '../../components/CustomButton';
import { theme } from '../../theme';
import { statsAPI } from '../../services/api';
import { Ionicons } from '@expo/vector-icons';

const statsData = [
    { title: 'Steps', value: '5,432', icon: 'footsteps' as const, color: '#00D4AA' },
    { title: 'Heart Rate', value: '72 bpm', icon: 'heart' as const, color: '#FF6B6B' },
    { title: 'Sleep', value: '7h 12m', icon: 'moon' as const, color: '#8B5CF6' },
    { title: 'Calories', value: '1,840', icon: 'flame' as const, color: '#F59E0B' },
];

const StatsCard = ({ title, value, icon, color }: { title: string, value: string, icon: string, color: string }) => (
    <View style={styles.card}>
        <View style={[styles.cardIconCircle, { backgroundColor: color + '20' }]}>
            <Ionicons name={icon as any} size={22} color={color} />
        </View>
        <Text style={styles.cardTitle}>{title}</Text>
        <Text style={styles.cardValue}>{value}</Text>
    </View>
);

const StatsScreen = () => {
    const handleConnectSmartwatch = () => {
        alert('Connecting to Smartwatch...');
    };

    const handleSaveStats = async () => {
        try {
            await statsAPI.saveStats({ steps: 5000, heartRate: 75 });
            alert('Stats saved to backend!');
        } catch (e) {
            alert('Failed to save stats');
        }
    };

    return (
        <GradientBackground style={styles.container}>
            <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
                {/* Header */}
                <View style={styles.headerIcon}>
                    <Ionicons name="pulse" size={28} color={theme.colors.accent} />
                </View>
                <Text style={styles.header}>Health Statistics</Text>
                <Text style={styles.headerSub}>Monitor your daily vitals</Text>

                <View style={styles.statsContainer}>
                    {statsData.map(stat => (
                        <StatsCard key={stat.title} {...stat} />
                    ))}
                </View>

                <CustomButton title="Connect Smartwatch" onPress={handleConnectSmartwatch} />
                <CustomButton title="Sync & Save Data" type="outline" onPress={handleSaveStats} />
            </ScrollView>
        </GradientBackground>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    content: {
        padding: theme.spacing.m,
        paddingTop: 50,
        alignItems: 'center',
    },
    headerIcon: {
        width: 60,
        height: 60,
        borderRadius: 30,
        backgroundColor: theme.colors.glassLight,
        borderWidth: 1,
        borderColor: theme.colors.border,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: theme.spacing.m,
    },
    header: {
        ...theme.typography.h2,
        textAlign: 'center',
        marginBottom: 4,
    },
    headerSub: {
        fontSize: 14,
        color: theme.colors.textMuted,
        marginBottom: theme.spacing.xl,
    },
    statsContainer: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        justifyContent: 'space-between',
        marginBottom: theme.spacing.l,
        width: '100%',
    },
    card: {
        backgroundColor: theme.colors.bgCard,
        width: '48%',
        padding: theme.spacing.m,
        borderRadius: theme.borderRadius.l,
        marginBottom: theme.spacing.m,
        borderWidth: 1,
        borderColor: theme.colors.border,
    },
    cardIconCircle: {
        width: 40,
        height: 40,
        borderRadius: 20,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 10,
    },
    cardTitle: {
        fontSize: 13,
        fontWeight: '600',
        color: theme.colors.textMuted,
        letterSpacing: 0.5,
        textTransform: 'uppercase',
    } as any,
    cardValue: {
        ...theme.typography.h2,
        marginTop: 4,
    },
});

export default StatsScreen;
