
import React, { useState } from 'react';
import { View, StyleSheet, Text, Alert, TouchableOpacity, KeyboardAvoidingView, ScrollView, Platform } from 'react-native';
import GradientBackground from '../../components/GradientBackground';
import CustomInput from '../../components/CustomInput';
import CustomButton from '../../components/CustomButton';
import { authAPI } from '../../services/api';
import { theme } from '../../theme';
import { useNavigation } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';

const LoginScreen = () => {
    const navigation = useNavigation();
    const [step, setStep] = useState(1);
    const [phone, setPhone] = useState('');
    const [password, setPassword] = useState('');
    const [otp, setOtp] = useState('');
    const [loading, setLoading] = useState(false);

    const handleLogin = async () => {
        if (!phone || !password) {
            Alert.alert('Error', 'Please enter phone and password');
            return;
        }
        setLoading(true);
        try {
            const response = await authAPI.login({ phone, password });
            if (response.data.status === 'success') {
                await authAPI.sendOTP({ phone });
                setStep(2);
            } else {
                Alert.alert('Login Failed', response.data.message);
            }
        } catch (error) {
            Alert.alert('Error', 'Login failed. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    const handleVerifyOTP = async () => {
        if (!otp) {
            Alert.alert('Error', 'Please enter OTP');
            return;
        }
        setLoading(true);
        try {
            const response = await authAPI.verifyOTP({ phone, otp });
            if (response.data.status === 'success') {
                await AsyncStorage.setItem('user_phone', phone);
                navigation.reset({
                    index: 0,
                    routes: [{ name: 'AppTabs' as never }],
                });
            } else {
                Alert.alert('Verification Failed', response.data.message);
            }
        } catch (error) {
            Alert.alert('Error', 'OTP verification failed.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <GradientBackground style={styles.container}>
            <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
                <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
                    {/* Logo / Brand */}
                    <View style={styles.brandArea}>
                        <View style={styles.logoCircle}>
                            <Ionicons name="heart-half" size={36} color={theme.colors.accent} />
                        </View>
                        <Text style={styles.brandName}>HealthLink</Text>
                        <Text style={styles.brandTagline}>Your health, connected</Text>
                    </View>

                    {/* Card */}
                    <View style={styles.card}>
                        <Text style={styles.title}>{step === 1 ? 'Welcome Back' : 'Verify OTP'}</Text>

                        {step === 1 ? (
                            <>
                                <CustomInput
                                    label="Phone Number"
                                    placeholder="Enter phone number"
                                    value={phone}
                                    onChangeText={setPhone}
                                    keyboardType="phone-pad"
                                />
                                <CustomInput
                                    label="Password"
                                    placeholder="Enter password"
                                    value={password}
                                    onChangeText={setPassword}
                                    secureTextEntry
                                />
                                <CustomButton title="Login" onPress={handleLogin} loading={loading} />
                                <CustomButton
                                    title="Register New Account"
                                    type="outline"
                                    onPress={() => navigation.navigate('Register' as never)}
                                />
                                <View style={styles.dividerRow}>
                                    <View style={styles.divider} />
                                    <Text style={styles.orText}>OR</Text>
                                    <View style={styles.divider} />
                                </View>
                                <TouchableOpacity
                                    onPress={() => navigation.navigate('DoctorLogin' as never)}
                                    style={styles.doctorLinkRow}
                                >
                                    <Ionicons name="medkit" size={18} color={theme.colors.accent} />
                                    <Text style={styles.doctorLinkText}>  Login as Doctor</Text>
                                </TouchableOpacity>
                            </>
                        ) : (
                            <>
                                <Text style={styles.subtitle}>OTP sent to {phone}</Text>
                                <CustomInput
                                    label="Enter OTP"
                                    placeholder="XXXX"
                                    value={otp}
                                    onChangeText={setOtp}
                                    keyboardType="number-pad"
                                    maxLength={4}
                                />
                                <CustomButton title="Verify & Login" onPress={handleVerifyOTP} loading={loading} />
                                <CustomButton title="Back" type="outline" onPress={() => setStep(1)} />
                            </>
                        )}
                    </View>
                </ScrollView>
            </KeyboardAvoidingView>
        </GradientBackground>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    scrollContent: {
        flexGrow: 1,
        justifyContent: 'center',
        padding: theme.spacing.m,
    },
    brandArea: {
        alignItems: 'center',
        marginBottom: theme.spacing.xl,
    },
    logoCircle: {
        width: 72,
        height: 72,
        borderRadius: 36,
        backgroundColor: theme.colors.glassBg,
        borderWidth: 1.5,
        borderColor: theme.colors.border,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: theme.spacing.m,
    },
    brandName: {
        fontSize: 28,
        fontWeight: '700',
        color: theme.colors.text,
        letterSpacing: -0.5,
    } as any,
    brandTagline: {
        fontSize: 14,
        color: theme.colors.textMuted,
        marginTop: 4,
    },
    card: {
        backgroundColor: theme.colors.glassBg,
        padding: theme.spacing.l,
        borderRadius: theme.borderRadius.xl,
        borderWidth: 1,
        borderColor: theme.colors.border,
        ...theme.shadow.card,
    },
    title: {
        ...theme.typography.h2,
        textAlign: 'center',
        marginBottom: theme.spacing.l,
    },
    subtitle: {
        textAlign: 'center',
        marginBottom: theme.spacing.m,
        color: theme.colors.textMuted,
        fontSize: 14,
    },
    dividerRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginVertical: theme.spacing.m,
    },
    divider: {
        flex: 1,
        height: 1,
        backgroundColor: theme.colors.border,
    },
    orText: {
        marginHorizontal: 12,
        color: theme.colors.gray,
        fontSize: 12,
        fontWeight: '600',
        letterSpacing: 1,
    } as any,
    doctorLinkRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 12,
    },
    doctorLinkText: {
        color: theme.colors.accent,
        fontWeight: '600',
        fontSize: 15,
    } as any,
});

export default LoginScreen;
