
import React, { useState } from 'react';
import {
    View, StyleSheet, Text, Alert, ScrollView,
    TouchableOpacity, KeyboardAvoidingView, Platform,
} from 'react-native';
import GradientBackground from '../../components/GradientBackground';
import CustomInput from '../../components/CustomInput';
import CustomButton from '../../components/CustomButton';
import { doctorAPI, authAPI } from '../../services/api';
import { theme } from '../../theme';
import { useNavigation } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';

const SPECIALIZATIONS = [
    'Cardiologist', 'Dermatologist', 'Pediatrician', 'Neurologist',
    'Orthopedic', 'Gynecologist', 'General Physician', 'Psychiatrist',
    'Ophthalmologist', 'ENT Specialist', 'Other',
];

const DoctorRegisterScreen = () => {
    const navigation = useNavigation();
    const [step, setStep] = useState(1);
    const [otp, setOtp] = useState('');
    const [loading, setLoading] = useState(false);
    const [showSpecPicker, setShowSpecPicker] = useState(false);

    const [formData, setFormData] = useState({
        name: '', phone: '', dob: '', gender: '',
        license_number: '', specialization: '', experience: '',
        hospital: '', fee: '', password: '', confirmPassword: '',
    } as any);

    const handleChange = (key: string, value: string) => {
        setFormData((prev: any) => ({ ...prev, [key]: value }));
    };

    const validateStep1 = () => {
        const { name, phone, dob, gender, license_number, specialization, experience, hospital, password, confirmPassword } = formData;
        if (!name || !phone || !dob || !gender || !license_number || !specialization || !experience || !hospital || !password) {
            Alert.alert('Error', 'Please fill all required fields'); return false;
        }
        if (!/^\d{4}-\d{2}-\d{2}$/.test(dob)) {
            Alert.alert('Error', 'Date of Birth must be YYYY-MM-DD'); return false;
        }
        if (password !== confirmPassword) {
            Alert.alert('Error', 'Passwords do not match'); return false;
        }
        return true;
    };

    const handleRegister = async () => {
        if (!validateStep1()) return;
        setLoading(true);
        try {
            const payload = {
                name: formData.name, phone: formData.phone, dob: formData.dob,
                gender: formData.gender, license_number: formData.license_number,
                specialization: formData.specialization,
                experience: parseInt(formData.experience, 10),
                hospital: formData.hospital,
                fee: formData.fee ? parseFloat(formData.fee) : 0,
                password: formData.password,
            };
            const response = await doctorAPI.register(payload);
            if (response.data.status === 'success') {
                await authAPI.sendOTP({ phone: formData.phone });
                setStep(2);
            } else {
                Alert.alert('Registration Failed', response.data.message);
            }
        } catch (error) {
            Alert.alert('Error', 'Registration failed. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    const handleVerifyOTP = async () => {
        if (!otp) { Alert.alert('Error', 'Please enter the OTP'); return; }
        setLoading(true);
        try {
            const response = await authAPI.verifyOTP({ phone: formData.phone, otp });
            if (response.data.status === 'success') {
                await AsyncStorage.setItem('doctor_license', formData.license_number);
                await AsyncStorage.setItem('user_role', 'doctor');
                Alert.alert('Success', 'Doctor account created! Please login.', [
                    { text: 'OK', onPress: () => navigation.navigate('DoctorLogin' as never) },
                ]);
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
            <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
                <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
                    <View style={styles.card}>
                        {/* Header */}
                        <View style={styles.headerRow}>
                            <View style={styles.iconCircle}>
                                <Ionicons name="medkit" size={24} color={theme.colors.accent} />
                            </View>
                            <View style={styles.badge}>
                                <Text style={styles.badgeText}>Doctor Portal</Text>
                            </View>
                        </View>

                        <Text style={styles.title}>{step === 1 ? 'Doctor Registration' : 'Verify Phone'}</Text>

                        {/* Step dots */}
                        <View style={styles.stepRow}>
                            {[1, 2].map(s => (
                                <View key={s} style={[styles.stepDot, step === s && styles.stepDotActive]} />
                            ))}
                        </View>

                        {step === 1 ? (
                            <>
                                <Text style={styles.sectionLabel}>Personal Information</Text>
                                <CustomInput label="Full Name *" value={formData.name} onChangeText={(t: string) => handleChange('name', t)} placeholder="Dr. Jane Doe" />
                                <CustomInput label="Phone Number *" value={formData.phone} onChangeText={(t: string) => handleChange('phone', t)} keyboardType="phone-pad" placeholder="9876543210" />
                                <CustomInput label="Date of Birth * (YYYY-MM-DD)" value={formData.dob} onChangeText={(t: string) => handleChange('dob', t)} placeholder="1985-01-01" />

                                {/* Gender */}
                                <View style={styles.inputContainer}>
                                    <Text style={styles.label}>GENDER *</Text>
                                    <View style={styles.genderRow}>
                                        {['Male', 'Female', 'Other'].map(option => (
                                            <TouchableOpacity
                                                key={option}
                                                style={[styles.genderOption, formData.gender === option && styles.genderOptionSelected]}
                                                onPress={() => handleChange('gender', option)}
                                            >
                                                <Text style={[styles.genderText, formData.gender === option && styles.genderTextSelected]}>
                                                    {option}
                                                </Text>
                                            </TouchableOpacity>
                                        ))}
                                    </View>
                                </View>

                                <Text style={styles.sectionLabel}>Professional Information</Text>
                                <CustomInput label="Medical License Number *" value={formData.license_number} onChangeText={(t: string) => handleChange('license_number', t)} placeholder="MCI-12345" autoCapitalize="characters" />

                                {/* Specialization Picker */}
                                <View style={styles.inputContainer}>
                                    <Text style={styles.label}>SPECIALIZATION *</Text>
                                    <TouchableOpacity style={styles.pickerButton} onPress={() => setShowSpecPicker(p => !p)}>
                                        <Text style={formData.specialization ? styles.pickerValue : styles.pickerPlaceholder}>
                                            {formData.specialization || 'Select specialization...'}
                                        </Text>
                                        <Ionicons name={showSpecPicker ? 'chevron-up' : 'chevron-down'} size={16} color={theme.colors.textMuted} />
                                    </TouchableOpacity>
                                    {showSpecPicker && (
                                        <View style={styles.pickerDropdown}>
                                            {SPECIALIZATIONS.map(spec => (
                                                <TouchableOpacity
                                                    key={spec}
                                                    style={[styles.pickerItem, formData.specialization === spec && styles.pickerItemSelected]}
                                                    onPress={() => { handleChange('specialization', spec); setShowSpecPicker(false); }}
                                                >
                                                    <Text style={[styles.pickerItemText, formData.specialization === spec && styles.pickerItemTextSelected]}>
                                                        {spec}
                                                    </Text>
                                                </TouchableOpacity>
                                            ))}
                                        </View>
                                    )}
                                </View>

                                <CustomInput label="Years of Experience *" value={formData.experience} onChangeText={(t: string) => handleChange('experience', t)} keyboardType="number-pad" placeholder="e.g. 8" />
                                <CustomInput label="Hospital / Clinic Name *" value={formData.hospital} onChangeText={(t: string) => handleChange('hospital', t)} placeholder="Apollo Hospital" />
                                <CustomInput label="Consultation Fee (₹)" value={formData.fee} onChangeText={(t: string) => handleChange('fee', t)} keyboardType="decimal-pad" placeholder="500" />

                                <Text style={styles.sectionLabel}>Security</Text>
                                <CustomInput label="Password *" value={formData.password} onChangeText={(t: string) => handleChange('password', t)} secureTextEntry placeholder="Min 8 characters" />
                                <CustomInput label="Confirm Password *" value={formData.confirmPassword} onChangeText={(t: string) => handleChange('confirmPassword', t)} secureTextEntry placeholder="Re-enter password" />

                                <CustomButton title="Register & Send OTP" onPress={handleRegister} loading={loading} />
                                <CustomButton title="Back to Login" type="outline" onPress={() => navigation.goBack()} />
                            </>
                        ) : (
                            <>
                                <Text style={styles.subtitle}>An OTP has been sent to {formData.phone}</Text>
                                <CustomInput label="Enter OTP" placeholder="XXXX" value={otp} onChangeText={setOtp} keyboardType="number-pad" maxLength={4} />
                                <CustomButton title="Verify & Create Account" onPress={handleVerifyOTP} loading={loading} />
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
    container: { flex: 1 },
    scrollContent: {
        padding: theme.spacing.m,
        paddingBottom: 40,
    },
    card: {
        backgroundColor: theme.colors.glassBg,
        padding: theme.spacing.l,
        borderRadius: theme.borderRadius.xl,
        borderWidth: 1,
        borderColor: theme.colors.border,
        marginTop: 40,
        ...theme.shadow.card,
    },
    headerRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: theme.spacing.s,
        gap: 10,
    },
    iconCircle: {
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: theme.colors.glassLight,
        borderWidth: 1,
        borderColor: theme.colors.border,
        justifyContent: 'center',
        alignItems: 'center',
    },
    badge: {
        backgroundColor: theme.colors.glassLight,
        paddingHorizontal: 14,
        paddingVertical: 5,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: theme.colors.border,
    },
    badgeText: {
        color: theme.colors.accent,
        fontWeight: '600',
        fontSize: 12,
        letterSpacing: 0.5,
    } as any,
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
    stepRow: {
        flexDirection: 'row',
        justifyContent: 'center',
        gap: 8,
        marginBottom: theme.spacing.m,
    },
    stepDot: {
        width: 10, height: 10, borderRadius: 5,
        backgroundColor: theme.colors.lightGray,
    },
    stepDotActive: { backgroundColor: theme.colors.accent },
    sectionLabel: {
        fontSize: 12,
        fontWeight: '700',
        color: theme.colors.accent,
        textTransform: 'uppercase',
        letterSpacing: 1.2,
        marginTop: theme.spacing.m,
        marginBottom: theme.spacing.s,
    } as any,
    inputContainer: { marginVertical: theme.spacing.s },
    label: {
        fontSize: 13,
        fontWeight: '600',
        color: theme.colors.textMuted,
        marginBottom: 6,
        letterSpacing: 0.5,
    } as any,
    genderRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 8 },
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
    genderText: { color: theme.colors.textMuted, fontWeight: '500' } as any,
    genderTextSelected: { color: '#0B1120', fontWeight: '700' } as any,
    pickerButton: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        borderWidth: 1.5,
        borderColor: theme.colors.border,
        borderRadius: theme.borderRadius.m,
        paddingHorizontal: 14,
        paddingVertical: 13,
        backgroundColor: theme.colors.bgCard,
    },
    pickerValue: { color: theme.colors.text, fontSize: 15 },
    pickerPlaceholder: { color: theme.colors.gray, fontSize: 15 },
    pickerDropdown: {
        borderWidth: 1,
        borderColor: theme.colors.border,
        borderRadius: theme.borderRadius.m,
        marginTop: 4,
        backgroundColor: theme.colors.bgCard,
        overflow: 'hidden',
    },
    pickerItem: {
        paddingHorizontal: 14,
        paddingVertical: 12,
        borderBottomWidth: 1,
        borderBottomColor: theme.colors.border,
    },
    pickerItemSelected: { backgroundColor: theme.colors.glassLight },
    pickerItemText: { color: theme.colors.textSecondary, fontSize: 15 },
    pickerItemTextSelected: { color: theme.colors.accent, fontWeight: '600' } as any,
});

export default DoctorRegisterScreen;
