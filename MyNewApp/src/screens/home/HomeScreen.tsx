
import React, { useState, useCallback } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    TouchableOpacity,
    StatusBar,
    Dimensions,
    ActivityIndicator,
    Alert,
} from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as DocumentPicker from 'expo-document-picker';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import GradientBackground from '../../components/GradientBackground';
import { theme } from '../../theme';
import { reportsAPI } from '../../services/api';

const { width: SCREEN_W } = Dimensions.get('window');

// ─── FEATURE CARDS DATA ─────────────────────────────────────────────
interface FeatureCard {
    id: string;
    title: string;
    subtitle: string;
    icon: keyof typeof Ionicons.glyphMap;
    gradient: [string, string];
    iconColor: string;
    route?: string;         // stack screen name inside DashboardStack or tab name
    isTab?: boolean;        // navigate to a sibling tab
    size: 'large' | 'small';
}

const FEATURES: FeatureCard[] = [
    {
        id: 'reports',
        title: 'Health Reports',
        subtitle: 'Upload & manage lab reports',
        icon: 'document-text',
        gradient: ['rgba(0,212,170,0.20)', 'rgba(0,184,148,0.06)'],
        iconColor: '#00D4AA',
        route: 'ReportHistory',
        size: 'large',
    },
    {
        id: 'dashboard',
        title: 'Dashboard',
        subtitle: 'Health score & metrics',
        icon: 'analytics',
        gradient: ['rgba(79,195,247,0.20)', 'rgba(41,128,185,0.06)'],
        iconColor: '#4FC3F7',
        route: 'DashboardView',
        size: 'large',
    },
    {
        id: 'chat',
        title: 'AI Chat',
        subtitle: 'Ask about your health',
        icon: 'chatbubble-ellipses',
        gradient: ['rgba(186,104,200,0.20)', 'rgba(142,68,173,0.06)'],
        iconColor: '#BA68C8',
        route: 'Chat',
        isTab: true,
        size: 'small',
    },
    {
        id: 'visualize',
        title: 'Knowledge Graph',
        subtitle: 'Interactive health map',
        icon: 'globe',
        gradient: ['rgba(255,183,77,0.20)', 'rgba(243,156,18,0.06)'],
        iconColor: '#FFB74D',
        route: 'Web',
        isTab: true,
        size: 'small',
    },
    {
        id: 'upload',
        title: 'Upload Docs',
        subtitle: 'OCR medical docs',
        icon: 'cloud-upload',
        gradient: ['rgba(0,212,170,0.15)', 'rgba(0,184,148,0.05)'],
        iconColor: '#00D4AA',
        route: 'Upload',
        isTab: true,
        size: 'small',
    },
    {
        id: 'stats',
        title: 'Health Stats',
        subtitle: 'Smartwatch analytics',
        icon: 'pulse',
        gradient: ['rgba(239,83,80,0.20)', 'rgba(211,47,47,0.06)'],
        iconColor: '#EF5350',
        route: 'Stats',
        isTab: true,
        size: 'small',
    },
    {
        id: 'fitbit',
        title: 'Fitbit Insights',
        subtitle: 'Energy, sleep & nudges',
        icon: 'watch',
        gradient: ['rgba(129,199,132,0.20)', 'rgba(76,175,80,0.06)'],
        iconColor: '#81C784',
        route: 'FitbitInsights',
        size: 'small',
    },
    {
        id: 'qr',
        title: 'QR Profile',
        subtitle: 'Share health profile',
        icon: 'qr-code',
        gradient: ['rgba(100,181,246,0.20)', 'rgba(30,136,229,0.06)'],
        iconColor: '#64B5F6',
        route: 'QR',
        isTab: true,
        size: 'small',
    },
    {
        id: 'doctor',
        title: 'Consult Doctor',
        subtitle: 'Book appointments',
        icon: 'medkit',
        gradient: ['rgba(240,98,146,0.20)', 'rgba(233,30,99,0.06)'],
        iconColor: '#F06292',
        route: 'Doctor',
        size: 'small',
    },
];

