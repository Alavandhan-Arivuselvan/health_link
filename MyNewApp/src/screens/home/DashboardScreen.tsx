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
import GradientBackground from '../../components/GradientBackground';
import { theme } from '../../theme';
import { reportsAPI } from '../../services/api';
import { BASE_URL } from '../../config/host';

// ── Reference ranges for health score calculation ─────────────────────
const REF_RANGES: Record<string, { normalLow: number; normalHigh: number; label: string; color: string }> = {
    'haemoglobin': { normalLow: 12, normalHigh: 17.5, label: 'Hb', color: '#EF5350' },
    'hemoglobin': { normalLow: 12, normalHigh: 17.5, label: 'Hb', color: '#EF5350' },
    'wbc': { normalLow: 4000, normalHigh: 11000, label: 'WBC', color: '#42A5F5' },
    'total wbc count': { normalLow: 4000, normalHigh: 11000, label: 'WBC', color: '#42A5F5' },
    'platelets': { normalLow: 150000, normalHigh: 400000, label: 'PLT', color: '#AB47BC' },
    'platelet': { normalLow: 150000, normalHigh: 400000, label: 'PLT', color: '#AB47BC' },
    'rbc': { normalLow: 4.0, normalHigh: 5.5, label: 'RBC', color: '#EF5350' },
    'creatinine': { normalLow: 0.7, normalHigh: 1.3, label: 'Creatinine', color: '#7E57C2' },
    'urea': { normalLow: 7, normalHigh: 20, label: 'Urea', color: '#5C6BC0' },
    'fbs': { normalLow: 70, normalHigh: 100, label: 'Glucose', color: '#4FC3F7' },
    'fasting glucose': { normalLow: 70, normalHigh: 100, label: 'Glucose', color: '#4FC3F7' },
    'fasting blood sugar': { normalLow: 70, normalHigh: 100, label: 'Glucose', color: '#4FC3F7' },
    'random blood sugar': { normalLow: 70, normalHigh: 200, label: 'RBS', color: '#4FC3F7' },
    'hba1c': { normalLow: 4, normalHigh: 5.7, label: 'HbA1c', color: '#FFB74D' },
    'cholesterol': { normalLow: 125, normalHigh: 200, label: 'Chol', color: '#FFB74D' },
    'total cholesterol': { normalLow: 125, normalHigh: 200, label: 'Chol', color: '#FFB74D' },
    'hdl': { normalLow: 40, normalHigh: 60, label: 'HDL', color: '#66BB6A' },
    'ldl': { normalLow: 0, normalHigh: 100, label: 'LDL', color: '#EF5350' },
    'triglycerides': { normalLow: 0, normalHigh: 150, label: 'TG', color: '#FF7043' },
    'tsh': { normalLow: 0.4, normalHigh: 4.0, label: 'TSH', color: '#26A69A' },
    'sgot': { normalLow: 5, normalHigh: 40, label: 'SGOT', color: '#78909C' },
    'sgpt': { normalLow: 7, normalHigh: 56, label: 'SGPT', color: '#78909C' },
    'bilirubin': { normalLow: 0.1, normalHigh: 1.0, label: 'Bili', color: '#FFA726' },
    'total bilirubin': { normalLow: 0.1, normalHigh: 1.0, label: 'Bili', color: '#FFA726' },
    'albumin': { normalLow: 3.5, normalHigh: 5.5, label: 'Albumin', color: '#4DB6AC' },
    'sodium': { normalLow: 136, normalHigh: 145, label: 'Na', color: '#42A5F5' },
    'potassium': { normalLow: 3.5, normalHigh: 5.0, label: 'K', color: '#FFA726' },
    'calcium': { normalLow: 8.5, normalHigh: 10.5, label: 'Ca', color: '#66BB6A' },
    'iron': { normalLow: 60, normalHigh: 170, label: 'Iron', color: '#8D6E63' },
    'vitamin d': { normalLow: 20, normalHigh: 50, label: 'Vit-D', color: '#FFA726' },
    'vitamin b12': { normalLow: 200, normalHigh: 900, label: 'B12', color: '#EF5350' },
    'esr': { normalLow: 0, normalHigh: 20, label: 'ESR', color: '#78909C' },
    'neutrophils': { normalLow: 40, normalHigh: 70, label: 'Neutro', color: '#66BB6A' },
    'lymphocytes': { normalLow: 20, normalHigh: 40, label: 'Lymph', color: '#AB47BC' },
    'pcv': { normalLow: 36, normalHigh: 50, label: 'PCV', color: '#5C6BC0' },
    'hematocrit': { normalLow: 36, normalHigh: 50, label: 'HCT', color: '#5C6BC0' },
    'mcv': { normalLow: 80, normalHigh: 100, label: 'MCV', color: '#7E57C2' },
    'mch': { normalLow: 27, normalHigh: 33, label: 'MCH', color: '#26C6DA' },
    'mchc': { normalLow: 32, normalHigh: 36, label: 'MCHC', color: '#8D6E63' },
};

