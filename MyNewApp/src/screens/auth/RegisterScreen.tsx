
import React, { useState } from 'react';
import { View, StyleSheet, Text, Alert, ScrollView, TouchableOpacity } from 'react-native';
import GradientBackground from '../../components/GradientBackground';
import CustomInput from '../../components/CustomInput';
import CustomButton from '../../components/CustomButton';
import { authAPI } from '../../services/api';
import { theme } from '../../theme';
import { useNavigation } from '@react-navigation/native';

const RegisterScreen = () => {
    const navigation = useNavigation();
    const [step, setStep] = useState(1);
    const [formData, setFormData] = useState({
        phone: '',
        name: '',
        dob: '',
        gender: '',
        blood_group: '',
        password: '',
        confirmPassword: '',
    } as any);
    const [otp, setOtp] = useState('');
    const [loading, setLoading] = useState(false);

    const handleChange = (key: string, value: string) => {
        setFormData(prev => ({ ...prev, [key]: value }));
    };

    const validateDate = (date: string) => {
        const regex = /^\d{4}-\d{2}-\d{2}$/;
        return regex.test(date);
    };

    const handleRegister = async () => {
        // Basic validation
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
                phone: formData.phone,
                name: formData.name,
                dob: formData.dob,
                gender: formData.gender,
                blood_group: formData.blood_group,
                password: formData.password
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
        if (!otp) {
            Alert.alert('Error', 'Please enter OTP');
            return;
        }

        setLoading(true);
        try {
            const response = await authAPI.verifyOTP({ phone: formData.phone, otp });
            if (response.data.status === 'success') {
                navigation.reset({
                    index: 0,
                    routes: [{ name: 'AppTabs' }],
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
            <View style={styles.card}>
                <ScrollView contentContainerStyle={styles.scrollContent}>
                    <Text style={styles.title}>{step === 1 ? 'Create Account' : 'Verify Phone'}</Text>

                    {step === 1 ? (
                        <>
                            <CustomInput label="Phone Number" value={formData.phone} onChangeText={t => handleChange('phone', t)} keyboardType="phone-pad" />
                            <CustomInput label="Full Name" value={formData.name} onChangeText={t => handleChange('name', t)} />
                            <CustomInput
                                label="Date of Birth (YYYY-MM-DD)"
                                value={formData.dob}
                                onChangeText={t => handleChange('dob', t)}
                                placeholder="2000-01-01"
                            />

                            <View style={styles.inputContainer}>
                                <Text style={styles.label}>Gender</Text>
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

                            <CustomInput label="Blood Group" value={formData.blood_group} onChangeText={t => handleChange('blood_group', t)} />

                            <CustomInput label="Password" value={formData.password} onChangeText={t => handleChange('password', t)} secureTextEntry />
                            <CustomInput label="Confirm Password" value={formData.confirmPassword} onChangeText={t => handleChange('confirmPassword', t)} secureTextEntry />

                            <CustomButton title="Register" onPress={handleRegister} loading={loading} />
                            <CustomButton title="Back to Login" type="outline" onPress={() => navigation.goBack()} />
                        </>
                    ) : (
                        <>
                            <Text style={styles.subtitle}>OTP sent to {formData.phone}</Text>
                            <CustomInput label="Enter OTP" placeholder="XXXX" value={otp} onChangeText={setOtp} keyboardType="number-pad" maxLength={4} />
                            <CustomButton title="Verify & Complete" onPress={handleVerifyOTP} loading={loading} />
                            <CustomButton title="Back" type="outline" onPress={() => setStep(1)} />
                        </>
                    )}
                </ScrollView>
            </View>
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
        backgroundColor: theme.colors.white,
        padding: theme.spacing.m,
        borderRadius: theme.borderRadius.l,
        maxHeight: '90%',
    },
    scrollContent: {
        paddingBottom: 20
    },
    title: {
        ...theme.typography.h1,
        textAlign: 'center',
        marginBottom: theme.spacing.m,
    },
    subtitle: {
        textAlign: 'center',
        marginBottom: theme.spacing.m,
        color: theme.colors.gray,
    } as any,
    row: {
        flexDirection: 'row',
        justifyContent: 'space-between'
    },
    inputContainer: {
        marginVertical: theme.spacing.s,
    },
    label: {
        ...theme.typography.label,
        marginBottom: theme.spacing.s,
        color: theme.colors.text,
    },
    genderRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
    },
    genderOption: {
        flex: 1,
        padding: 10,
        borderWidth: 1,
        borderColor: theme.colors.lightGray,
        borderRadius: theme.borderRadius.m,
        alignItems: 'center',
        marginHorizontal: 4,
        backgroundColor: theme.colors.white,
    },
    genderOptionSelected: {
        backgroundColor: theme.colors.secondary,
        borderColor: theme.colors.secondary,
    },
    genderText: {
        color: theme.colors.text,
    },
    genderTextSelected: {
        color: theme.colors.white,
        fontWeight: 'bold',
    } as any,
});


export default RegisterScreen;
