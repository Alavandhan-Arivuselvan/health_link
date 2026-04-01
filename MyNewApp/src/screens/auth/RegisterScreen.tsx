
import React, { useState } from 'react';
import { View, StyleSheet, Text, Alert, ScrollView, TouchableOpacity, KeyboardAvoidingView, Platform } from 'react-native';
import GradientBackground from '../../components/GradientBackground';
import CustomInput from '../../components/CustomInput';
import CustomButton from '../../components/CustomButton';
import { authAPI } from '../../services/api';
import { theme } from '../../theme';
import { useNavigation } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';

const RegisterScreen = () => {
    const navigation = useNavigation();
    const [step, setStep] = useState(1);
    const [formData, setFormData] = useState({
        phone: '', name: '', dob: '', gender: '',
        blood_group: '', password: '', confirmPassword: '',
    } as any);
    const [otp, setOtp] = useState('');
    const [loading, setLoading] = useState(false);

    const handleChange = (key: string, value: string) => {
        setFormData((prev: any) => ({ ...prev, [key]: value }));
    };

    const validateDate = (date: string) => /^\d{4}-\d{2}-\d{2}$/.test(date);

    const handleRegister = async () => {
        if (!formData.phone || !formData.name || !formData.password) {
            Alert.alert('Error', 'Please fill all required fields');
            return;
        }
        if (!validateDate(formData.dob)) {
            Alert.alert('Error', 'Invalid Date of Birth. Use YYYY-MM-DD format.');
            return;
        }
        if (formData.password !== formData.confirmPassword) {
            Alert.alert('Error', 'Passwords do not match');
            return;
        }
        setLoading(true);
        try {
            const response = await authAPI.register({
                phone: formData.phone, name: formData.name, dob: formData.dob,
                gender: formData.gender, blood_group: formData.blood_group,
                password: formData.password,
            });
            if (response.data.status === 'success') {
                await authAPI.sendOTP({ phone: formData.phone });
                setStep(2);
            } else {
                Alert.alert('Registration Failed', response.data.message);
            }
        } catch (error) {
            console.log(error);
            Alert.alert('Error', 'Registration failed.');
        } finally {
            setLoading(false);
        }
    };

    const handleVerifyOTP = async () => {
        if (!otp) { Alert.alert('Error', 'Please enter OTP'); return; }
        setLoading(true);
        try {
            const response = await authAPI.verifyOTP({ phone: formData.phone, otp });
            if (response.data.status === 'success') {
                await AsyncStorage.setItem('user_phone', formData.phone);
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
                <View style={styles.card}>
                    <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
                        {/* Header */}
                        <View style={styles.header}>
                            <View style={styles.iconCircle}>
                                <Ionicons name="person-add" size={28} color={theme.colors.accent} />
                            </View>
                            <Text style={styles.title}>{step === 1 ? 'Create Account' : 'Verify Phone'}</Text>
                            <Text style={styles.subtitle}>
                                {step === 1 ? 'Join HealthLink today' : `OTP sent to ${formData.phone}`}
                            </Text>
                        </View>

                        {step === 1 ? (
                            <>
                                <CustomInput label="Phone Number" value={formData.phone}
                                    onChangeText={(t: string) => handleChange('phone', t)} keyboardType="phone-pad" />
                                <CustomInput label="Full Name" value={formData.name}
                                    onChangeText={(t: string) => handleChange('name', t)} />
                                <CustomInput label="Date of Birth (YYYY-MM-DD)" value={formData.dob}
                                    onChangeText={(t: string) => handleChange('dob', t)} placeholder="2000-01-01" />

                                {/* Gender selector */}
                                <View style={styles.inputContainer}>
                                    <Text style={styles.label}>GENDER</Text>
                                    <View style={styles.genderRow}>
                                        {['Male', 'Female', 'Other'].map((option) => (
                                            <TouchableOpacity
                                                key={option}
                                                style={[
                                                    styles.genderOption,
                                                    formData.gender === option && styles.genderOptionSelected
                                                ]}
                                                onPress={() => handleChange('gender', option)}
                                            >
                                                <Text style={[
                                                    styles.genderText,
                                                    formData.gender === option && styles.genderTextSelected
                                                ]}>{option}</Text>
                                            </TouchableOpacity>
                                        ))}
                                    </View>
                                </View>

                                <CustomInput label="Blood Group" value={formData.blood_group}
                                    onChangeText={(t: string) => handleChange('blood_group', t)} placeholder="e.g., O+" />
                                <CustomInput label="Password" value={formData.password}
                                    onChangeText={(t: string) => handleChange('password', t)} secureTextEntry />
                                <CustomInput label="Confirm Password" value={formData.confirmPassword}
                                    onChangeText={(t: string) => handleChange('confirmPassword', t)} secureTextEntry />

                                <CustomButton title="Register" onPress={handleRegister} loading={loading} />
                                <CustomButton title="Back to Login" type="outline" onPress={() => navigation.goBack()} />
                            </>
                        ) : (
                            <>
                                <CustomInput label="Enter OTP" placeholder="XXXX" value={otp}
                                    onChangeText={setOtp} keyboardType="number-pad" maxLength={4} />
                                <CustomButton title="Verify & Complete" onPress={handleVerifyOTP} loading={loading} />
                                <CustomButton title="Back" type="outline" onPress={() => setStep(1)} />
                            </>
                        )}
                    </ScrollView>
                </View>
            </KeyboardAvoidingView>
        </GradientBackground>
    );
};

const styles = StyleSheet.create({
    container: {
        justifyContent: 'center',
        padding: theme.spacing.m,
        flex: 1,
    },
    card: {
        backgroundColor: theme.colors.bgCard,
        padding: theme.spacing.m,
        borderRadius: theme.borderRadius.m,
        maxHeight: '92%',
        ...theme.shadow.card,
    },
    scrollContent: {
        paddingBottom: 20,
    },
    header: {
        alignItems: 'center',
        marginBottom: theme.spacing.m,
    },
    iconCircle: {
        width: 56,
        height: 56,
        borderRadius: 28,
        backgroundColor: 'rgba(0,201,167,0.1)',
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: theme.spacing.s,
    },
    title: {
        ...theme.typography.h2,
        textAlign: 'center',
    },
    subtitle: {
        textAlign: 'center',
        color: theme.colors.textMuted,
        fontSize: 14,
        marginTop: 4,
    },
    inputContainer: {
        marginVertical: theme.spacing.s,
    },
    label: {
        fontSize: 13,
        fontWeight: '600',
        color: theme.colors.textMuted,
        marginBottom: 6,
        letterSpacing: 0.5,
    } as any,
    genderRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        gap: 8,
    },
    genderOption: {
        flex: 1,
        paddingVertical: 12,
        borderWidth: 1.5,
        borderColor: theme.colors.border,
        borderRadius: theme.borderRadius.m,
        alignItems: 'center',
        backgroundColor: theme.colors.bgCard,
    },
    genderOptionSelected: {
        backgroundColor: theme.colors.accent,
        borderColor: theme.colors.accent,
    },
    genderText: {
        color: theme.colors.textMuted,
        fontWeight: '500',
    } as any,
    genderTextSelected: {
        color: theme.colors.bgDark,
        fontWeight: '700',
    } as any,
});

export default RegisterScreen;
