
import React, { useState } from 'react';
import { View, StyleSheet, Text, Alert } from 'react-native';
import GradientBackground from '../../components/GradientBackground';
import CustomInput from '../../components/CustomInput';
import CustomButton from '../../components/CustomButton';
import { authAPI } from '../../services/api';
import { theme } from '../../theme';
import { useNavigation } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';

const LoginScreen = () => {
    const navigation = useNavigation();
    const [step, setStep] = useState(1); // 1: Login, 2: OTP
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
                // Login success, request OTP
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
                // Navigate to Home
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
                        <CustomButton
                            title="Login"
                            onPress={handleLogin}
                            loading={loading}
                        />
                        <CustomButton
                            title="Register New Account"
                            type="outline"
                            onPress={() => navigation.navigate('Register')}
                        />
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
                        <CustomButton
                            title="Verify & Login"
                            onPress={handleVerifyOTP}
                            loading={loading}
                        />
                        <CustomButton
                            title="Back"
                            type="outline"
                            onPress={() => setStep(1)}
                        />
                    </>
                )}
            </View>
        </GradientBackground>
    );
};

const styles = StyleSheet.create({
    container: {
        justifyContent: 'center',
        padding: theme.spacing.m,
    },
    card: {
        backgroundColor: theme.colors.white,
        padding: theme.spacing.l,
        borderRadius: theme.borderRadius.l,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.25,
        shadowRadius: 3.84,
        elevation: 5,
    },
    title: {
        ...theme.typography.h1,
        textAlign: 'center',
        marginBottom: theme.spacing.l,
    },
    subtitle: {
        textAlign: 'center',
        marginBottom: theme.spacing.m,
        color: theme.colors.gray,
    },
});

export default LoginScreen;
