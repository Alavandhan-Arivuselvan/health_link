
import React, { useState, useEffect } from 'react';
import {
    View, StyleSheet, Text, TouchableOpacity, Alert,
    ActivityIndicator,
} from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import AsyncStorage from '@react-native-async-storage/async-storage';
import GradientBackground from '../../components/GradientBackground';
import { theme } from '../../theme';
import { Ionicons } from '@expo/vector-icons';
import { BASE_URL } from '../../config/host';

const DoctorScanScreen = ({ navigation }: any) => {
    const [permission, requestPermission] = useCameraPermissions();
    const [scanning, setScanning] = useState(false); // camera open or not
    const [scanned, setScanned] = useState(false);
    const [loading, setLoading] = useState(false);
    const [doctorName, setDoctorName] = useState('');

    useEffect(() => {
        AsyncStorage.getItem('doctor_name').then(name => setDoctorName(name || 'Doctor'));
    }, []);

    const handleBarCodeScanned = async ({ data }: { data: string }) => {
        if (scanned || loading) return;
        setScanned(true);
        setLoading(true);

        try {
            const doctorLicense = (await AsyncStorage.getItem('doctor_license')) || '';
            const patientPhone = data.trim();

            if (!patientPhone) {
                Alert.alert('Invalid QR', 'This QR code does not contain a valid patient ID.');
                setScanned(false);
                setLoading(false);
                return;
            }

            const response = await fetch(`${BASE_URL}/api/doctor/scan`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    patient_phone: patientPhone,
                    doctor_license: doctorLicense,
                }),
            });

            const result = await response.json();

            if (!response.ok) {
                Alert.alert('Error', result.detail || 'Failed to create session');
                setScanned(false);
                setLoading(false);
                return;
            }

            setScanning(false);
            navigation.navigate('DoctorPatientView', {
                token: result.token,
                patientPhone: result.patient_phone,
                ttlSeconds: result.ttl_seconds,
            });
        } catch (err) {
            Alert.alert('Error', 'Could not connect to server. Check your connection.');
        } finally {
            setScanned(false);
            setLoading(false);
        }
    };

    const startScanning = async () => {
        if (!permission?.granted) {
            const result = await requestPermission();
            if (!result.granted) {
                Alert.alert('Permission Denied', 'Camera access is required to scan QR codes.');
                return;
            }
        }
        setScanning(true);
        setScanned(false);
    };

    // Main idle screen — big scan button
    if (!scanning) {
        return (
            <GradientBackground style={styles.centered}>
                <View style={styles.iconCircle}>
                    <Ionicons name="medkit" size={40} color={theme.colors.accent} />
                </View>
                <Text style={styles.title}>Welcome, Dr. {doctorName}</Text>
                <Text style={styles.subtitle}>
                    Scan a patient's QR code to access their health records for 1 hour
                </Text>

                <TouchableOpacity style={styles.scanButton} onPress={startScanning}>
                    <Ionicons name="scan" size={24} color={theme.colors.bgDark} />
                    <Text style={styles.scanButtonText}>  Scan Patient QR</Text>
                </TouchableOpacity>

                <View style={styles.infoCard}>
                    <View style={styles.infoRow}>
                        <Ionicons name="time-outline" size={18} color={theme.colors.accent} />
                        <Text style={styles.infoText}>Access lasts 1 hour after scanning</Text>
                    </View>
                    <View style={styles.infoRow}>
                        <Ionicons name="shield-checkmark-outline" size={18} color={theme.colors.accent} />
                        <Text style={styles.infoText}>Data access is automatically revoked</Text>
                    </View>
                    <View style={styles.infoRow}>
                        <Ionicons name="chatbubble-outline" size={18} color={theme.colors.accent} />
                        <Text style={styles.infoText}>Chat with AI about patient's health data</Text>
                    </View>
                </View>
            </GradientBackground>
        );
    }

    // Camera scanning mode
    return (
        <GradientBackground style={styles.container}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => setScanning(false)} style={styles.backBtn}>
                    <Ionicons name="arrow-back" size={22} color={theme.colors.text} />
                </TouchableOpacity>
                <Text style={styles.headerText}>Scan Patient QR</Text>
                <View style={{ width: 36 }} />
            </View>
            <Text style={styles.camSubtitle}>
                Point your camera at the patient's Health QR code
            </Text>

            <View style={styles.cameraWrapper}>
                <CameraView
                    style={styles.camera}
                    barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
                    onBarcodeScanned={scanned ? undefined : handleBarCodeScanned}
                />
                <View style={styles.scanOverlay}>
                    <View style={styles.scanFrame}>
                        <View style={[styles.corner, styles.topLeft]} />
                        <View style={[styles.corner, styles.topRight]} />
                        <View style={[styles.corner, styles.bottomLeft]} />
                        <View style={[styles.corner, styles.bottomRight]} />
                    </View>
                </View>
            </View>

            {loading && (
                <View style={styles.loadingOverlay}>
                    <ActivityIndicator size="large" color={theme.colors.accent} />
                    <Text style={styles.loadingText}>Creating session...</Text>
                </View>
            )}

            <TouchableOpacity style={styles.cancelButton} onPress={() => setScanning(false)}>
                <Text style={styles.cancelText}>Cancel</Text>
            </TouchableOpacity>
        </GradientBackground>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1 },
    centered: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
    iconCircle: {
        width: 80, height: 80, borderRadius: 40,
        backgroundColor: theme.colors.glassLight, borderWidth: 1.5,
        borderColor: theme.colors.border, justifyContent: 'center',
        alignItems: 'center', marginBottom: 20,
    },
    title: { ...theme.typography.h2, marginBottom: 8 },
    subtitle: {
        color: theme.colors.textMuted, fontSize: 15, textAlign: 'center',
        marginBottom: 32, paddingHorizontal: 20, lineHeight: 22,
    },
    scanButton: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
        backgroundColor: theme.colors.accent, paddingHorizontal: 36,
        paddingVertical: 16, borderRadius: 28, marginBottom: 32,
        ...theme.shadow.glow,
    },
    scanButtonText: {
        color: theme.colors.bgDark, fontWeight: '700', fontSize: 17,
    } as any,
    infoCard: {
        backgroundColor: theme.colors.bgCard, padding: 20,
        borderRadius: theme.borderRadius.l, borderWidth: 1,
        borderColor: theme.colors.border, width: '100%', gap: 14,
    },
    infoRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    infoText: { color: theme.colors.textMuted, fontSize: 14, flex: 1 },
    header: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
        paddingTop: 50, paddingHorizontal: 16, paddingBottom: 8,
    },
    backBtn: {
        width: 36, height: 36, borderRadius: 18,
        backgroundColor: theme.colors.glassLight, justifyContent: 'center', alignItems: 'center',
    },
    headerText: { ...theme.typography.h3 },
    camSubtitle: {
        color: theme.colors.textMuted, fontSize: 14, textAlign: 'center',
        marginBottom: 16, paddingHorizontal: 24,
    },
    cameraWrapper: {
        flex: 1, marginHorizontal: 20, borderRadius: 20, overflow: 'hidden',
        borderWidth: 1, borderColor: theme.colors.border, marginBottom: 12,
    },
    camera: { flex: 1 },
    scanOverlay: {
        ...StyleSheet.absoluteFillObject, justifyContent: 'center', alignItems: 'center',
    },
    scanFrame: { width: 220, height: 220, position: 'relative' },
    corner: {
        position: 'absolute', width: 32, height: 32, borderColor: theme.colors.accent,
    },
    topLeft: { top: 0, left: 0, borderTopWidth: 3, borderLeftWidth: 3 },
    topRight: { top: 0, right: 0, borderTopWidth: 3, borderRightWidth: 3 },
    bottomLeft: { bottom: 0, left: 0, borderBottomWidth: 3, borderLeftWidth: 3 },
    bottomRight: { bottom: 0, right: 0, borderBottomWidth: 3, borderRightWidth: 3 },
    loadingOverlay: {
        position: 'absolute', bottom: 80, left: 0, right: 0, alignItems: 'center',
    },
    loadingText: { color: theme.colors.textMuted, marginTop: 8, fontSize: 14 },
    cancelButton: {
        alignItems: 'center', paddingVertical: 14, marginHorizontal: 20,
        marginBottom: 20, borderRadius: theme.borderRadius.m,
        backgroundColor: theme.colors.bgCard, borderWidth: 1, borderColor: theme.colors.border,
    },
    cancelText: { color: theme.colors.textMuted, fontWeight: '600', fontSize: 15 } as any,
});

export default DoctorScanScreen;
