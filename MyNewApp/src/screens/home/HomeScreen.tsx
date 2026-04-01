
import React, { useState, useCallback } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    TouchableOpacity,
    StatusBar,
    Dimensions,
    Modal,
    ActivityIndicator,
    FlatList,
} from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import GradientBackground from '../../components/GradientBackground';
import { theme } from '../../theme';
import { BASE_URL } from '../../config/host';

const { width: SCREEN_W } = Dimensions.get('window');

// ─── FEATURE CARDS ──────────────────────────────────────────────────
interface FeatureCard {
    id: string;
    title: string;
    subtitle: string;
    icon: keyof typeof Ionicons.glyphMap;
    iconColor: string;
    route?: string;
    isTab?: boolean;
}

const FEATURES: FeatureCard[] = [
    {
        id: 'dashboard',
        title: 'Dashboard',
        subtitle: 'Health score & metrics',
        icon: 'analytics',
        iconColor: '#4FC3F7',
        route: 'DashboardView',
    },
    {
        id: 'chat',
        title: 'AI Chat',
        subtitle: 'Ask about your health',
        icon: 'chatbubble-ellipses',
        iconColor: '#BA68C8',
        route: 'Chat',
        isTab: true,
    },
    {
        id: 'visualize',
        title: 'Knowledge Graph',
        subtitle: 'Interactive health map',
        icon: 'globe',
        iconColor: '#FFB74D',
        route: 'Web',
        isTab: true,
    },
    {
        id: 'upload',
        title: 'Upload Docs',
        subtitle: 'OCR medical docs',
        icon: 'cloud-upload',
        iconColor: '#00C9A7',
        route: 'Upload',
        isTab: true,
    },
    {
        id: 'stats',
        title: 'Health Stats',
        subtitle: 'Smartwatch analytics',
        icon: 'pulse',
        iconColor: '#EF5350',
        route: 'Stats',
        isTab: true,
    },
    {
        id: 'qr',
        title: 'QR Profile',
        subtitle: 'Share health profile',
        icon: 'qr-code',
        iconColor: '#64B5F6',
        route: 'QR',
        isTab: true,
    },
];

// ─── HOME SCREEN ────────────────────────────────────────────────────
const HomeScreen = () => {
    const navigation = useNavigation<any>();
    const [notifVisible, setNotifVisible] = useState(false);
    const [nudges, setNudges] = useState<string[]>([]);
    const [nudgesLoading, setNudgesLoading] = useState(false);
    const [nudgeCount, setNudgeCount] = useState(0);

    useFocusEffect(
        useCallback(() => {
            (async () => {
                try {
                    const res = await fetch(`${BASE_URL}/api/fitbit-insights`);
                    const data = await res.json();
                    if (data.status === 'success' && data.nudges) {
                        setNudges(data.nudges);
                        setNudgeCount(data.nudges.length);
                    }
                } catch { }
            })();
        }, [])
    );

    const openNotifications = async () => {
        setNotifVisible(true);
        setNudgesLoading(true);
        try {
            const res = await fetch(`${BASE_URL}/api/fitbit-insights`);
            const data = await res.json();
            if (data.status === 'success' && data.nudges) {
                setNudges(data.nudges);
                setNudgeCount(data.nudges.length);
            }
        } catch {
            setNudges([]);
        } finally {
            setNudgesLoading(false);
        }
    };

    const navigateToFeature = (feature: FeatureCard) => {
        if (!feature.route) return;
        if (feature.isTab) {
            navigation.getParent()?.navigate(feature.route);
            return;
        }
        navigation.navigate(feature.route);
    };

    const renderFeatureCard = (feature: FeatureCard) => (
        <TouchableOpacity
            key={feature.id}
            activeOpacity={0.75}
            onPress={() => navigateToFeature(feature)}
            style={styles.featureCard}
        >
            <View style={[styles.featureIconCircle, { backgroundColor: feature.iconColor + '18' }]}>
                <Ionicons name={feature.icon} size={22} color={feature.iconColor} />
            </View>
            <Text style={styles.featureTitle}>{feature.title}</Text>
            <Text style={styles.featureSub}>{feature.subtitle}</Text>
        </TouchableOpacity>
    );

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
                    <TouchableOpacity style={styles.headerIconBtn} onPress={openNotifications}>
                        <Ionicons name="notifications-outline" size={22} color={theme.colors.text} />
                        {nudgeCount > 0 && (
                            <View style={styles.notifBadge}>
                                <Text style={styles.notifBadgeText}>{nudgeCount > 9 ? '9+' : nudgeCount}</Text>
                            </View>
                        )}
                    </TouchableOpacity>
                    <View style={styles.avatar}>
                        <Ionicons name="person" size={18} color={theme.colors.accent} />
                    </View>
                </View>
            </View>

            <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
                <Text style={styles.sectionLabel}>ALL SERVICES</Text>
                <View style={styles.gridWrap}>
                    {FEATURES.map(renderFeatureCard)}
                </View>
                <View style={{ height: 100 }} />
            </ScrollView>

            {/* ── NOTIFICATIONS MODAL ──── */}
            <Modal visible={notifVisible} animationType="slide" transparent onRequestClose={() => setNotifVisible(false)}>
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <View style={styles.modalHeader}>
                            <Ionicons name="notifications" size={22} color={theme.colors.accent} />
                            <Text style={styles.modalTitle}>Notifications</Text>
                            <TouchableOpacity onPress={() => setNotifVisible(false)} style={styles.modalClose}>
                                <Ionicons name="close" size={22} color={theme.colors.textMuted} />
                            </TouchableOpacity>
                        </View>

                        {nudgesLoading ? (
                            <View style={{ padding: 40, alignItems: 'center' }}>
                                <ActivityIndicator color={theme.colors.accent} />
                                <Text style={{ color: theme.colors.textMuted, marginTop: 10 }}>Loading nudges...</Text>
                            </View>
                        ) : nudges.length === 0 ? (
                            <View style={{ padding: 40, alignItems: 'center' }}>
                                <Ionicons name="checkmark-circle-outline" size={48} color={theme.colors.textMuted} />
                                <Text style={{ color: theme.colors.textMuted, marginTop: 12, fontSize: 16, fontWeight: '600' } as any}>
                                    All caught up!
                                </Text>
                                <Text style={{ color: theme.colors.textMuted, marginTop: 4, fontSize: 13, textAlign: 'center' }}>
                                    Connect your Fitbit in Stats to get personalized nudges
                                </Text>
                            </View>
                        ) : (
                            <FlatList
                                data={nudges}
                                keyExtractor={(_, i) => String(i)}
                                showsVerticalScrollIndicator={false}
                                contentContainerStyle={{ paddingBottom: 20 }}
                                renderItem={({ item, index }) => (
                                    <View style={styles.nudgeCard}>
                                        <View style={[styles.nudgePriority, {
                                            backgroundColor: index < 2 ? 'rgba(239,83,80,0.15)' : index < 4 ? 'rgba(255,183,77,0.15)' : 'rgba(129,199,132,0.15)'
                                        }]}>
                                            <Ionicons
                                                name={index < 2 ? 'alert-circle' : index < 4 ? 'information-circle' : 'bulb'}
                                                size={18}
                                                color={index < 2 ? '#EF5350' : index < 4 ? '#FFB74D' : '#81C784'}
                                            />
                                        </View>
                                        <View style={{ flex: 1 }}>
                                            <Text style={styles.nudgeText}>{item}</Text>
                                            <Text style={styles.nudgeTime}>Just now • from Fitbit</Text>
                                        </View>
                                    </View>
                                )}
                            />
                        )}
                    </View>
                </View>
            </Modal>
        </GradientBackground>
    );
};