// ─── HOME SCREEN ────────────────────────────────────────────────────
const HomeScreen = () => {
    const navigation = useNavigation<any>();
    const [uploading, setUploading] = useState(false);
    const [recentCount, setRecentCount] = useState(0);

    useFocusEffect(
        useCallback(() => {
            (async () => {
                try {
                    const phone = await AsyncStorage.getItem('user_phone');
                    if (phone) {
                        const res = await reportsAPI.list(phone);
                        setRecentCount(res.data.reports?.length || 0);
                    }
                } catch { }
            })();
        }, [])
    );

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
            formData.append('file', { uri: file.uri, name: file.name || 'report.pdf', type: file.mimeType || 'application/pdf' } as any);
            formData.append('user_phone', userPhone);
            await reportsAPI.upload(formData);
            Alert.alert('Upload Started', `${file.name} is being processed.`);
        } catch (e: any) {
            Alert.alert('Upload Failed', e.message || 'Something went wrong');
        } finally {
            setUploading(false);
        }
    };

    const navigateToFeature = (feature: FeatureCard) => {
        if (!feature.route) return;
        if (feature.route === 'Doctor') {
            // Doctor is on the root stack, need to go up
            navigation.getParent()?.getParent()?.navigate('Doctor');
            return;
        }
        if (feature.isTab) {
            // Jump to sibling tab
            navigation.getParent()?.navigate(feature.route);
            return;
        }
        // Navigate within DashboardStack
        navigation.navigate(feature.route);
    };

    const renderFeatureCard = (feature: FeatureCard) => {
        const isLarge = feature.size === 'large';
        return (
            <TouchableOpacity
                key={feature.id}
                activeOpacity={0.85}
                onPress={() => navigateToFeature(feature)}
                style={[styles.featureCard, isLarge ? styles.featureCardLarge : styles.featureCardSmall]}
            >
                <LinearGradient
                    colors={feature.gradient as [string, string]}
                    style={[styles.featureGradient, isLarge && styles.featureGradientLarge]}
                >
                    {/* Icon circle */}
                    <View style={[styles.featureIconCircle, { backgroundColor: feature.iconColor + '20' }]}>
                        <Ionicons name={feature.icon} size={isLarge ? 28 : 24} color={feature.iconColor} />
                    </View>

                    <View style={styles.featureText}>
                        <Text style={[styles.featureTitle, isLarge && { fontSize: 18 }]}>{feature.title}</Text>
                        <Text style={styles.featureSub}>{feature.subtitle}</Text>
                    </View>

                    {/* Chevron */}
                    <Ionicons name="chevron-forward" size={16} color={theme.colors.textMuted} style={{ marginLeft: 'auto' }} />
                </LinearGradient>
            </TouchableOpacity>
        );
    };

    return (
        <GradientBackground style={styles.container}>
            <StatusBar barStyle="light-content" />

            {/* ── HEADER ──────────────────────────── */}
            <View style={styles.header}>
                <View>
                    <Text style={styles.greeting}>Welcome back 👋</Text>
                    <Text style={styles.headerTitle}>HealthLink</Text>
                </View>
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

                {/* ── HERO UPLOAD BANNER ──────────────── */}
                <TouchableOpacity activeOpacity={0.85} onPress={handleUpload} disabled={uploading}>
                    <LinearGradient
                        colors={[theme.colors.accent, theme.colors.accentDark]}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 0 }}
                        style={styles.heroBanner}
                    >
                        <View style={styles.heroLeft}>
                            {uploading ? (
                                <ActivityIndicator color={theme.colors.bgDark} size="small" />
                            ) : (
                                <Ionicons name="add-circle" size={38} color={theme.colors.bgDark} />
                            )}
                            <View style={{ marginLeft: 14 }}>
                                <Text style={styles.heroTitle}>{uploading ? 'Uploading...' : 'Upload Lab Report'}</Text>
                                <Text style={styles.heroSub}>PDF or image • OCR powered</Text>
                            </View>
                        </View>
                        <View style={styles.heroBadge}>
                            <Text style={styles.heroBadgeText}>{recentCount}</Text>
                            <Text style={styles.heroBadgeLabel}>reports</Text>
                        </View>
                    </LinearGradient>
                </TouchableOpacity>

                {/* ── LARGE FEATURE CARDS (2 side by side) ─── */}
                <Text style={styles.sectionLabel}>CORE FEATURES</Text>
                <View style={styles.largeRow}>
                    {FEATURES.filter((f) => f.size === 'large').map(renderFeatureCard)}
                </View>

                {/* ── SMALL FEATURE GRID ──────────────── */}
                <Text style={styles.sectionLabel}>ALL SERVICES</Text>
                <View style={styles.gridWrap}>
                    {FEATURES.filter((f) => f.size === 'small').map(renderFeatureCard)}
                </View>

                <View style={{ height: 30 }} />
            </ScrollView>
        </GradientBackground>
    );
};

