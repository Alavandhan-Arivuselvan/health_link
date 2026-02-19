
import React from 'react';
import { View, StyleSheet, Text, ScrollView } from 'react-native';
import GradientBackground from '../../components/GradientBackground';
import CustomButton from '../../components/CustomButton';
import { theme } from '../../theme';
import { statsAPI } from '../../services/api';

const StatsCard = ({ title, value }: { title: string, value: string }) => (
    <View style={styles.card}>
        <Text style={styles.cardTitle}>{title}</Text>
        <Text style={styles.cardValue}>{value}</Text>
    </View>
);

const StatsScreen = () => {
    const handleConnectSmartwatch = () => {
        // Placeholder logic
        alert('Connecting to Smartwatch...');
    };

    const handleSaveStats = async () => {
        try {
            await statsAPI.saveStats({ steps: 5000, heartRate: 75 });
            alert('Stats saved to backend!');
        } catch (e) {
            alert('Failed to save stats');
        }
    }

    return (
        <GradientBackground style={styles.container}>
            <ScrollView contentContainerStyle={styles.content}>
                <Text style={styles.header}>Health Statistics</Text>

                <View style={styles.statsContainer}>
                    <StatsCard title="Steps" value="5,432" />
                    <StatsCard title="Heart Rate" value="72 bpm" />
                    <StatsCard title="Sleep" value="7h 12m" />
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
    },
    header: {
        ...theme.typography.h1,
        color: theme.colors.white,
        textAlign: 'center',
        marginBottom: theme.spacing.l,
    },
    statsContainer: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        justifyContent: 'space-between',
        marginBottom: theme.spacing.l,
    },
    card: {
        backgroundColor: theme.colors.white,
        width: '48%',
        padding: theme.spacing.m,
        borderRadius: theme.borderRadius.m,
        marginBottom: theme.spacing.m,
        elevation: 3,
    },
    cardTitle: {
        ...theme.typography.label,
        color: theme.colors.gray,
    },
    cardValue: {
        ...theme.typography.h2,
        marginTop: theme.spacing.s,
    },
});

export default StatsScreen;
