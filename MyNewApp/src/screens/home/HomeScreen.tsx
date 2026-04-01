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
    RefreshControl,
} from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import GradientBackground from '../../components/GradientBackground';
import ProgressRing from '../../components/ProgressRing';
import LearningPath from '../../components/LearningPath';
import { theme } from '../../theme';
import { BASE_URL } from '../../config/host';
import { MOCK_CHAPTERS, ChapterData } from '../../data/mockLessons';
import { getLearningState, LearningState } from '../../services/learningStore';
import AsyncStorage from '@react-native-async-storage/async-storage';

const { width: SCREEN_W } = Dimensions.get('window');

// ─── DAILY TASKS DATA ──────────────────────────────────────────────
interface DailyTasks {
    steps: { current: number; goal: number };
    sleep: { hours: number; goal: number };
    heart_rate: { resting_bpm: number; status: string };
    spo2: { value: number; status: string };
    medications: string[];
    energy_level: string;
}

const defaultTasks: DailyTasks = {
    steps: { current: 0, goal: 10000 },
    sleep: { hours: 0, goal: 8 },
    heart_rate: { resting_bpm: 0, status: 'normal' },
    spo2: { value: 0, status: 'normal' },
    medications: [],
    energy_level: 'average',
};

// ─── HOME SCREEN ────────────────────────────────────────────────────
const HomeScreen = () => {
    const navigation = useNavigation<any>();

    // State
    const [dailyTasks, setDailyTasks] = useState<DailyTasks>(defaultTasks);
    const [learningState, setLearningState] = useState<LearningState>({
        totalXP: 0,
        streakDays: 0,
        lastActiveDate: null,
        completedChapters: [],
        completedQuizzes: {},
    });
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [notifVisible, setNotifVisible] = useState(false);
    const [nudges, setNudges] = useState<string[]>([]);
    const [nudgesLoading, setNudgesLoading] = useState(false);
    const [nudgeCount, setNudgeCount] = useState(0);



    const fetchData = async () => {
        try {
            // Get user phone from AsyncStorage
            const userPhone = await AsyncStorage.getItem('userPhone') || '0000000000';

            // Fetch daily tasks from backend
            const res = await fetch(`${BASE_URL}/api/daily-tasks/${encodeURIComponent(userPhone)}`);
            const data = await res.json();
            if (data.status === 'success') {
                setDailyTasks({
                    steps: data.steps || defaultTasks.steps,
                    sleep: data.sleep || defaultTasks.sleep,
                    heart_rate: data.heart_rate || defaultTasks.heart_rate,
                    spo2: data.spo2 || defaultTasks.spo2,
                    medications: data.medications || [],
                    energy_level: data.energy_level || 'average',
                });
            }
        } catch (e) {
            console.log('Failed to fetch daily tasks, using defaults');
        }

        // Fetch learning state from AsyncStorage
        const ls = await getLearningState();
        setLearningState(ls);

        // Fetch nudge count
        try {
            const res = await fetch(`${BASE_URL}/api/fitbit-insights`);
            const data = await res.json();
            if (data.status === 'success' && data.nudges) {
                setNudges(data.nudges);
                setNudgeCount(data.nudges.length);
            }
        } catch { }

        setLoading(false);
    };

    useFocusEffect(
        useCallback(() => {
            fetchData();
        }, [])
    );



    const onRefresh = async () => {
        setRefreshing(true);
        await fetchData();
        setRefreshing(false);
    };

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

    const handleChapterPress = (chapter: ChapterData) => {
        navigation.navigate('Lesson', { chapterId: chapter.id });
    };

    // ─── Energy level badge ──────────────────────────────────────
    const energyConfig: Record<string, { color: string; icon: string; label: string }> = {
        high: { color: '#22c55e', icon: 'flash', label: 'High Energy' },
        average: { color: '#f59e0b', icon: 'flash-outline', label: 'Average' },
        low: { color: '#EF5350', icon: 'battery-half', label: 'Low Energy' },
    };
    const energy = energyConfig[dailyTasks.energy_level] || energyConfig.average;

    // ─── Calculate step/sleep/hr progress ────────────────────────
    const stepsProgress = dailyTasks.steps.goal > 0 ? dailyTasks.steps.current / dailyTasks.steps.goal : 0;
    const sleepProgress = dailyTasks.sleep.goal > 0 ? dailyTasks.sleep.hours / dailyTasks.sleep.goal : 0;
    // For heart rate, normalize: ideal is 60-80, show fullness based on how "normal" it is
    const hrNorm = dailyTasks.heart_rate.resting_bpm > 0
        ? Math.max(0, 1 - Math.abs(dailyTasks.heart_rate.resting_bpm - 70) / 40)
        : 0;

    if (loading) {
        return (
            <GradientBackground style={styles.container}>
                <StatusBar barStyle="light-content" />
                <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
                    <ActivityIndicator size="large" color={theme.colors.accent} />
                    <Text style={{ color: theme.colors.textMuted, marginTop: 12 }}>Loading your health data...</Text>
                </View>
            </GradientBackground>
        );
    }

    return (
        <GradientBackground style={styles.container}>
            <StatusBar barStyle="light-content" />

            {/* ── HEADER ─────────────────────────────── */}
            <View style={styles.header}>
                <View>
                    <Text style={styles.greeting}>Good {getGreeting()} 👋</Text>
                    <Text style={styles.headerTitle}>HealthLink</Text>
                </View>
                <View style={styles.headerRight}>
                    {/* XP Badge */}
                    <View style={styles.xpPill}>
                        <Ionicons name="flash" size={14} color="#f59e0b" />
                        <Text style={styles.xpText}>{learningState.totalXP}</Text>
                        {learningState.streakDays > 0 && (
                            <>
                                <View style={styles.xpDivider} />
                                <Text style={styles.streakText}>🔥 {learningState.streakDays}</Text>
                            </>
                        )}
                    </View>

                    {/* Notification Bell */}
                    <TouchableOpacity style={styles.headerIconBtn} onPress={openNotifications}>
                        <Ionicons name="notifications-outline" size={22} color={theme.colors.text} />
                        {nudgeCount > 0 && (
                            <View style={styles.notifBadge}>
                                <Text style={styles.notifBadgeText}>{nudgeCount > 9 ? '9+' : nudgeCount}</Text>
                            </View>
                        )}
                    </TouchableOpacity>

                    {/* Avatar */}
                    <View style={styles.avatar}>
                        <Ionicons name="person" size={18} color={theme.colors.accent} />
                    </View>
                </View>
            </View>

            <ScrollView
                style={{ flex: 1, overflow: 'auto' as any }}
                contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 120 }}
                showsVerticalScrollIndicator={false}
                refreshControl={
                    <RefreshControl
                        refreshing={refreshing}
                        onRefresh={onRefresh}
                        tintColor={theme.colors.accent}
                        colors={[theme.colors.accent]}
                    />
                }
            >
                {/* ── DAILY TASKS CARD ────────────────── */}
                <View style={styles.dailyCard}>
                    <View style={styles.dailyCardHeader}>
                        <View>
                            <Text style={styles.dailyTitle}>Today's Activity</Text>
                            <Text style={styles.dailySubtitle}>
                                {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}
                            </Text>
                        </View>
                        <View style={[styles.energyBadge, { backgroundColor: energy.color + '18' }]}>
                            <Ionicons name={energy.icon as any} size={14} color={energy.color} />
                            <Text style={[styles.energyText, { color: energy.color }]}>{energy.label}</Text>
                        </View>
                    </View>

                    {/* Progress Rings */}
                    <View style={styles.ringsRow}>
                        <ProgressRing
                            progress={stepsProgress}
                            size={80}
                            strokeWidth={7}
                            color="#22c55e"
                            label="Steps"
                            value={dailyTasks.steps.current > 0 ? formatNumber(dailyTasks.steps.current) : '—'}
                            subtitle={`/ ${formatNumber(dailyTasks.steps.goal)}`}
                        />
                        <ProgressRing
                            progress={sleepProgress}
                            size={80}
                            strokeWidth={7}
                            color="#BA68C8"
                            label="Sleep"
                            value={dailyTasks.sleep.hours > 0 ? `${dailyTasks.sleep.hours}h` : '—'}
                            subtitle={`/ ${dailyTasks.sleep.goal}h goal`}
                        />
                        <ProgressRing
                            progress={hrNorm}
                            size={80}
                            strokeWidth={7}
                            color="#EF5350"
                            label="Heart Rate"
                            value={dailyTasks.heart_rate.resting_bpm > 0 ? `${dailyTasks.heart_rate.resting_bpm}` : '—'}
                            subtitle="bpm"
                        />
                    </View>

                    {/* No data hint */}
                    {dailyTasks.steps.current === 0 && dailyTasks.sleep.hours === 0 && (
                        <Text style={{ fontSize: 11, color: theme.colors.textMuted, textAlign: 'center', marginBottom: 12 }}>
                            Connect your wearable in Stats tab for live data
                        </Text>
                    )}

                    {/* SpO2 Chip */}
                    {dailyTasks.spo2.value > 0 && (
                        <View style={styles.spo2Row}>
                            <View style={styles.spo2Chip}>
                                <Ionicons name="water" size={14} color="#4FC3F7" />
                                <Text style={styles.spo2Text}>SpO₂ {dailyTasks.spo2.value}%</Text>
                                <View style={[styles.statusDot, {
                                    backgroundColor: dailyTasks.spo2.status === 'normal' ? '#22c55e' : '#EF5350'
                                }]} />
                            </View>
                        </View>
                    )}

                    {/* Medications */}
                    {dailyTasks.medications.length > 0 && (
                        <View style={styles.medsSection}>
                            <View style={styles.medsSectionHeader}>
                                <Ionicons name="medical" size={16} color="#FFB74D" />
                                <Text style={styles.medsTitle}>Medications Today</Text>
                            </View>
                            {dailyTasks.medications.map((med, i) => (
                                <View key={i} style={styles.medPill}>
                                    <Ionicons name="ellipse" size={6} color={theme.colors.accent} />
                                    <Text style={styles.medText}>{med}</Text>
                                </View>
                            ))}
                        </View>
                    )}
                </View>

                {/* ── LEARNING PATH ───────────────────── */}
                <View>
                    <LearningPath
                        chapters={MOCK_CHAPTERS}
                        completedChapters={learningState.completedChapters}
                        onChapterPress={handleChapterPress}
                    />
                </View>


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

