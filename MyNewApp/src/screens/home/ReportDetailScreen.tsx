
import React, { useState } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    TouchableOpacity,
    Modal,
    Dimensions,
    StatusBar,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { LineChart } from 'react-native-chart-kit';
import GradientBackground from '../../components/GradientBackground';
import { theme } from '../../theme';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// ─── METRIC DATA ────────────────────────────────────────────────────
interface Metric {
    id: string;
    name: string;
    icon: keyof typeof Ionicons.glyphMap;
    iconColor: string;
    value: string;
    numericValue: number;
    unit: string;
    min: number;
    max: number;
    normalLow: number;
    normalHigh: number;
    rangeLabel: string;
    status: 'good' | 'low' | 'borderline' | 'high';
    statusLabel: string;
}

const METRICS: Metric[] = [
    {
        id: 'glucose', name: 'Fasting Glucose', icon: 'water', iconColor: '#4FC3F7',
        value: '85', numericValue: 85, unit: 'mg/dL',
        min: 40, max: 200, normalLow: 70, normalHigh: 99,
        rangeLabel: 'Normal: 70–99', status: 'good', statusLabel: 'Good',
    },
    {
        id: 'hba1c', name: 'HbA1c', icon: 'fitness', iconColor: '#E57373',
        value: '6.2', numericValue: 6.2, unit: '%',
        min: 3, max: 12, normalLow: 4.0, normalHigh: 5.6,
        rangeLabel: 'Normal: < 5.7%', status: 'borderline', statusLabel: 'Borderline',
    },
    {
        id: 'bp', name: 'Systolic BP', icon: 'heart', iconColor: '#F06292',
        value: '118', numericValue: 118, unit: 'mmHg',
        min: 70, max: 200, normalLow: 90, normalHigh: 120,
        rangeLabel: 'Normal: 90–120', status: 'good', statusLabel: 'Good',
    },
    {
        id: 'cholesterol', name: 'Total Cholesterol', icon: 'pulse', iconColor: '#FFB74D',
        value: '245', numericValue: 245, unit: 'mg/dL',
        min: 100, max: 350, normalLow: 125, normalHigh: 200,
        rangeLabel: 'Normal: 125–200', status: 'high', statusLabel: 'High – Monitor',
    },
];

const STATUS_COLORS: Record<Metric['status'], { bg: string; text: string }> = {
    good: { bg: '#1B5E20', text: '#81C784' },
    low: { bg: '#E65100', text: '#FFB74D' },
    borderline: { bg: '#F57F17', text: '#FFF176' },
    high: { bg: '#B71C1C', text: '#EF9A9A' },
};

// ─── EDUCATIONAL CONTENT ────────────────────────────────────────────
const EDUCATION: Record<string, { title: string; bullets: string[]; }> = {
    glucose: {
        title: 'What is Fasting Glucose?',
        bullets: [
            'Measures blood sugar after 8+ hours of fasting',
            'Normal range for adults: 70–99 mg/dL',
            'Levels above 126 mg/dL may indicate diabetes',
            'Tips: limit sugar intake, exercise regularly, retest in 3 months',
        ],
    },
    hba1c: {
        title: 'What is HbA1c?',
        bullets: [
            'Measures average blood sugar over 2–3 months',
            'Normal for adults: below 5.7%',
            'High levels (> 6.5%) increase risk of fatigue, heart issues, kidney damage',
            'Tips: balanced diet, regular exercise, retest in 3 months',
        ],
    },
    bp: {
        title: 'What is Systolic BP?',
        bullets: [
            'Top number in blood pressure reading (pressure when heart beats)',
            'Normal: below 120 mmHg',
            'Elevated: 120–129 mmHg; High: 130+ mmHg',
            'Tips: reduce sodium, manage stress, stay active',
        ],
    },
    cholesterol: {
        title: 'What is Total Cholesterol?',
        bullets: [
            'Measures all types of cholesterol in your blood',
            'Desirable: below 200 mg/dL',
            'Borderline high: 200–239; High: 240+',
            'Tips: eat healthy fats, exercise, avoid processed foods',
        ],
    },
};