function findRef(name: string) {
    const key = name.toLowerCase().trim();
    if (REF_RANGES[key]) return { key, ...REF_RANGES[key] };
    for (const [rk, rv] of Object.entries(REF_RANGES)) {
        if (key.includes(rk) || rk.includes(key)) return { key: rk, ...rv };
    }
    return null;
}

interface MiniMetric { label: string; value: string; color: string; status: 'Normal' | 'Low' | 'High' | 'Borderline' }

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

    // Dynamic health data
    const [healthScore, setHealthScore] = useState<number | null>(null);
    const [normalCount, setNormalCount] = useState(0);
    const [totalCount, setTotalCount] = useState(0);
    const [attentionCount, setAttentionCount] = useState(0);
    const [miniMetrics, setMiniMetrics] = useState<MiniMetric[]>([]);
    const [trendDirection, setTrendDirection] = useState<'up' | 'down' | 'stable'>('stable');

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

    // Fetch lab history and compute health score
    const fetchHealthScore = async () => {
        try {
            const userPhone = (await AsyncStorage.getItem('user_phone')) || '';
            if (!userPhone) return;
            const res = await fetch(`${BASE_URL}/api/lab-history/${userPhone}`);
            const json = await res.json();
            if (json.status !== 'success' || !json.history) return;

            const history: Record<string, { date: string; value: number; unit: string }[]> = json.history;

            let normal = 0;
            let attention = 0;
            let total = 0;
            const topMetrics: MiniMetric[] = [];
            const seen = new Set<string>();

            // Priority tests to show as mini metrics
            const priorityTests = ['glucose', 'fbs', 'fasting blood sugar', 'random blood sugar', 'hba1c', 'cholesterol', 'total cholesterol', 'tsh', 'haemoglobin', 'hemoglobin', 'creatinine'];

            for (const [testKey, points] of Object.entries(history)) {
                if (points.length === 0) continue;
                const latestVal = points[points.length - 1].value;
                const ref = findRef(testKey);
                if (!ref) continue;
                // Avoid counting duplicates (e.g. hemoglobin + haemoglobin)
                if (seen.has(ref.label)) continue;
                seen.add(ref.label);

                total++;
                const isNormal = latestVal >= ref.normalLow && latestVal <= ref.normalHigh;
                const isBorderline = !isNormal && (latestVal >= ref.normalLow * 0.9 && latestVal <= ref.normalHigh * 1.1);

                if (isNormal) normal++;
                else attention++;

                // Build mini metric for priority tests
                const isPriority = priorityTests.some(p => testKey.includes(p) || p.includes(testKey));
                if (isPriority && topMetrics.length < 3) {
                    let status: MiniMetric['status'] = 'Normal';
                    if (!isNormal && !isBorderline) status = latestVal < ref.normalLow ? 'Low' : 'High';
                    else if (isBorderline) status = 'Borderline';

                    // Format value nicely
                    let displayVal = latestVal.toString();
                    if (latestVal >= 1000) displayVal = (latestVal / 1000).toFixed(1) + 'k';
                    if (ref.label === 'HbA1c') displayVal = latestVal.toFixed(1) + '%';

                    topMetrics.push({
                        label: ref.label,
                        value: displayVal,
                        color: ref.color,
                        status,
                    });
                }
            }

            if (total > 0) {
                const score = Math.round((normal / total) * 100);
                setHealthScore(score);
                setNormalCount(normal);
                setAttentionCount(attention);
                setTotalCount(total);
                setTrendDirection(score >= 75 ? 'up' : score >= 50 ? 'stable' : 'down');
            }
            if (topMetrics.length > 0) setMiniMetrics(topMetrics);
        } catch (e) {
            console.log('Health score fetch error:', e);
        }
    };

    useFocusEffect(
        useCallback(() => {
            setLoadingReports(true);
            fetchRecent();
            fetchHealthScore();
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
            setTimeout(() => { fetchRecent(); fetchHealthScore(); }, 1500);
        } catch (e: any) {
            Alert.alert('Upload Failed', e.message || 'Something went wrong');
        } finally {
            setUploading(false);
        }
    };

    // Derived display values
    const displayScore = healthScore ?? '--';
    const gaugeColor = healthScore !== null
        ? (healthScore >= 75 ? theme.colors.accent : healthScore >= 50 ? '#FFB74D' : '#EF5350')
        : theme.colors.textMuted;
    const trendIcon = trendDirection === 'up' ? 'trending-up' : trendDirection === 'down' ? 'trending-down' : 'remove';
    const trendColor = trendDirection === 'up' ? '#4CAF50' : trendDirection === 'down' ? '#EF5350' : '#FFB74D';

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
                    <View
                        style={styles.heroCard}
                    >
                        <View style={styles.scoreRow}>
                            <View style={[styles.gauge, { borderColor: gaugeColor }]}>
                                <View style={styles.gaugeInner}>
                                    <Text style={styles.gaugeValue}>{displayScore}</Text>
                                    {healthScore !== null && <Text style={[styles.gaugePercent, { color: gaugeColor }]}>%</Text>}
                                </View>
                            </View>
                            <View style={styles.scoreInfo}>
                                <View style={styles.scoreTitleRow}>
                                    <Text style={styles.scoreTitle}>Overall Health Score</Text>
                                    <View style={[styles.trendBadge, { backgroundColor: trendColor + '20' }]}>
                                        <Ionicons name={trendIcon as any} size={14} color={trendColor} />
                                    </View>
                                </View>
                                <Text style={styles.scoreSub}>
                                    {healthScore !== null ? 'Based on your latest reports' : 'Upload reports to see your score'}
                                </Text>
                                {totalCount > 0 && (
                                    <Text style={styles.scoreSub}>
                                        {normalCount}/{totalCount} metrics normal  •  {attentionCount > 0 ? `${attentionCount} need attention` : 'All good!'}
                                    </Text>
                                )}
                            </View>
                        </View>

                        {miniMetrics.length > 0 && (
                            <View style={styles.miniRow}>
                                {miniMetrics.map((m) => (
                                    <View key={m.label} style={styles.miniCard}>
                                        <Text style={styles.miniLabel}>{m.label}</Text>
                                        <Text style={[styles.miniValue, { color: m.color }]}>{m.value}</Text>
                                        <View style={[styles.miniStatus, {
                                            backgroundColor: m.status === 'Normal' ? 'rgba(76,175,80,0.15)'
                                                : m.status === 'Borderline' ? 'rgba(255,183,77,0.15)'
                                                    : 'rgba(239,83,80,0.15)',
                                        }]}>
                                            <Text style={[styles.miniStatusText, {
                                                color: m.status === 'Normal' ? '#81C784'
                                                    : m.status === 'Borderline' ? '#FFB74D'
                                                        : '#EF5350',
                                            }]}>{m.status}</Text>
                                        </View>
                                    </View>
                                ))}
                            </View>
                        )}

                        <View style={styles.tapHint}>
                            <Text style={styles.tapHintText}>Tap to see full dashboard & history</Text>
                            <Ionicons name="chevron-forward" size={16} color={theme.colors.textMuted} />
                        </View>
                    </View>
                </TouchableOpacity>

                {/* ── QUICK ACTIONS ──────────────────────────── */}
                <Text style={styles.sectionLabel}>QUICK ACTIONS</Text>
                <View style={styles.actionsRow}>
                    <TouchableOpacity style={styles.actionCard} activeOpacity={0.8} onPress={handleUpload} disabled={uploading}>
                        <View style={[styles.actionIcon, { backgroundColor: 'rgba(0,201,167,0.12)' }]}>
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
                    <TouchableOpacity style={styles.actionCard} activeOpacity={0.8} onPress={() => navigation.navigate('Chat')}>
                        <View style={[styles.actionIcon, { backgroundColor: 'rgba(186,104,200,0.15)' }]}>
                            <Ionicons name="chatbubble-ellipses" size={22} color="#BA68C8" />
                        </View>
                        <Text style={styles.actionText}>Ask{'\n'}AI</Text>
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
        paddingTop: 48, paddingHorizontal: 16, paddingBottom: 10,
    },
    backBtn: {
        width: 40, height: 40, borderRadius: 20,
        backgroundColor: theme.colors.bgCard, justifyContent: 'center', alignItems: 'center',
    },
    headerTitle: { fontSize: 20, fontWeight: '700', color: theme.colors.text } as any,
    headerRight: { flexDirection: 'row', alignItems: 'center', gap: 14 },
    headerIconBtn: {
        width: 44, height: 44, borderRadius: 22,
        backgroundColor: theme.colors.bgCard,
        justifyContent: 'center', alignItems: 'center',
    },
    badge: {
        position: 'absolute', top: 8, right: 10,
        width: 9, height: 9, borderRadius: 5,
        backgroundColor: '#F85149', borderWidth: 1.5, borderColor: theme.colors.bgDark,
    },
    avatar: {
        width: 44, height: 44, borderRadius: 22,
        backgroundColor: 'rgba(0,201,167,0.12)',
        justifyContent: 'center', alignItems: 'center',
    },

    scrollContent: { paddingHorizontal: 16, paddingTop: 20 },

    heroCard: {
        borderRadius: theme.borderRadius.m, padding: 22, marginBottom: 24,
        backgroundColor: theme.colors.bgCard, ...theme.shadow.card,
    },
    scoreRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 18 },
    gauge: {
        width: 80, height: 80, borderRadius: 40,
        borderWidth: 4, borderColor: theme.colors.accent,
        justifyContent: 'center', alignItems: 'center', marginRight: 18,
        backgroundColor: 'rgba(0,201,167,0.06)',
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
        borderRadius: theme.borderRadius.m, padding: 14, alignItems: 'center',
        ...theme.shadow.card,
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
        backgroundColor: theme.colors.bgCard, borderRadius: theme.borderRadius.m, padding: 30,
        alignItems: 'center',
    },
    emptyText: { fontSize: 14, color: theme.colors.textMuted, marginTop: 10, textAlign: 'center' },

    recentCard: {
        flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
        backgroundColor: theme.colors.bgCard, borderRadius: theme.borderRadius.m, padding: 16, marginBottom: 10,
        ...theme.shadow.card,
    },
    recentLeft: { flexDirection: 'row', alignItems: 'center', flex: 1 },
    recentIcon: {
        width: 42, height: 42, borderRadius: 12,
        backgroundColor: 'rgba(0,201,167,0.1)', justifyContent: 'center', alignItems: 'center', marginRight: 14,
    },
    recentDate: { fontSize: 15, fontWeight: '600', color: theme.colors.text } as any,
    recentSub: { fontSize: 12, color: theme.colors.textMuted, marginTop: 2 },
    recentRight: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    statusDot: { width: 8, height: 8, borderRadius: 4 },
});

export default DashboardScreen;
