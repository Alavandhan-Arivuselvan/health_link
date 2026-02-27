
import React, { useState, useCallback } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    TouchableOpacity,
    StatusBar,
    ActivityIndicator,
    Alert,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as DocumentPicker from 'expo-document-picker';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import GradientBackground from '../../components/GradientBackground';
import { theme } from '../../theme';
import { reportsAPI } from '../../services/api';

// Mini metric preview data (static for now)
const MINI_METRICS = [
    { label: 'Glucose', value: '85', color: '#4FC3F7', status: 'Normal' },
    { label: 'HbA1c', value: '6.2%', color: '#FFB74D', status: 'Borderline' },
    { label: 'BP', value: '118', color: '#81C784', status: 'Normal' },
];

interface ReportSummary {
    id: string;
    filename: string;
    status: string;
    metrics_count: number;
    uploaded_at: string;
}

const DashboardScreen = ({ navigation }: any) => {
    const [recentReports, setRecentReports] = useState<ReportSummary[]>([]);
    const [loadingReports, setLoadingReports] = useState(true);
    const [uploading, setUploading] = useState(false);

    // Fetch recent reports on focus
    const fetchRecent = async () => {
        try {
            const userPhone = (await AsyncStorage.getItem('user_phone')) || '';
            if (!userPhone) { setLoadingReports(false); return; }
            const res = await reportsAPI.list(userPhone);
            setRecentReports((res.data.reports || []).slice(0, 3));
        } catch {
            // silently fail for dashboard preview
        } finally {
            setLoadingReports(false);
        }
    };

    useFocusEffect(
        useCallback(() => {
            setLoadingReports(true);
            fetchRecent();
        }, [])
    );

    const formatDate = (iso: string) => {
        try {
            return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
        } catch { return iso; }
    };

    // Upload handler
    const handleUpload = async () => {
        try {
            const result = await DocumentPicker.getDocumentAsync({
                type: ['application/pdf', 'image/*'],
                copyToCacheDirectory: true,
            });
            if (result.canceled || !result.assets?.length) return;

            const file = result.assets[0];
            setUploading(true);

            const userPhone = (await AsyncStorage.getItem('user_phone')) || '';
            const formData = new FormData();
            formData.append('file', {
                uri: file.uri,
                name: file.name || 'report.pdf',
                type: file.mimeType || 'application/pdf',
            } as any);
            formData.append('user_phone', userPhone);

            await reportsAPI.upload(formData);
            Alert.alert('Upload Started', `${file.name} is being processed.`);
            setTimeout(() => fetchRecent(), 1500);
        } catch (e: any) {
            Alert.alert('Upload Failed', e.message || 'Something went wrong');
        } finally {
            setUploading(false);
        }
    };

    return (
        <GradientBackground style={styles.container}>
            <StatusBar barStyle="light-content" />

            {/* ── HEADER ─────────────────────────────────── */}
            <View style={styles.header}>
                <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
                    <Ionicons name="chevron-back" size={24} color={theme.colors.text} />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Dashboard</Text>
                <View style={styles.headerRight}>
                    <TouchableOpacity style={styles.headerIconBtn}>
                        <Ionicons name="notifications-outline" size={22} color={theme.colors.text} />
                        <View style={styles.badge} />
                    </TouchableOpacity>
                    <View style={styles.avatar}>
                        <Ionicons name="person" size={20} color={theme.colors.accent} />
                    </View>
                </View>
            </View>

            <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
                {/* ── HERO REPORT CARD (tappable) ─────────────── */}
                <TouchableOpacity activeOpacity={0.85} onPress={() => navigation.navigate('ReportHistory')}>
                    <LinearGradient
                        colors={['rgba(0,212,170,0.18)', 'rgba(0,184,148,0.06)', 'transparent']}
                        style={styles.heroCard}
                    >
                        <View style={styles.scoreRow}>
                            <View style={styles.gauge}>
                                <View style={styles.gaugeInner}>
                                    <Text style={styles.gaugeValue}>84</Text>
                                    <Text style={styles.gaugePercent}>%</Text>
                                </View>
                            </View>
                            <View style={styles.scoreInfo}>
                                <View style={styles.scoreTitleRow}>
                                    <Text style={styles.scoreTitle}>Overall Health Score</Text>
                                    <View style={styles.trendBadge}>
                                        <Ionicons name="trending-up" size={14} color="#4CAF50" />
                                    </View>
                                </View>
                                <Text style={styles.scoreSub}>Based on your latest reports</Text>
                                <Text style={styles.scoreSub}>5/7 metrics normal  •  2 need attention</Text>
                            </View>
                        </View>

                        <View style={styles.miniRow}>
                            {MINI_METRICS.map((m) => (
                                <View key={m.label} style={styles.miniCard}>
                                    <Text style={styles.miniLabel}>{m.label}</Text>
                                    <Text style={[styles.miniValue, { color: m.color }]}>{m.value}</Text>
                                    <View style={[styles.miniStatus, {
                                        backgroundColor: m.status === 'Normal' ? 'rgba(76,175,80,0.15)' : 'rgba(255,183,77,0.15)',
                                    }]}>
                                        <Text style={[styles.miniStatusText, {
                                            color: m.status === 'Normal' ? '#81C784' : '#FFB74D',
                                        }]}>{m.status}</Text>
                                    </View>
                                </View>
                            ))}
                        </View>

                        <View style={styles.tapHint}>
                            <Text style={styles.tapHintText}>Tap to see full dashboard & history</Text>
                            <Ionicons name="chevron-forward" size={16} color={theme.colors.textMuted} />
                        </View>
                    </LinearGradient>
                </TouchableOpacity>

                {/* ── QUICK ACTIONS ──────────────────────────── */}
                <Text style={styles.sectionLabel}>QUICK ACTIONS</Text>
                <View style={styles.actionsRow}>
                    <TouchableOpacity style={styles.actionCard} activeOpacity={0.8} onPress={handleUpload} disabled={uploading}>
                        <View style={[styles.actionIcon, { backgroundColor: 'rgba(0,212,170,0.15)' }]}>
                            {uploading ? (
                                <ActivityIndicator size="small" color={theme.colors.accent} />
                            ) : (
                                <Ionicons name="cloud-upload" size={22} color={theme.colors.accent} />
                            )}
                        </View>
                        <Text style={styles.actionText}>{uploading ? 'Uploading...' : 'Upload\nReport'}</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.actionCard} activeOpacity={0.8} onPress={() => navigation.navigate('ReportHistory')}>
                        <View style={[styles.actionIcon, { backgroundColor: 'rgba(79,195,247,0.15)' }]}>
                            <Ionicons name="time" size={22} color="#4FC3F7" />
                        </View>
                        <Text style={styles.actionText}>View{'\n'}History</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.actionCard} activeOpacity={0.8}>
                        <View style={[styles.actionIcon, { backgroundColor: 'rgba(186,104,200,0.15)' }]}>
                            <Ionicons name="chatbubble-ellipses" size={22} color="#BA68C8" />
                        </View>
                        <Text style={styles.actionText}>Ask{'\n'}AI</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.actionCard} activeOpacity={0.8}>
                        <View style={[styles.actionIcon, { backgroundColor: 'rgba(255,183,77,0.15)' }]}>
                            <Ionicons name="document-text" size={22} color="#FFB74D" />
                        </View>
                        <Text style={styles.actionText}>Export{'\n'}PDF</Text>
                    </TouchableOpacity>
                </View>

                {/* ── RECENT UPLOADS ─────────────────────────── */}
                <Text style={styles.sectionLabel}>RECENT UPLOADS</Text>
                {loadingReports ? (
                    <View style={{ alignItems: 'center', paddingVertical: 20 }}>
                        <ActivityIndicator color={theme.colors.accent} />
                    </View>
                ) : recentReports.length === 0 ? (
                    <View style={styles.emptyCard}>
                        <Ionicons name="document-text-outline" size={32} color={theme.colors.textMuted} />
                        <Text style={styles.emptyText}>No reports yet. Upload your first lab report!</Text>
                    </View>
                ) : (
                    recentReports.map((item) => (
                        <TouchableOpacity
                            key={item.id}
                            style={styles.recentCard}
                            activeOpacity={0.8}
                            onPress={() => navigation.navigate('ReportDetail', { reportId: item.id, date: formatDate(item.uploaded_at) })}
                        >
                            <View style={styles.recentLeft}>
                                <View style={styles.recentIcon}>
                                    <Ionicons name="document-attach" size={20} color={theme.colors.accent} />
                                </View>
                                <View>
                                    <Text style={styles.recentDate}>{formatDate(item.uploaded_at)}</Text>
                                    <Text style={styles.recentSub}>
                                        {item.metrics_count > 0 ? `${item.metrics_count} metrics extracted` : item.status === 'processing' ? 'Processing...' : item.filename}
                                    </Text>
                                </View>
                            </View>
                            <View style={styles.recentRight}>
                                <View style={[styles.statusDot, {
                                    backgroundColor: item.status === 'processed' ? '#4CAF50' : item.status === 'processing' ? '#FFB74D' : '#EF5350',
                                }]} />
                                <Ionicons name="chevron-forward" size={18} color={theme.colors.textMuted} />
                            </View>
                        </TouchableOpacity>
                    ))
                )}

                <View style={{ height: 30 }} />
            </ScrollView>
        </GradientBackground>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1 },

    header: {
        flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
        paddingTop: 54, paddingHorizontal: 20, paddingBottom: 14,
        borderBottomWidth: 1, borderBottomColor: theme.colors.border,
    },
    backBtn: {
        width: 40, height: 40, borderRadius: 20,
        backgroundColor: theme.colors.glassLight, justifyContent: 'center', alignItems: 'center',
        borderWidth: 1, borderColor: theme.colors.border,
    },
    headerTitle: { fontSize: 20, fontWeight: '700', color: theme.colors.text } as any,
    headerRight: { flexDirection: 'row', alignItems: 'center', gap: 14 },
    headerIconBtn: {
        width: 44, height: 44, borderRadius: 22,
        backgroundColor: theme.colors.glassLight, borderWidth: 1, borderColor: theme.colors.border,
        justifyContent: 'center', alignItems: 'center',
    },
    badge: {
        position: 'absolute', top: 8, right: 10,
        width: 9, height: 9, borderRadius: 5,
        backgroundColor: '#FF5252', borderWidth: 1.5, borderColor: theme.colors.bgDark,
    },
    avatar: {
        width: 44, height: 44, borderRadius: 22,
        backgroundColor: theme.colors.accent + '20', borderWidth: 1.5, borderColor: theme.colors.accent + '50',
        justifyContent: 'center', alignItems: 'center',
    },

    scrollContent: { paddingHorizontal: 16, paddingTop: 20 },

    heroCard: {
        borderRadius: 24, padding: 22, marginBottom: 24,
        borderWidth: 1, borderColor: theme.colors.border, ...theme.shadow.card,
    },
    scoreRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 18 },
    gauge: {
        width: 80, height: 80, borderRadius: 40,
        borderWidth: 4, borderColor: theme.colors.accent,
        justifyContent: 'center', alignItems: 'center', marginRight: 18,
        backgroundColor: 'rgba(0,212,170,0.08)',
    },
    gaugeInner: { flexDirection: 'row', alignItems: 'baseline' },
    gaugeValue: { fontSize: 28, fontWeight: '900', color: theme.colors.text } as any,
    gaugePercent: { fontSize: 14, fontWeight: '700', color: theme.colors.accent, marginLeft: 1 } as any,
    scoreInfo: { flex: 1 },
    scoreTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    scoreTitle: { fontSize: 18, fontWeight: '700', color: theme.colors.text } as any,
    trendBadge: {
        width: 26, height: 26, borderRadius: 13,
        backgroundColor: 'rgba(76,175,80,0.15)', justifyContent: 'center', alignItems: 'center',
    },
    scoreSub: { fontSize: 13, color: theme.colors.textMuted, marginTop: 3, lineHeight: 18 },

    miniRow: { flexDirection: 'row', gap: 10, marginBottom: 16 },
    miniCard: {
        flex: 1, backgroundColor: theme.colors.bgDark,
        borderRadius: 14, padding: 12, alignItems: 'center',
        borderWidth: 1, borderColor: theme.colors.border,
    },
    miniLabel: { fontSize: 11, fontWeight: '600', color: theme.colors.textMuted, letterSpacing: 0.3 } as any,
    miniValue: { fontSize: 20, fontWeight: '800', marginTop: 4 } as any,
    miniStatus: { borderRadius: 8, paddingHorizontal: 8, paddingVertical: 2, marginTop: 6 },
    miniStatusText: { fontSize: 10, fontWeight: '700' } as any,

    tapHint: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
        paddingTop: 12, borderTopWidth: 1, borderTopColor: theme.colors.border,
    },
    tapHintText: { fontSize: 13, color: theme.colors.textMuted, marginRight: 4 },

    sectionLabel: { ...theme.typography.label, marginBottom: 14, marginTop: 8 },

    actionsRow: { flexDirection: 'row', gap: 10, marginBottom: 24 },
    actionCard: {
        flex: 1, backgroundColor: theme.colors.bgCard,
        borderRadius: 18, padding: 14, alignItems: 'center',
        borderWidth: 1, borderColor: theme.colors.border,
    },
    actionIcon: {
        width: 46, height: 46, borderRadius: 23,
        justifyContent: 'center', alignItems: 'center', marginBottom: 8,
    },
    actionText: {
        fontSize: 11, fontWeight: '600', color: theme.colors.textSecondary,
        textAlign: 'center', lineHeight: 15,
    } as any,

    emptyCard: {
        backgroundColor: theme.colors.bgCard, borderRadius: 16, padding: 30,
        alignItems: 'center', borderWidth: 1, borderColor: theme.colors.border,
    },
    emptyText: { fontSize: 14, color: theme.colors.textMuted, marginTop: 10, textAlign: 'center' },

    recentCard: {
        flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
        backgroundColor: theme.colors.bgCard, borderRadius: 16, padding: 16, marginBottom: 10,
        borderWidth: 1, borderColor: theme.colors.border,
    },
    recentLeft: { flexDirection: 'row', alignItems: 'center', flex: 1 },
    recentIcon: {
        width: 42, height: 42, borderRadius: 12,
        backgroundColor: 'rgba(0,212,170,0.12)', justifyContent: 'center', alignItems: 'center', marginRight: 14,
    },
    recentDate: { fontSize: 15, fontWeight: '600', color: theme.colors.text } as any,
    recentSub: { fontSize: 12, color: theme.colors.textMuted, marginTop: 2 },
    recentRight: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    statusDot: { width: 8, height: 8, borderRadius: 4 },
});

export default DashboardScreen;