// Trend data
const TREND_TABS = ['Glucose', 'HbA1c', 'BP', 'Cholesterol'] as const;
type TrendTab = (typeof TREND_TABS)[number];

const TREND_DATA: Record<TrendTab, { labels: string[]; values: number[] }> = {
    Glucose: { labels: ['Jan 10', 'Feb 05', 'Mar 01', 'Apr 20'], values: [102, 95, 85, 82] },
    HbA1c: { labels: ['Jan 10', 'Feb 05', 'Mar 01', 'Apr 20'], values: [7.1, 6.8, 6.2, 6.0] },
    BP: { labels: ['Jan 10', 'Feb 05', 'Mar 01', 'Apr 20'], values: [135, 128, 122, 118] },
    Cholesterol: { labels: ['Jan 10', 'Feb 05', 'Mar 01', 'Apr 20'], values: [260, 255, 248, 245] },
};

// ─── TRI-ZONE PROGRESS BAR ─────────────────────────────────────────
const ZonedProgressBar: React.FC<{
    value: number; min: number; max: number;
    normalLow: number; normalHigh: number;
    rangeLabel: string; currentLabel: string;
}> = ({ value, min, max, normalLow, normalHigh, rangeLabel, currentLabel }) => {
    const totalRange = max - min;
    const lowW = ((normalLow - min) / totalRange) * 100;
    const normW = ((normalHigh - normalLow) / totalRange) * 100;
    const highW = ((max - normalHigh) / totalRange) * 100;
    const fill = Math.max(0, Math.min(100, ((value - min) / totalRange) * 100));

    return (
        <View style={{ marginTop: 14 }}>
            <View style={zs.track}>
                <View style={[zs.zoneLow, { width: `${lowW}%` }]} />
                <View style={[zs.zoneNorm, { width: `${normW}%` }]} />
                <View style={[zs.zoneHigh, { width: `${highW}%` }]} />
                <View style={[zs.fill, { width: `${fill}%` }]}>
                    <LinearGradient
                        colors={['rgba(0,212,170,0.85)', 'rgba(0,184,148,0.65)']}
                        start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                        style={{ flex: 1, borderRadius: 10 }}
                    />
                </View>
                <View style={[zs.dot, { left: `${fill}%` }]} />
            </View>
            <Text style={zs.label}>Current: {currentLabel}  •  {rangeLabel}</Text>
        </View>
    );
};

const zs = StyleSheet.create({
    track: { height: 20, borderRadius: 10, flexDirection: 'row', overflow: 'hidden', position: 'relative' },
    zoneLow: { backgroundColor: 'rgba(255,152,0,0.25)' },
    zoneNorm: { backgroundColor: 'rgba(76,175,80,0.30)' },
    zoneHigh: { backgroundColor: 'rgba(244,67,54,0.25)' },
    fill: { position: 'absolute', left: 0, top: 0, bottom: 0, borderRadius: 10 },
    dot: {
        position: 'absolute', top: -2, width: 6, height: 24, borderRadius: 3,
        backgroundColor: '#FFF', marginLeft: -3,
        shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.4, shadowRadius: 4, elevation: 4,
    },
    label: { fontSize: 12, color: theme.colors.textMuted, marginTop: 8, letterSpacing: 0.2 },
});

