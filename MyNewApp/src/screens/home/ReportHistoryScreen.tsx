
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
    RefreshControl,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as DocumentPicker from 'expo-document-picker';
import { Ionicons } from '@expo/vector-icons';
import GradientBackground from '../../components/GradientBackground';
import { theme } from '../../theme';
import { reportsAPI } from '../../services/api';

interface Report {
    id: string;
    filename: string;
    file_type: string;
    status: 'processing' | 'processed' | 'failed';
    metrics_count: number;
    metrics_list: string[];
    uploaded_at: string;
    patient_name?: string;
}

const ReportHistoryScreen = ({ navigation }: any) => {
    const [reports, setReports] = useState<Report[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [uploading, setUploading] = useState(false);

    // Fetch reports whenever this screen gains focus
    const fetchReports = async () => {
        try {
            const userPhone = (await AsyncStorage.getItem('user_phone')) || '';
            if (!userPhone) {
                setReports([]);
                setLoading(false);
                return;
            }
            const res = await reportsAPI.list(userPhone);
            setReports(res.data.reports || []);
        } catch (e) {
            console.error('Failed to fetch reports:', e);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    useFocusEffect(
        useCallback(() => {
            setLoading(true);
            fetchReports();
        }, [])
    );

    const onRefresh = () => {
        setRefreshing(true);
        fetchReports();
    };

    // File picker + upload
    const handleUpload = async () => {
        try {
            const result = await DocumentPicker.getDocumentAsync({
                type: ['application/pdf', 'image/*'],
                copyToCacheDirectory: true,
            });

            if (result.canceled || !result.assets || result.assets.length === 0) return;

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

            const res = await reportsAPI.upload(formData);
            Alert.alert('Upload Started', `${file.name} is being processed. Pull down to refresh.`);

            // Refresh the list after a brief delay
            setTimeout(() => fetchReports(), 1500);
        } catch (e: any) {
            console.error('Upload error:', e);
            Alert.alert('Upload Failed', e.message || 'Something went wrong');
        } finally {
            setUploading(false);
        }
    };

    const formatDate = (isoStr: string) => {
        try {
            const d = new Date(isoStr);
            return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
        } catch {
            return isoStr;
        }
    };

    const formatTime = (isoStr: string) => {
        try {
            const d = new Date(isoStr);
            return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
        } catch {
            return '';
        }
    };

    const getStatusInfo = (status: string) => {
        switch (status) {
            case 'processed':
                return { icon: 'checkmark-circle' as const, color: '#4CAF50', label: 'Processed', bg: 'rgba(76,175,80,0.15)' };
            case 'processing':
                return { icon: 'hourglass' as const, color: '#FFB74D', label: 'Processing', bg: 'rgba(255,183,77,0.15)' };
            case 'failed':
                return { icon: 'close-circle' as const, color: '#EF5350', label: 'Failed', bg: 'rgba(239,83,80,0.15)' };
            default:
                return { icon: 'ellipse' as const, color: theme.colors.textMuted, label: status, bg: 'rgba(255,255,255,0.05)' };
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
                <Text style={styles.headerTitle}>Report History</Text>
                <TouchableOpacity style={styles.searchBtn} onPress={onRefresh}>
                    <Ionicons name="refresh" size={20} color={theme.colors.textMuted} />
                </TouchableOpacity>
            </View>

            {/* Summary bar */}
            <View style={styles.summaryBar}>
                <View style={styles.summaryItem}>
                    <Text style={styles.summaryValue}>{reports.length}</Text>
                    <Text style={styles.summaryLabel}>Total</Text>
                </View>
                <View style={styles.summaryDivider} />
                <View style={styles.summaryItem}>
                    <Text style={styles.summaryValue}>
                        {reports.filter((r) => r.status === 'processed').length}
                    </Text>
                    <Text style={styles.summaryLabel}>Processed</Text>
                </View>
                <View style={styles.summaryDivider} />
                <View style={styles.summaryItem}>
                    <Text style={styles.summaryValue}>
                        {reports.filter((r) => r.status === 'processing').length}
                    </Text>
                    <Text style={styles.summaryLabel}>Pending</Text>
                </View>
            </View>

            {/* List */}
            {loading ? (
                <View style={styles.loader}>
                    <ActivityIndicator size="large" color={theme.colors.accent} />
                    <Text style={styles.loaderText}>Loading reports...</Text>
                </View>
            ) : (
                <ScrollView
                    contentContainerStyle={styles.scrollContent}
                    showsVerticalScrollIndicator={false}
                    refreshControl={
                        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.colors.accent} />
                    }
                >
                    {reports.length === 0 ? (
                        <View style={styles.emptyState}>
                            <Ionicons name="document-text-outline" size={60} color={theme.colors.textMuted} />
                            <Text style={styles.emptyTitle}>No Reports Yet</Text>
                            <Text style={styles.emptySub}>Upload your first lab report to get started</Text>
                        </View>
                    ) : (
                        reports.map((report) => {
                            const si = getStatusInfo(report.status);
                            return (
                                <TouchableOpacity
                                    key={report.id}
                                    style={styles.reportCard}
                                    activeOpacity={0.8}
                                    onPress={() =>
                                        navigation.navigate('ReportDetail', {
                                            reportId: report.id,
                                            date: formatDate(report.uploaded_at),
                                        })
                                    }
                                >
                                    {/* Icon */}
                                    <View style={[styles.reportIcon, { backgroundColor: si.bg }]}>
                                        <Ionicons
                                            name={report.file_type === 'pdf' ? 'document-text' : 'image'}
                                            size={22}
                                            color={si.color}
                                        />
                                    </View>

                                    {/* Info */}
                                    <View style={styles.reportInfo}>
                                        <View style={styles.reportTitleRow}>
                                            <Text style={styles.reportDate}>{formatDate(report.uploaded_at)}</Text>
                                            <Text style={styles.reportTime}>{formatTime(report.uploaded_at)}</Text>
                                        </View>
                                        <Text style={styles.reportFilename} numberOfLines={1}>
                                            {report.filename}
                                        </Text>
                                        {report.metrics_count > 0 ? (
                                            <Text style={styles.reportMetrics}>
                                                {report.metrics_list?.slice(0, 4).join(' • ') || `${report.metrics_count} metrics`}
                                            </Text>
                                        ) : (
                                            <Text style={styles.reportMetrics}>
                                                {report.status === 'processing' ? 'Extracting metrics...' : 'No metrics extracted'}
                                            </Text>
                                        )}
                                        <View style={styles.reportMeta}>
                                            <View style={[styles.statusBadge, { backgroundColor: si.bg }]}>
                                                <Ionicons name={si.icon} size={12} color={si.color} />
                                                <Text style={[styles.statusText, { color: si.color }]}>{si.label}</Text>
                                            </View>
                                            {report.metrics_count > 0 && (
                                                <Text style={styles.metricsTag}>{report.metrics_count} metrics</Text>
                                            )}
                                        </View>
                                    </View>

                                    {/* Chevron */}
                                    <Ionicons name="chevron-forward" size={20} color={theme.colors.textMuted} />
                                </TouchableOpacity>
                            );
                        })
                    )}
                    <View style={{ height: 100 }} />
                </ScrollView>
            )}

            <View style={styles.bottomBar}>
                <TouchableOpacity activeOpacity={0.85} style={styles.uploadBtn} onPress={handleUpload} disabled={uploading}>
                    <View
                        style={[styles.uploadGradient, uploading && { backgroundColor: '#3A4A5A' }]}
                    >
                        {uploading ? (
                            <ActivityIndicator color={theme.colors.text} />
                        ) : (
                            <>
                                <Ionicons name="cloud-upload" size={20} color={theme.colors.bgDark} />
                                <Text style={styles.uploadText}>Upload New Report</Text>
                            </>
                        )}
                    </View>
                </TouchableOpacity>
            </View>
        </GradientBackground>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1 },

    header: {
        flexDirection: 'row', alignItems: 'center',
        paddingTop: 48, paddingHorizontal: 16, paddingBottom: 10,
    },
    backBtn: {
        width: 40, height: 40, borderRadius: 20,
        backgroundColor: theme.colors.bgCard, justifyContent: 'center', alignItems: 'center',
    },
    headerTitle: {
        flex: 1, textAlign: 'center',
        fontSize: 20, fontWeight: '700', color: theme.colors.text,
    } as any,
    searchBtn: {
        width: 40, height: 40, borderRadius: 20,
        backgroundColor: theme.colors.bgCard, justifyContent: 'center', alignItems: 'center',
    },

    summaryBar: {
        flexDirection: 'row', alignItems: 'center',
        backgroundColor: theme.colors.bgCard,
        marginHorizontal: 16, marginTop: 16,
        borderRadius: theme.borderRadius.m, padding: 16,
    },
    summaryItem: { flex: 1, alignItems: 'center' },
    summaryValue: { fontSize: 22, fontWeight: '800', color: theme.colors.text } as any,
    summaryLabel: { fontSize: 11, fontWeight: '600', color: theme.colors.textMuted, marginTop: 2, letterSpacing: 0.3 } as any,
    summaryDivider: { width: 1, height: 30, backgroundColor: theme.colors.border },

    loader: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    loaderText: { color: theme.colors.textMuted, marginTop: 10, fontSize: 14 },

    scrollContent: { padding: 16 },

    emptyState: { alignItems: 'center', paddingTop: 60 },
    emptyTitle: { fontSize: 20, fontWeight: '700', color: theme.colors.text, marginTop: 16 } as any,
    emptySub: { fontSize: 14, color: theme.colors.textMuted, marginTop: 6 },

    reportCard: {
        flexDirection: 'row', alignItems: 'center',
        backgroundColor: theme.colors.bgCard,
        borderRadius: theme.borderRadius.m, padding: 16, marginBottom: 10,
        ...theme.shadow.card,
    },
    reportIcon: {
        width: 48, height: 48, borderRadius: 14,
        justifyContent: 'center', alignItems: 'center', marginRight: 14,
    },
    reportInfo: { flex: 1 },
    reportTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    reportDate: { fontSize: 16, fontWeight: '700', color: theme.colors.text } as any,
    reportTime: { fontSize: 12, color: theme.colors.textMuted },
    reportFilename: { fontSize: 12, color: theme.colors.textMuted, marginTop: 2 },
    reportMetrics: { fontSize: 13, color: theme.colors.textSecondary, marginTop: 3 },
    reportMeta: { flexDirection: 'row', alignItems: 'center', marginTop: 8, gap: 12 },
    statusBadge: {
        flexDirection: 'row', alignItems: 'center',
        paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8, gap: 5,
    },
    statusText: { fontSize: 11, fontWeight: '600' } as any,
    metricsTag: { fontSize: 12, fontWeight: '700', color: theme.colors.accent } as any,

    bottomBar: {
        position: 'absolute', bottom: 0, left: 0, right: 0,
        paddingHorizontal: 16, paddingTop: 12, paddingBottom: 28,
        backgroundColor: theme.colors.bgDark,
        borderTopWidth: 1, borderTopColor: theme.colors.border,
    },
    uploadBtn: { borderRadius: 999, overflow: 'hidden' },
    uploadGradient: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
        height: 54, borderRadius: 999, gap: 10,
        backgroundColor: theme.colors.accent,
    },
    uploadText: {
        fontSize: 17, fontWeight: '700', color: theme.colors.bgDark, letterSpacing: 0.3,
    } as any,
});

export default ReportHistoryScreen;
