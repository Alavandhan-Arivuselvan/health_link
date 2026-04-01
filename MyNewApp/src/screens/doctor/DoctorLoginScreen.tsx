
import React, { useState } from 'react';
import { View, StyleSheet, Text, Alert, KeyboardAvoidingView, ScrollView, Platform } from 'react-native';
import GradientBackground from '../../components/GradientBackground';
import CustomInput from '../../components/CustomInput';
import CustomButton from '../../components/CustomButton';
import { doctorAPI, authAPI } from '../../services/api';
import { theme } from '../../theme';
import { useNavigation } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';

const DoctorLoginScreen = () => {
    const navigation = useNavigation();
    const [step, setStep] = useState(1); // 1=credentials, 2=OTP
    const [licenseNumber, setLicenseNumber] = useState('');
    const [phone, setPhone] = useState('');
    const [password, setPassword] = useState('');
    const [otp, setOtp] = useState('');
    const [loading, setLoading] = useState(false);

    const handleLogin = async () => {
        if (!licenseNumber || !password || !phone) {
            Alert.alert('Error', 'Please fill in all fields');
            return;
        }
        setLoading(true);
        try {
            const response = await doctorAPI.login({ license_number: licenseNumber, password });
            if (response.data.status === 'success') {
                // Save doctor name for greeting
                const doctorName = response.data.doctor?.name || '';
                await AsyncStorage.setItem('doctor_name', doctorName);
                // Credentials valid — send OTP
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
            Alert.alert('Error', 'Please enter the OTP');
            return;
        }
        setLoading(true);
        try {
            const response = await authAPI.verifyOTP({ phone, otp });
            if (response.data.status === 'success') {
                await AsyncStorage.setItem('doctor_license', licenseNumber);
                await AsyncStorage.setItem('doctor_phone', phone);
                await AsyncStorage.setItem('user_role', 'doctor');
                navigation.reset({ index: 0, routes: [{ name: 'AppTabs' as never }] });
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
                    {/* Brand area */}
                    <View style={styles.brandArea}>
                        <View style={styles.logoCircle}>
                            <Ionicons name="medkit" size={28} color={theme.colors.accent} />
                        </View>
                        <Text style={styles.brandName}>Doctor Portal</Text>
                        <Text style={styles.brandTagline}>Secure medical professional access</Text>
                    </View>

                    <View style={styles.card}>
                        <Text style={styles.title}>{step === 1 ? 'Doctor Login' : 'Verify OTP'}</Text>

                        {step === 1 ? (
                            <>
                                <Text style={styles.subtitle}>Sign in with your medical credentials</Text>
                                <CustomInput
                                    label="Medical License Number"
                                    placeholder="e.g. MCI-12345"
                                    value={licenseNumber}
                                    onChangeText={setLicenseNumber}
                                    autoCapitalize="characters"
                                />
                                <CustomInput
                                    label="Phone Number"
                                    placeholder="Enter your phone number"
                                    value={phone}
                                    onChangeText={setPhone}
                                    keyboardType="phone-pad"
                                />
                                <CustomInput
                                    label="Password"
                                    placeholder="Enter your password"
                                    value={password}
                                    onChangeText={setPassword}
                                    secureTextEntry
                                />
                                <CustomButton title="Login" onPress={handleLogin} loading={loading} />
                                <CustomButton title="Register as Doctor" type="outline" onPress={() => navigation.navigate('DoctorRegister' as never)} />
                                <CustomButton title="← Patient Login" type="outline" onPress={() => navigation.navigate('Login' as never)} />
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
        width: 64,
        height: 64,
        borderRadius: 32,
        backgroundColor: 'rgba(0,201,167,0.1)',
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: theme.spacing.m,
    },
    brandName: {
        fontSize: 26,
        fontWeight: '700',
        color: theme.colors.text,
        letterSpacing: -0.3,
    } as any,
    brandTagline: {
        fontSize: 13,
        color: theme.colors.textMuted,
        marginTop: 4,
    },
    card: {
        backgroundColor: theme.colors.bgCard,
        padding: theme.spacing.l,
        borderRadius: theme.borderRadius.m,
        ...theme.shadow.card,
    },
    title: {
        ...theme.typography.h2,
        textAlign: 'center',
        marginBottom: 4,
    },
    subtitle: {
        textAlign: 'center',
        color: theme.colors.textMuted,
        marginBottom: theme.spacing.l,
        fontSize: 14,
    },
});

export default DoctorLoginScreen;
