import React, { useState, useCallback } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    TouchableOpacity,
    StatusBar,
    Modal,
    ActivityIndicator,
    FlatList,
    RefreshControl,
    Platform,
    Alert,
} from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import GradientBackground from '../../components/GradientBackground';
import LearningPath from '../../components/LearningPath';
import { theme } from '../../theme';
import { BASE_URL } from '../../config/host';
import { MOCK_CHAPTERS, ChapterData } from '../../data/mockLessons';
import { getLearningState, LearningState } from '../../services/learningStore';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { reportsAPI } from '../../services/api';
import * as DocumentPicker from 'expo-document-picker';

// ─── HOME SCREEN ────────────────────────────────────────────────────
const HomeScreen = () => {
    const navigation = useNavigation<any>();

    // State
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
    const [recentReports, setRecentReports] = useState<any[]>([]);
    const [reportsLoading, setReportsLoading] = useState(true);
    const [uploading, setUploading] = useState(false);



    const fetchData = async () => {

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

        // Fetch recent reports
        try {
            const userPhone = (await AsyncStorage.getItem('user_phone')) || '';
            if (userPhone) {
                const rptRes = await reportsAPI.list(userPhone);
                setRecentReports((rptRes.data.reports || []).slice(0, 3));
            }
        } catch { }
        setReportsLoading(false);

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

    // ─── Report upload handler ───────────────────────────────────
    const handleReportUpload = async () => {
        try {
            const result = await DocumentPicker.getDocumentAsync({
                type: ['application/pdf', 'image/*'],
                copyToCacheDirectory: true,
            });
            if (result.canceled || !result.assets?.length) return;

            const pickedFile = result.assets[0];
            setUploading(true);

            const userPhone = (await AsyncStorage.getItem('user_phone')) || '';
            const formData = new FormData();

            if (Platform.OS === 'web') {
                const nativeFile = (pickedFile as any).file;
                if (nativeFile instanceof Blob) {
                    formData.append('file', nativeFile, pickedFile.name || 'report.pdf');
                } else {
                    const resp = await fetch(pickedFile.uri);
                    const blob = await resp.blob();
                    formData.append('file', blob, pickedFile.name || 'report.pdf');
                }
            } else {
                formData.append('file', {
                    uri: pickedFile.uri,
                    name: pickedFile.name || 'report.pdf',
                    type: pickedFile.mimeType || 'application/pdf',
                } as any);
            }
            formData.append('user_phone', userPhone);

            await reportsAPI.upload(formData);
            Alert.alert('Upload Started', `${pickedFile.name} is being processed.`);
            // Refresh reports list
            setTimeout(async () => {
                try {
                    const rptRes = await reportsAPI.list(userPhone);
                    setRecentReports((rptRes.data.reports || []).slice(0, 3));
                } catch {}
            }, 1500);
        } catch (e: any) {
            Alert.alert('Upload Failed', e.message || 'Something went wrong');
        } finally {
            setUploading(false);
        }
    };

    const formatReportDate = (isoStr: string) => {
        try {
            return new Date(isoStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        } catch { return isoStr; }
    };

    const getReportStatus = (status: string) => {
        switch (status) {
            case 'processed': return { icon: 'checkmark-circle' as const, color: '#4CAF50', label: 'Processed', bg: 'rgba(76,175,80,0.12)' };
            case 'processing': return { icon: 'hourglass' as const, color: '#FFB74D', label: 'Processing', bg: 'rgba(255,183,77,0.12)' };
            case 'failed': return { icon: 'close-circle' as const, color: '#EF5350', label: 'Failed', bg: 'rgba(239,83,80,0.12)' };
            default: return { icon: 'ellipse' as const, color: theme.colors.textMuted, label: status, bg: 'rgba(255,255,255,0.05)' };
        }
    };



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
                style={{ flex: 1 }}
                contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 120, flexGrow: 1 }}
                nestedScrollEnabled
                bounces
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

                {/* ── LEARNING PATH ───────────────────── */}
                <View>
                    <LearningPath
                        chapters={MOCK_CHAPTERS}
                        completedChapters={learningState.completedChapters}
                        onChapterPress={handleChapterPress}
                    />
                </View>

                {/* ── REPORTS SECTION ───────────────────── */}
                <View style={styles.reportsSection}>
                    <View style={styles.reportsSectionHeader}>
                        <View style={styles.reportsTitleRow}>
                            <View style={[styles.reportsTitleIcon, { backgroundColor: 'rgba(79,195,247,0.12)' }]}>
                                <Ionicons name="document-text" size={18} color="#4FC3F7" />
                            </View>
                            <View>
                                <Text style={styles.reportsSectionTitle}>Recent Reports</Text>
                                <Text style={styles.reportsSectionSub}>{recentReports.length} uploaded</Text>
                            </View>
                        </View>
                        <TouchableOpacity
                            style={styles.viewAllBtn}
                            onPress={() => navigation.navigate('ReportHistory')}
                        >
                            <Text style={styles.viewAllText}>View All</Text>
                            <Ionicons name="chevron-forward" size={14} color={theme.colors.accent} />
                        </TouchableOpacity>
                    </View>

                    {reportsLoading ? (
                        <View style={{ paddingVertical: 24, alignItems: 'center' }}>
                            <ActivityIndicator color={theme.colors.accent} />
                        </View>
                    ) : recentReports.length === 0 ? (
                        <View style={styles.reportsEmpty}>
                            <Ionicons name="documents-outline" size={36} color={theme.colors.textMuted} />
                            <Text style={styles.reportsEmptyTitle}>No reports yet</Text>
                            <Text style={styles.reportsEmptySub}>Upload your lab report to see results here</Text>
                        </View>
                    ) : (
                        recentReports.map((report) => {
                            const si = getReportStatus(report.status);
                            return (
                                <TouchableOpacity
                                    key={report.id}
                                    style={styles.reportCard}
                                    activeOpacity={0.8}
                                    onPress={() => navigation.navigate('ReportDetail', {
                                        reportId: report.id,
                                        date: formatReportDate(report.uploaded_at),
                                    })}
                                >
                                    <View style={[styles.reportCardIcon, { backgroundColor: si.bg }]}>
                                        <Ionicons
                                            name={report.file_type === 'pdf' ? 'document-text' : 'image'}
                                            size={20}
                                            color={si.color}
                                        />
                                    </View>
                                    <View style={{ flex: 1 }}>
                                        <Text style={styles.reportCardDate}>{formatReportDate(report.uploaded_at)}</Text>
                                        <Text style={styles.reportCardFile} numberOfLines={1}>{report.filename}</Text>
                                        <View style={styles.reportCardMeta}>
                                            <View style={[styles.reportStatusBadge, { backgroundColor: si.bg }]}>
                                                <Ionicons name={si.icon} size={10} color={si.color} />
                                                <Text style={[styles.reportStatusText, { color: si.color }]}>{si.label}</Text>
                                            </View>
                                            {report.metrics_count > 0 && (
                                                <Text style={styles.reportMetricsTag}>{report.metrics_count} metrics</Text>
                                            )}
                                        </View>
                                    </View>
                                    <Ionicons name="chevron-forward" size={16} color={theme.colors.textMuted} />
                                </TouchableOpacity>
                            );
                        })
                    )}

                    {/* Upload Button */}
                    <TouchableOpacity
                        style={[styles.uploadReportBtn, uploading && { opacity: 0.6 }]}
                        activeOpacity={0.85}
                        onPress={handleReportUpload}
                        disabled={uploading}
                    >
                        {uploading ? (
                            <ActivityIndicator size="small" color={theme.colors.bgDark} />
                        ) : (
                            <>
                                <Ionicons name="cloud-upload" size={18} color={theme.colors.bgDark} />
                                <Text style={styles.uploadReportBtnText}>Upload New Report</Text>
                            </>
                        )}
                    </TouchableOpacity>
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



// ─── STYLES ──────────────────────────────────────────────────────
const styles = StyleSheet.create({
    container: { flex: 1 },

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

    // Reports Section
    reportsSection: {
        backgroundColor: theme.colors.bgCard,
        borderRadius: theme.borderRadius.l,
        padding: 20,
        marginTop: 20,
        marginBottom: 8,
        ...theme.shadow.card,
    },
    reportsSectionHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 16,
    },
    reportsTitleRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
    },
    reportsTitleIcon: {
        width: 38,
        height: 38,
        borderRadius: 12,
        justifyContent: 'center',
        alignItems: 'center',
    },
    reportsSectionTitle: {
        fontSize: 17,
        fontWeight: '700',
        color: theme.colors.text,
    } as any,
    reportsSectionSub: {
        fontSize: 12,
        color: theme.colors.textMuted,
        marginTop: 1,
    },
    viewAllBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 2,
        paddingVertical: 4,
        paddingHorizontal: 8,
    },
    viewAllText: {
        fontSize: 13,
        fontWeight: '600',
        color: theme.colors.accent,
    } as any,

    reportsEmpty: {
        alignItems: 'center',
        paddingVertical: 24,
    },
    reportsEmptyTitle: {
        fontSize: 15,
        fontWeight: '600',
        color: theme.colors.textSecondary,
        marginTop: 10,
    } as any,
    reportsEmptySub: {
        fontSize: 12,
        color: theme.colors.textMuted,
        marginTop: 4,
        textAlign: 'center',
    },

    reportCard: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        paddingVertical: 12,
        borderBottomWidth: 1,
        borderBottomColor: theme.colors.border,
    },
    reportCardIcon: {
        width: 42,
        height: 42,
        borderRadius: 12,
        justifyContent: 'center',
        alignItems: 'center',
    },
    reportCardDate: {
        fontSize: 14,
        fontWeight: '600',
        color: theme.colors.text,
    } as any,
    reportCardFile: {
        fontSize: 11,
        color: theme.colors.textMuted,
        marginTop: 1,
    },
    reportCardMeta: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        marginTop: 4,
    },
    reportStatusBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        paddingHorizontal: 7,
        paddingVertical: 2,
        borderRadius: 8,
    },
    reportStatusText: {
        fontSize: 10,
        fontWeight: '700',
    } as any,
    reportMetricsTag: {
        fontSize: 10,
        color: theme.colors.textMuted,
        fontWeight: '600',
    } as any,

    uploadReportBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        backgroundColor: theme.colors.accent,
        borderRadius: 14,
        paddingVertical: 14,
        marginTop: 16,
    },
    uploadReportBtnText: {
        fontSize: 15,
        fontWeight: '700',
        color: theme.colors.bgDark,
    } as any,
});

export default HomeScreen;