// ─── METRIC CARD ────────────────────────────────────────────────────
const MetricCard: React.FC<{ metric: Metric; onInfo: () => void }> = ({ metric, onInfo }) => {
    const sc = STATUS_COLORS[metric.status];
    return (
        <View style={cs.card}>
            <View style={cs.row}>
                <View style={cs.left}>
                    <View style={[cs.icon, { backgroundColor: metric.iconColor + '20' }]}>
                        <Ionicons name={metric.icon} size={20} color={metric.iconColor} />
                    </View>
                    <Text style={cs.name}>{metric.name}</Text>
                </View>
                <TouchableOpacity onPress={onInfo} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
                    <Ionicons name="information-circle-outline" size={22} color={theme.colors.textMuted} />
                </TouchableOpacity>
            </View>
            <Text style={cs.big}>{metric.value} <Text style={cs.unit}>{metric.unit}</Text></Text>
            <ZonedProgressBar
                value={metric.numericValue} min={metric.min} max={metric.max}
                normalLow={metric.normalLow} normalHigh={metric.normalHigh}
                rangeLabel={metric.rangeLabel}
                currentLabel={`${metric.value} ${metric.unit}`}
            />
            <View style={[cs.pill, { backgroundColor: sc.bg }]}>
                <Text style={[cs.pillT, { color: sc.text }]}>{metric.statusLabel}</Text>
            </View>
        </View>
    );
};

const cs = StyleSheet.create({
    card: {
        backgroundColor: theme.colors.bgCard, borderRadius: 20, padding: 20, marginBottom: 16,
        borderWidth: 1, borderColor: theme.colors.border, ...theme.shadow.card,
    },
    row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    left: { flexDirection: 'row', alignItems: 'center' },
    icon: { width: 36, height: 36, borderRadius: 18, justifyContent: 'center', alignItems: 'center', marginRight: 10 },
    name: { fontSize: 18, fontWeight: '700', color: theme.colors.text } as any,
    big: { fontSize: 40, fontWeight: '800', color: theme.colors.text, marginTop: 12, letterSpacing: -1 } as any,
    unit: { fontSize: 18, fontWeight: '500', color: theme.colors.textMuted } as any,
    pill: { alignSelf: 'flex-start', paddingHorizontal: 14, paddingVertical: 6, borderRadius: 14, marginTop: 14 },
    pillT: { fontSize: 13, fontWeight: '700', letterSpacing: 0.3 } as any,
});

// ─── EDUCATIONAL MODAL ──────────────────────────────────────────────
const EducationalModal: React.FC<{ metricId: string | null; onClose: () => void }> = ({
    metricId,
    onClose,
}) => {
    const edu = metricId ? EDUCATION[metricId] : null;
    if (!edu) return null;

    return (
        <Modal visible={!!metricId} transparent animationType="fade" onRequestClose={onClose}>
            <View style={ms.overlay}>
                <View style={ms.card}>
                    <TouchableOpacity style={ms.close} onPress={onClose}>
                        <Ionicons name="close" size={24} color={theme.colors.textMuted} />
                    </TouchableOpacity>
                    <Text style={ms.title}>{edu.title}</Text>
                    {edu.bullets.map((b, i) => (
                        <View key={i} style={ms.brow}>
                            <Ionicons name="ellipse" size={6} color={theme.colors.accent} style={{ marginTop: 7 }} />
                            <Text style={ms.btext}>{b}</Text>
                        </View>
                    ))}
                    <View style={ms.divider} />
                    <Text style={ms.disc}>⚕️  Always consult your doctor for medical advice.</Text>
                </View>
            </View>
        </Modal>
    );
};

const ms = StyleSheet.create({
    overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'center', alignItems: 'center', padding: 24 },
    card: {
        backgroundColor: theme.colors.bgCard, borderRadius: 28, padding: 28, width: '100%', maxWidth: 360,
        borderWidth: 1, borderColor: theme.colors.borderLight, ...theme.shadow.card,
    },
    close: {
        position: 'absolute', top: 16, right: 16, zIndex: 10,
        width: 36, height: 36, borderRadius: 18,
        backgroundColor: theme.colors.glassLight, justifyContent: 'center', alignItems: 'center',
    },
    title: { fontSize: 22, fontWeight: '700', color: theme.colors.text, marginBottom: 20 } as any,
    brow: { flexDirection: 'row', marginBottom: 12, gap: 10, paddingRight: 8 },
    btext: { flex: 1, fontSize: 15, color: theme.colors.textSecondary, lineHeight: 22 },
    divider: { height: 1, backgroundColor: theme.colors.border, marginVertical: 18 },
    disc: { fontSize: 12, color: theme.colors.textMuted, textAlign: 'center', fontStyle: 'italic' },
});