const CARD_GAP = 12;
const CARD_W = (SCREEN_W - 32 - CARD_GAP) / 2;

const styles = StyleSheet.create({
    container: { flex: 1 },

    header: {
        flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
        paddingTop: 48, paddingHorizontal: 20, paddingBottom: 16,
    },
    greeting: { fontSize: 13, color: theme.colors.textMuted, marginBottom: 2 },
    headerTitle: { fontSize: 24, fontWeight: '800', color: theme.colors.text, letterSpacing: -0.5 } as any,
    headerRight: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    headerIconBtn: {
        width: 40, height: 40, borderRadius: 20,
        backgroundColor: theme.colors.bgCard,
        justifyContent: 'center', alignItems: 'center',
    },
    notifBadge: {
        position: 'absolute', top: 2, right: 2,
        minWidth: 16, height: 16, borderRadius: 8,
        backgroundColor: '#F85149', justifyContent: 'center', alignItems: 'center',
        paddingHorizontal: 3, borderWidth: 1.5, borderColor: theme.colors.bgDark,
    },
    notifBadgeText: { fontSize: 9, fontWeight: '800', color: '#fff' } as any,
    avatar: {
        width: 40, height: 40, borderRadius: 20,
        backgroundColor: 'rgba(0,201,167,0.12)',
        justifyContent: 'center', alignItems: 'center',
    },

    scrollContent: { paddingHorizontal: 16, paddingTop: 8 },
    sectionLabel: { ...theme.typography.label, marginBottom: 14 },
    gridWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: CARD_GAP },

    featureCard: {
        width: CARD_W,
        backgroundColor: theme.colors.bgCard,
        borderRadius: theme.borderRadius.m,
        padding: 16,
        minHeight: 120,
        ...theme.shadow.card,
    },
    featureIconCircle: {
        width: 42, height: 42, borderRadius: 14,
        justifyContent: 'center', alignItems: 'center', marginBottom: 12,
    },
    featureTitle: { fontSize: 15, fontWeight: '700', color: theme.colors.text, marginBottom: 3 } as any,
    featureSub: { fontSize: 11, color: theme.colors.textMuted, lineHeight: 15 },

    /* Notification modal */
    modalOverlay: {
        flex: 1, backgroundColor: 'rgba(0,0,0,0.6)',
        justifyContent: 'flex-start',
    },
    modalContent: {
        backgroundColor: theme.colors.bgCard,
        borderBottomLeftRadius: 24, borderBottomRightRadius: 24,
        maxHeight: '70%', minHeight: 200,
        paddingTop: 48,
    },
    modalHeader: {
        flexDirection: 'row', alignItems: 'center',
        paddingHorizontal: 20, paddingVertical: 14,
        borderBottomWidth: 1, borderBottomColor: theme.colors.border, gap: 10,
    },
    modalTitle: { flex: 1, fontSize: 20, fontWeight: '700', color: theme.colors.text } as any,
    modalClose: {
        width: 36, height: 36, borderRadius: 18,
        backgroundColor: theme.colors.bgCardLight, justifyContent: 'center', alignItems: 'center',
    },
    nudgeCard: {
        flexDirection: 'row', alignItems: 'flex-start',
        paddingHorizontal: 20, paddingVertical: 14,
        borderBottomWidth: 1, borderBottomColor: theme.colors.border, gap: 12,
    },
    nudgePriority: {
        width: 36, height: 36, borderRadius: 18,
        justifyContent: 'center', alignItems: 'center', marginTop: 2,
    },
    nudgeText: { fontSize: 14, color: theme.colors.text, lineHeight: 20 },
    nudgeTime: { fontSize: 11, color: theme.colors.textMuted, marginTop: 4 },
});

export default HomeScreen;