// ─── HELPERS ─────────────────────────────────────────────────────
function getGreeting(): string {
    const h = new Date().getHours();
    if (h < 12) return 'morning';
    if (h < 17) return 'afternoon';
    return 'evening';
}

function formatNumber(n: number): string {
    if (n >= 1000) return (n / 1000).toFixed(1).replace(/\.0$/, '') + 'k';
    return String(n);
}

// ─── STYLES ──────────────────────────────────────────────────────
const styles = StyleSheet.create({
    container: { flex: 1, overflow: 'scroll' as any },

    // Header
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingTop: 48,
        paddingHorizontal: 20,
        paddingBottom: 12,
    },
    greeting: {
        fontSize: 13,
        color: theme.colors.textMuted,
        marginBottom: 2,
    },
    headerTitle: {
        fontSize: 24,
        fontWeight: '800',
        color: theme.colors.text,
        letterSpacing: -0.5,
    } as any,
    headerRight: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
    },
    xpPill: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        backgroundColor: 'rgba(245,158,11,0.1)',
        paddingHorizontal: 10,
        paddingVertical: 6,
        borderRadius: 16,
    },
    xpText: {
        fontSize: 13,
        fontWeight: '700',
        color: '#f59e0b',
    },
    xpDivider: {
        width: 1,
        height: 12,
        backgroundColor: 'rgba(245,158,11,0.3)',
        marginHorizontal: 2,
    },
    streakText: {
        fontSize: 12,
        fontWeight: '600',
        color: '#f59e0b',
    },
    headerIconBtn: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: theme.colors.bgCard,
        justifyContent: 'center',
        alignItems: 'center',
    },
    notifBadge: {
        position: 'absolute',
        top: 2,
        right: 2,
        minWidth: 16,
        height: 16,
        borderRadius: 8,
        backgroundColor: '#F85149',
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: 3,
        borderWidth: 1.5,
        borderColor: theme.colors.bgDark,
    },
    notifBadgeText: {
        fontSize: 9,
        fontWeight: '800',
        color: '#fff',
    } as any,
    avatar: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: 'rgba(0,201,167,0.12)',
        justifyContent: 'center',
        alignItems: 'center',
    },

    // Scroll
    scrollContent: {
        paddingHorizontal: 16,
        paddingTop: 8,
    },

    // Daily Tasks Card
    dailyCard: {
        backgroundColor: theme.colors.bgCard,
        borderRadius: theme.borderRadius.l,
        padding: 20,
        ...theme.shadow.card,
        marginBottom: 8,
    },
    dailyCardHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 20,
    },
    dailyTitle: {
        fontSize: 18,
        fontWeight: '700',
        color: theme.colors.text,
    } as any,
    dailySubtitle: {
        fontSize: 12,
        color: theme.colors.textMuted,
        marginTop: 2,
    },
    energyBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 5,
        paddingHorizontal: 10,
        paddingVertical: 5,
        borderRadius: 12,
    },
    energyText: {
        fontSize: 11,
        fontWeight: '700',
    } as any,

    // Rings
    ringsRow: {
        flexDirection: 'row',
        justifyContent: 'space-around',
        alignItems: 'flex-start',
        marginBottom: 16,
    },

    // SpO2
    spo2Row: {
        flexDirection: 'row',
        justifyContent: 'center',
        marginBottom: 16,
    },
    spo2Chip: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        backgroundColor: 'rgba(79,195,247,0.08)',
        paddingHorizontal: 14,
        paddingVertical: 6,
        borderRadius: 20,
    },
    spo2Text: {
        fontSize: 13,
        fontWeight: '600',
        color: '#4FC3F7',
    } as any,
    statusDot: {
        width: 6,
        height: 6,
        borderRadius: 3,
    },

    // Medications
    medsSection: {
        borderTopWidth: 1,
        borderTopColor: theme.colors.border,
        paddingTop: 14,
    },
    medsSectionHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        marginBottom: 10,
    },
    medsTitle: {
        fontSize: 13,
        fontWeight: '700',
        color: '#FFB74D',
        letterSpacing: 0.5,
    } as any,
    medPill: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        paddingVertical: 6,
        paddingHorizontal: 4,
    },
    medText: {
        fontSize: 14,
        color: theme.colors.textSecondary,
    },

    // Modal
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.6)',
        justifyContent: 'flex-start',
    },
    modalContent: {
        backgroundColor: theme.colors.bgCard,
        borderBottomLeftRadius: 24,
        borderBottomRightRadius: 24,
        maxHeight: '70%',
        minHeight: 200,
        paddingTop: 48,
    },
    modalHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 20,
        paddingVertical: 14,
        borderBottomWidth: 1,
        borderBottomColor: theme.colors.border,
        gap: 10,
    },
    modalTitle: {
        flex: 1,
        fontSize: 20,
        fontWeight: '700',
        color: theme.colors.text,
    } as any,
    modalClose: {
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: theme.colors.bgCardLight,
        justifyContent: 'center',
        alignItems: 'center',
    },
    nudgeCard: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        paddingHorizontal: 20,
        paddingVertical: 14,
        borderBottomWidth: 1,
        borderBottomColor: theme.colors.border,
        gap: 12,
    },
    nudgePriority: {
        width: 36,
        height: 36,
        borderRadius: 18,
        justifyContent: 'center',
        alignItems: 'center',
        marginTop: 2,
    },
    nudgeText: {
        fontSize: 14,
        color: theme.colors.text,
        lineHeight: 20,
    },
    nudgeTime: {
        fontSize: 11,
        color: theme.colors.textMuted,
        marginTop: 4,
    },
});

export default HomeScreen;