// ─── TRENDS SECTION ─────────────────────────────────────────────────
const TrendsSection: React.FC = () => {
    const [tab, setTab] = useState<TrendTab>('Glucose');
    const td = TREND_DATA[tab];
    const chartW = SCREEN_WIDTH - 64;

    return (
        <View style={ts.card}>
            <Text style={ts.title}>Trends – Last 4 Reports</Text>
            <View style={ts.tabRow}>
                {TREND_TABS.map((t) => (
                    <TouchableOpacity
                        key={t}
                        style={[ts.tab, tab === t && ts.tabA]}
                        onPress={() => setTab(t)}
                    >
                        <Text style={[ts.tabT, tab === t && ts.tabTA]}>{t}</Text>
                    </TouchableOpacity>
                ))}
            </View>
            <View style={ts.chartWrap}>
                <LineChart
                    data={{ labels: td.labels, datasets: [{ data: td.values, strokeWidth: 3 }] }}
                    width={chartW} height={220}
                    chartConfig={{
                        backgroundColor: 'transparent',
                        backgroundGradientFrom: theme.colors.bgCard,
                        backgroundGradientTo: theme.colors.bgCard,
                        decimalPlaces: tab === 'HbA1c' ? 1 : 0,
                        color: (o = 1) => `rgba(0,212,170,${o})`,
                        labelColor: (o = 1) => `rgba(160,176,192,${o})`,
                        propsForLabels: { fontSize: 10 },
                        propsForDots: { r: '5', strokeWidth: '2', stroke: theme.colors.accent },
                        propsForBackgroundLines: { strokeDasharray: '5, 5', strokeWidth: 1, stroke: 'rgba(255,255,255,0.06)' },
                    }}
                    bezier withInnerLines withVerticalLines={false} segments={4}
                    style={{ borderRadius: 16 }}
                />
                <View style={ts.ann}>
                    <Ionicons name="trending-up" size={14} color="#4CAF50" />
                    <Text style={ts.annT}>Improved since last</Text>
                </View>
            </View>
        </View>
    );
};

const ts = StyleSheet.create({
    card: {
        backgroundColor: theme.colors.bgCard, borderRadius: 20, padding: 20, marginBottom: 16,
        borderWidth: 1, borderColor: theme.colors.border, ...theme.shadow.card,
    },
    title: { fontSize: 20, fontWeight: '700', color: theme.colors.text, marginBottom: 16 } as any,
    tabRow: { flexDirection: 'row', backgroundColor: theme.colors.bgDark, borderRadius: 12, padding: 3, marginBottom: 16 },
    tab: { flex: 1, paddingVertical: 9, alignItems: 'center', borderRadius: 10 },
    tabA: { backgroundColor: theme.colors.accent },
    tabT: { fontSize: 12, fontWeight: '600', color: theme.colors.textMuted } as any,
    tabTA: { color: theme.colors.bgDark },
    chartWrap: { alignItems: 'center', position: 'relative' },
    ann: {
        position: 'absolute', top: 8, right: 12,
        flexDirection: 'row', alignItems: 'center',
        backgroundColor: 'rgba(76,175,80,0.15)',
        paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10,
    },
    annT: { fontSize: 12, fontWeight: '600', color: '#4CAF50', marginLeft: 4 } as any,
});