// ─── STYLES ─────────────────────────────────────────────────────────
const CARD_GAP = 10;
const SMALL_W = (SCREEN_W - 32 - CARD_GAP) / 2;

const styles = StyleSheet.create({
    container: { flex: 1 },

    /* Header */
    header: {
        flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
        paddingTop: 54, paddingHorizontal: 20, paddingBottom: 14,
        borderBottomWidth: 1, borderBottomColor: theme.colors.border,
    },
    greeting: { fontSize: 14, color: theme.colors.textMuted, marginBottom: 2 },
    headerTitle: { fontSize: 28, fontWeight: '800', color: theme.colors.text, letterSpacing: -0.5 } as any,
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

    /* Hero banner */
    heroBanner: {
        flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
        borderRadius: 20, padding: 20, marginBottom: 24,
        ...theme.shadow.glow,
    },
    heroLeft: { flexDirection: 'row', alignItems: 'center' },
    heroTitle: { fontSize: 18, fontWeight: '700', color: theme.colors.bgDark } as any,
    heroSub: { fontSize: 12, color: 'rgba(11,17,32,0.6)', marginTop: 2 },
    heroBadge: {
        alignItems: 'center', backgroundColor: 'rgba(11,17,32,0.15)',
        borderRadius: 14, paddingHorizontal: 14, paddingVertical: 8,
    },
    heroBadgeText: { fontSize: 22, fontWeight: '800', color: theme.colors.bgDark } as any,
    heroBadgeLabel: { fontSize: 10, fontWeight: '600', color: 'rgba(11,17,32,0.6)' } as any,

    /* Section label */
    sectionLabel: { ...theme.typography.label, marginBottom: 14, marginTop: 8 },

    /* Large cards row */
    largeRow: { flexDirection: 'row', gap: CARD_GAP, marginBottom: 20 },

    /* Grid */
    gridWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: CARD_GAP },

    /* Feature cards */
    featureCard: { borderWidth: 1, borderColor: theme.colors.border, borderRadius: 20, overflow: 'hidden' },
    featureCardLarge: { flex: 1 },
    featureCardSmall: { width: SMALL_W },

    featureGradient: { padding: 16, minHeight: 100, justifyContent: 'center' },
    featureGradientLarge: { padding: 20, minHeight: 120 },

    featureIconCircle: {
        width: 44, height: 44, borderRadius: 22,
        justifyContent: 'center', alignItems: 'center', marginBottom: 10,
    },
    featureText: {},
    featureTitle: { fontSize: 15, fontWeight: '700', color: theme.colors.text, marginBottom: 3 } as any,
    featureSub: { fontSize: 11, color: theme.colors.textMuted, lineHeight: 15 },
});

export default HomeScreen;
