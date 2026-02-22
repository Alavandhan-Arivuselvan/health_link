
import React, { useState } from 'react';
import { View, StyleSheet, Text, Alert, KeyboardAvoidingView, ScrollView, Platform } from 'react-native';
import GradientBackground from '../../components/GradientBackground';
import CustomInput from '../../components/CustomInput';
import CustomButton from '../../components/CustomButton';
import { doctorAPI } from '../../services/api';
import { theme } from '../../theme';
import { useNavigation } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';

const DoctorLoginScreen = () => {
    const navigation = useNavigation();
    const [licenseNumber, setLicenseNumber] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);

    const handleLogin = async () => {
        if (!licenseNumber || !password) {
            Alert.alert('Error', 'Please enter your license number and password');
            return;
        }
        setLoading(true);
        try {
            const response = await doctorAPI.login({ license_number: licenseNumber, password });
            if (response.data.status === 'success') {
                await AsyncStorage.setItem('doctor_license', licenseNumber);
                await AsyncStorage.setItem('user_role', 'doctor');
                navigation.reset({ index: 0, routes: [{ name: 'AppTabs' as never }] });
            } else {
                Alert.alert('Login Failed', response.data.message);
            }
        } catch (error) {
            Alert.alert('Error', 'Login failed. Please try again.');
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
                            <Ionicons name="medkit" size={32} color={theme.colors.accent} />
                        </View>
                        <Text style={styles.brandName}>Doctor Portal</Text>
                        <Text style={styles.brandTagline}>Secure medical professional access</Text>
                    </View>

                    <View style={styles.card}>
                        <Text style={styles.title}>Doctor Login</Text>
                        <Text style={styles.subtitle}>Sign in with your medical credentials</Text>

                        <CustomInput
                            label="Medical License Number"
                            placeholder="e.g. MCI-12345"
                            value={licenseNumber}
                            onChangeText={setLicenseNumber}
                            autoCapitalize="characters"
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
