
import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    TouchableOpacity,
    StatusBar,
    ActivityIndicator,
    Alert,
    RefreshControl,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import GradientBackground from '../../components/GradientBackground';
import { theme } from '../../theme';
import { BASE_URL } from '../../config/host';

interface EnergyForecast {
    avg_body_battery: number;
    trend: string;
    forecast_tomorrow: number;
    insight: string;
}

interface SleepConsistency {
    current_streak: number;
    best_streak: number;
    consistency_score: number;
    nudge: string;
}

interface Nudge {
    type: string;
    message: string;
    priority: string;
}

const FitbitInsightsScreen = ({ navigation }: any) => {
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [energy, setEnergy] = useState<EnergyForecast | null>(null);
    const [sleep, setSleep] = useState<SleepConsistency | null>(null);
    const [nudges, setNudges] = useState<Nudge[]>([]);
    const [lastSync, setLastSync] = useState('');

    const fetchInsights = async () => {
        try {
            const res = await fetch(`${BASE_URL}/api/fitbit-insights`);
            const data = await res.json();
            if (data.status === 'success') {
                setEnergy(data.energy_forecast);
                setSleep(data.sleep_consistency);
                setNudges(data.nudges || []);
                setLastSync(data.last_sync ? new Date(data.last_sync).toLocaleString() : '');
            }
        } catch (e) {
            console.error('Fitbit fetch error:', e);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    useEffect(() => { fetchInsights(); }, []);

    const handleRefresh = async () => {
        setRefreshing(true);
        try {
            await fetch(`${BASE_URL}/api/fitbit-refresh`, { method: 'POST' });
            await fetchInsights();
        } catch (e: any) {
            Alert.alert('Refresh Failed', e.message || 'Could not refresh Fitbit data');
            setRefreshing(false);
        }
    };

    const getNudgeIcon = (type: string): keyof typeof Ionicons.glyphMap => {
        switch (type?.toLowerCase()) {
            case 'sleep': return 'moon';
            case 'activity': return 'walk';
            case 'heart': return 'heart';
            case 'hydration': return 'water';
            default: return 'bulb';
        }
    };

    const getPriorityColor = (priority: string) => {
        switch (priority?.toLowerCase()) {
            case 'high': return '#EF5350';
            case 'medium': return '#FFB74D';
            default: return '#81C784';
        }
    };

    return (
        <GradientBackground style={styles.container}>
            <StatusBar barStyle="light-content" />

            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
                    <Ionicons name="chevron-back" size={24} color={theme.colors.text} />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Fitbit Insights</Text>
                <TouchableOpacity style={styles.backBtn} onPress={handleRefresh}>
                    <Ionicons name="refresh" size={20} color={theme.colors.textMuted} />
                </TouchableOpacity>
            </View>

            {loading ? (
                <View style={styles.loader}>
                    <ActivityIndicator size="large" color={theme.colors.accent} />
                    <Text style={styles.loaderText}>Loading insights...</Text>
                </View>
            ) : (
                <ScrollView
                    contentContainerStyle={styles.scrollContent}
                    showsVerticalScrollIndicator={false}
                    refreshControl={
                        <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={theme.colors.accent} />
                    }
                >
                    {lastSync ? (
                        <Text style={styles.syncText}>Last synced: {lastSync}</Text>
                    ) : null}

                    {/* Energy Forecast */}
                    {energy && (
                        <View
                            style={styles.insightCard}
                        >
                            <View style={styles.cardHeader}>
                                <View style={[styles.cardIcon, { backgroundColor: 'rgba(129,199,132,0.2)' }]}>
                                    <Ionicons name="battery-charging" size={22} color="#81C784" />
                                </View>
                                <Text style={styles.cardTitle}>Energy Forecast</Text>
                            </View>
                            <View style={styles.metricRow}>
                                <View style={styles.metric}>
                                    <Text style={styles.metricValue}>{energy.avg_body_battery ?? '—'}</Text>
                                    <Text style={styles.metricLabel}>Avg Battery</Text>
                                </View>
                                <View style={styles.metric}>
                                    <Text style={[styles.metricValue, { color: energy.trend === 'up' ? '#81C784' : '#FFB74D' }]}>
                                        {energy.trend === 'up' ? '↑' : energy.trend === 'down' ? '↓' : '→'}
                                    </Text>
                                    <Text style={styles.metricLabel}>Trend</Text>
                                </View>
                                <View style={styles.metric}>
                                    <Text style={[styles.metricValue, { color: '#4FC3F7' }]}>{energy.forecast_tomorrow ?? '—'}</Text>
                                    <Text style={styles.metricLabel}>Tomorrow</Text>
                                </View>
                            </View>
                            {energy.insight ? <Text style={styles.insightText}>{energy.insight}</Text> : null}
                        </View>
                    )}

                    {/* Sleep Consistency */}
                    {sleep && (
                        <View
                            style={styles.insightCard}
                        >
                            <View style={styles.cardHeader}>
                                <View style={[styles.cardIcon, { backgroundColor: 'rgba(100,181,246,0.2)' }]}>
                                    <Ionicons name="moon" size={22} color="#64B5F6" />
                                </View>
                                <Text style={styles.cardTitle}>Sleep Consistency</Text>
                            </View>
                            <View style={styles.metricRow}>
                                <View style={styles.metric}>
                                    <Text style={styles.metricValue}>{sleep.current_streak ?? 0}</Text>
                                    <Text style={styles.metricLabel}>Current Streak</Text>
                                </View>
                                <View style={styles.metric}>
                                    <Text style={[styles.metricValue, { color: '#FFB74D' }]}>{sleep.best_streak ?? 0}</Text>
                                    <Text style={styles.metricLabel}>Best Streak</Text>
                                </View>
                                <View style={styles.metric}>
                                    <Text style={[styles.metricValue, { color: '#81C784' }]}>{sleep.consistency_score ?? 0}%</Text>
                                    <Text style={styles.metricLabel}>Score</Text>
                                </View>
                            </View>
                            {sleep.nudge ? <Text style={styles.insightText}>{sleep.nudge}</Text> : null}
                        </View>
                    )}

                    {/* Personalized Nudges */}
                    {nudges.length > 0 && (
                        <>
                            <Text style={styles.sectionLabel}>PERSONALIZED NUDGES</Text>
                            {nudges.map((n, i) => (
                                <View key={i} style={styles.nudgeCard}>
                                    <View style={[styles.nudgeDot, { backgroundColor: getPriorityColor(n.priority) }]} />
                                    <View style={styles.nudgeIcon}>
                                        <Ionicons name={getNudgeIcon(n.type)} size={18} color={getPriorityColor(n.priority)} />
                                    </View>
                                    <Text style={styles.nudgeText}>{n.message}</Text>
                                </View>
                            ))}
                        </>
                    )}

                    <View style={{ height: 30 }} />
                </ScrollView>
            )}
        </GradientBackground>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1 },
    header: {
        flexDirection: 'row', alignItems: 'center',
        paddingTop: 54, paddingHorizontal: 16, paddingBottom: 14,
    },
    backBtn: {
        width: 40, height: 40, borderRadius: 20,
        backgroundColor: theme.colors.bgCard, justifyContent: 'center', alignItems: 'center',
    },
    headerTitle: {
        flex: 1, textAlign: 'center',
        fontSize: 20, fontWeight: '700', color: theme.colors.text,
    } as any,

    loader: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    loaderText: { color: theme.colors.textMuted, marginTop: 10 },

    scrollContent: { padding: 16 },
    syncText: { fontSize: 12, color: theme.colors.textMuted, textAlign: 'center', marginBottom: 16 },

    insightCard: {
        borderRadius: theme.borderRadius.m, padding: 20, marginBottom: 16,
        backgroundColor: theme.colors.bgCard,
    },
    cardHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 16 },
    cardIcon: {
        width: 40, height: 40, borderRadius: 20,
        justifyContent: 'center', alignItems: 'center', marginRight: 12,
    },
    cardTitle: { fontSize: 18, fontWeight: '700', color: theme.colors.text } as any,

    metricRow: { flexDirection: 'row', justifyContent: 'space-around', marginBottom: 14 },
    metric: { alignItems: 'center' },
    metricValue: { fontSize: 28, fontWeight: '800', color: theme.colors.text } as any,
    metricLabel: { fontSize: 11, fontWeight: '600', color: theme.colors.textMuted, marginTop: 4, letterSpacing: 0.3 } as any,

    insightText: {
        fontSize: 14, color: theme.colors.textSecondary, lineHeight: 20,
        paddingTop: 12, borderTopWidth: 1, borderTopColor: theme.colors.border,
    },

    sectionLabel: { ...theme.typography.label, marginBottom: 12, marginTop: 8 },

    nudgeCard: {
        flexDirection: 'row', alignItems: 'center',
        backgroundColor: theme.colors.bgCard, borderRadius: theme.borderRadius.m, padding: 14, marginBottom: 8,
    },
    nudgeDot: { width: 4, height: 30, borderRadius: 2, marginRight: 12 },
    nudgeIcon: { marginRight: 10 },
    nudgeText: { flex: 1, fontSize: 14, color: theme.colors.textSecondary, lineHeight: 20 },
});

export default FitbitInsightsScreen;