// ─── MAIN SCREEN ────────────────────────────────────────────────────
const ReportDetailScreen = ({ navigation, route }: any) => {
    const reportDate = route?.params?.date ?? 'Apr 20, 2026';
    const reportScore = route?.params?.score ?? 78;
    const [infoMetric, setInfoMetric] = useState<string | null>(null);

    return (
        <GradientBackground style={{ flex: 1 }}>
            <StatusBar barStyle="light-content" />

            {/* Header */}
            <View style={hdr.bar}>
                <TouchableOpacity style={hdr.back} onPress={() => navigation.goBack()}>
                    <Ionicons name="chevron-back" size={24} color={theme.colors.text} />
                </TouchableOpacity>
                <Text style={hdr.title}>Report – {reportDate}</Text>
                <View style={{ width: 40 }} />
            </View>

            <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 12 }} showsVerticalScrollIndicator={false}>
                {/* Score banner */}
                <LinearGradient
                    colors={['rgba(0,212,170,0.14)', 'rgba(0,184,148,0.04)', 'transparent']}
                    style={hdr.banner}
                >
                    <View style={hdr.bannerLeft}>
                        <Text style={hdr.bannerScore}>{reportScore}%</Text>
                        <View style={{ marginLeft: 8 }}>
                            <Text style={hdr.bannerLabel}>Report Score</Text>
                            <Text style={hdr.bannerSub}>{reportDate}</Text>
                        </View>
                    </View>
                    <View style={hdr.trendBadge}>
                        <Ionicons name="trending-up" size={16} color="#4CAF50" />
                    </View>
                </LinearGradient>

                {/* Metric cards */}
                <Text style={hdr.section}>METRICS</Text>
                {METRICS.map((m) => (
                    <MetricCard key={m.id} metric={m} onInfo={() => setInfoMetric(m.id)} />
                ))}

                {/* Trends */}
                <Text style={hdr.section}>TRENDS</Text>
                <TrendsSection />

                {/* Bottom actions */}
                <View style={hdr.actions}>
                    <TouchableOpacity style={hdr.actionBtn} activeOpacity={0.8}>
                        <Ionicons name="document-text-outline" size={18} color={theme.colors.accent} />
                        <Text style={hdr.actionText}>Export PDF</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={hdr.actionBtn} activeOpacity={0.8}>
                        <Ionicons name="git-compare-outline" size={18} color={theme.colors.accent} />
                        <Text style={hdr.actionText}>Compare with Previous</Text>
                    </TouchableOpacity>
                </View>

                <View style={{ height: 30 }} />
            </ScrollView>

            <EducationalModal metricId={infoMetric} onClose={() => setInfoMetric(null)} />
        </GradientBackground>
    );
};

const hdr = StyleSheet.create({
    bar: {
        flexDirection: 'row', alignItems: 'center',
        paddingTop: 54, paddingHorizontal: 16, paddingBottom: 14,
        borderBottomWidth: 1, borderBottomColor: theme.colors.border,
    },
    back: {
        width: 40, height: 40, borderRadius: 20,
        backgroundColor: theme.colors.glassLight, justifyContent: 'center', alignItems: 'center',
        borderWidth: 1, borderColor: theme.colors.border,
    },
    title: {
        flex: 1, textAlign: 'center',
        fontSize: 18, fontWeight: '700', color: theme.colors.text,
    } as any,
    banner: {
        flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
        borderRadius: 20, padding: 20, marginBottom: 20,
        borderWidth: 1, borderColor: theme.colors.border,
    },
    bannerLeft: { flexDirection: 'row', alignItems: 'center' },
    bannerScore: { fontSize: 42, fontWeight: '900', color: theme.colors.text, letterSpacing: -2 } as any,
    bannerLabel: { fontSize: 16, fontWeight: '600', color: theme.colors.textSecondary } as any,
    bannerSub: { fontSize: 12, color: theme.colors.textMuted, marginTop: 2 },
    trendBadge: {
        width: 36, height: 36, borderRadius: 18,
        backgroundColor: 'rgba(76,175,80,0.15)', justifyContent: 'center', alignItems: 'center',
    },
    section: { ...theme.typography.label, marginBottom: 14, marginTop: 8 },
    actions: {
        flexDirection: 'row', gap: 12, marginTop: 8,
    },
    actionBtn: {
        flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
        gap: 8, backgroundColor: theme.colors.bgCard,
        borderRadius: 14, paddingVertical: 14,
        borderWidth: 1, borderColor: theme.colors.border,
    },
    actionText: { fontSize: 14, fontWeight: '600', color: theme.colors.accent } as any,
});

export default ReportDetailScreen;
