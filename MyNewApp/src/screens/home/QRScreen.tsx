
import React, { useState, useEffect } from 'react';
import { View, StyleSheet, Text, ActivityIndicator, Platform, TouchableOpacity } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import GradientBackground from '../../components/GradientBackground';
import { theme } from '../../theme';
import { Ionicons } from '@expo/vector-icons';
import { BASE_URL } from '../../config/host';

// Conditional import for QR code (native only)
let QRCode: any = null;
try {
    QRCode = require('react-native-qrcode-svg').default;
} catch (e) {
    // Will use web fallback
}

const QRScreen = () => {
    const [qrUrl, setQrUrl] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const fetchQR = async () => {
        setLoading(true);
        setError(null);
        try {
            const userPhone = (await AsyncStorage.getItem('user_phone')) || '';
            const response = await fetch(`${BASE_URL}/qr`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ user_phone: userPhone }),
            });
            const data = await response.json();
            setQrUrl(data.url);
        } catch (err) {
            console.error('QR fetch error:', err);
            setError('Failed to generate QR code. Check backend connection.');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { fetchQR(); }, []);

    if (loading) {
        return (
            <GradientBackground style={styles.centered}>
                <ActivityIndicator size="large" color={theme.colors.accent} />
                <Text style={styles.loadingText}>Generating QR Code...</Text>
            </GradientBackground>
        );
    }

    if (error) {
        return (
            <GradientBackground style={styles.centered}>
                <Ionicons name="alert-circle" size={48} color={theme.colors.error} />
                <Text style={styles.errorText}>{error}</Text>
                <TouchableOpacity style={styles.retryButton} onPress={fetchQR}>
                    <Text style={styles.retryText}>Retry</Text>
                </TouchableOpacity>
            </GradientBackground>
        );
    }

    return (
        <GradientBackground style={styles.centered}>
            {/* Header */}
            <View style={styles.headerIcon}>
                <Ionicons name="qr-code" size={28} color={theme.colors.accent} />
            </View>
            <Text style={styles.title}>Your Health QR</Text>
            <Text style={styles.subtitle}>Share this for quick access to your health profile</Text>

            {/* QR Card */}
            <View style={styles.qrContainer}>
                {qrUrl && Platform.OS !== 'web' && QRCode ? (
                    <QRCode value={qrUrl} size={200} backgroundColor="#1A2332" color={theme.colors.accent} />
                ) : qrUrl ? (
                    <img
                        src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(qrUrl)}&bgcolor=1A2332&color=00D4AA`}
                        alt="QR Code"
                        style={{ width: 200, height: 200, borderRadius: 12 } as any}
                    />
                ) : null}
            </View>

            {/* URL Box */}
            <View style={styles.urlBox}>
                <Text style={styles.urlLabel}>PROFILE URL</Text>
                <Text style={styles.urlText} selectable>{qrUrl}</Text>
            </View>

            <TouchableOpacity style={styles.refreshButton} onPress={fetchQR}>
                <Ionicons name="refresh" size={18} color={theme.colors.accent} />
                <Text style={styles.refreshText}>  Refresh QR</Text>
            </TouchableOpacity>
        </GradientBackground>
    );
};

const styles = StyleSheet.create({
    centered: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        padding: 24,
    },
    headerIcon: {
        width: 60,
        height: 60,
        borderRadius: 30,
        backgroundColor: theme.colors.glassLight,
        borderWidth: 1,
        borderColor: theme.colors.border,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: theme.spacing.m,
    },
    title: {
        ...theme.typography.h2,
        marginBottom: 6,
    },
    subtitle: {
        fontSize: 14,
        color: theme.colors.textMuted,
        textAlign: 'center',
        marginBottom: 28,
        paddingHorizontal: 20,
    },
    qrContainer: {
        backgroundColor: theme.colors.bgCard,
        padding: 24,
        borderRadius: theme.borderRadius.xl,
        borderWidth: 1,
        borderColor: theme.colors.border,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 24,
        ...theme.shadow.glow,
    },
    urlBox: {
        backgroundColor: theme.colors.bgCard,
        padding: 16,
        borderRadius: theme.borderRadius.m,
        width: '100%',
        marginBottom: 20,
        borderWidth: 1,
        borderColor: theme.colors.border,
    },
    urlLabel: {
        color: theme.colors.textMuted,
        fontSize: 11,
        fontWeight: '600',
        marginBottom: 6,
        letterSpacing: 1.5,
    } as any,
    urlText: {
        color: theme.colors.accent,
        fontSize: 13,
    },
    loadingText: {
        color: theme.colors.textMuted,
        marginTop: 12,
        fontSize: 14,
    },
    errorText: {
        color: theme.colors.error,
        fontSize: 16,
        textAlign: 'center',
        marginVertical: 16,
    },
    retryButton: {
        backgroundColor: theme.colors.accent,
        paddingHorizontal: 28,
        paddingVertical: 12,
        borderRadius: theme.borderRadius.m,
    },
    retryText: {
        color: theme.colors.bgDark,
        fontWeight: '700',
        fontSize: 15,
    } as any,
    refreshButton: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: theme.colors.bgCard,
        paddingHorizontal: 20,
        paddingVertical: 12,
        borderRadius: theme.borderRadius.m,
        borderWidth: 1,
        borderColor: theme.colors.border,
    },
    refreshText: {
        color: theme.colors.accent,
        fontWeight: '600',
        fontSize: 14,
    } as any,
});

export default QRScreen;
