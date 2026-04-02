
import React, { useState, useEffect } from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import DashboardStack from './DashboardStack';
import VisualizeScreen from '../screens/home/VisualizeScreen';
import IngestScreen from '../screens/home/IngestScreen';
import QRScreen from '../screens/home/QRScreen';
import StatsScreen from '../screens/home/StatsScreen';
import DoctorScanScreen from '../screens/doctor/DoctorScanScreen';
import { theme } from '../theme';

const Tab = createBottomTabNavigator();

const getTabIcon = (routeName: string): keyof typeof Ionicons.glyphMap => {
    switch (routeName) {
        case 'Home': return 'home';
        case 'Web': return 'body';
        case 'Upload': return 'cloud-upload';
        case 'QR': return 'qr-code';
        case 'ScanQR': return 'scan';
        case 'Stats': return 'pulse';
        default: return 'ellipse';
    }
};

const AppTabs = () => {
    const [role, setRole] = useState<string>('patient');

    useEffect(() => {
        AsyncStorage.getItem('user_role').then(r => setRole(r || 'patient'));
    }, []);

    const isDoctor = role === 'doctor';

    return (
        <Tab.Navigator
            screenOptions={({ route }) => ({
                headerShown: false,
                tabBarActiveTintColor: theme.colors.accent,
                tabBarInactiveTintColor: theme.colors.gray,
                tabBarStyle: {
                    position: 'absolute',
                    bottom: 16,
                    left: 16,
                    right: 16,
                    height: 64,
                    borderRadius: 999,
                    backgroundColor: theme.colors.bgCard,
                    borderTopWidth: 0,
                    borderWidth: 1,
                    borderColor: theme.colors.border,
                    paddingBottom: 8,
                    paddingTop: 8,
                    ...theme.shadow.card,
                },
                tabBarLabelStyle: {
                    fontSize: 10,
                    fontWeight: '600' as const,
                    letterSpacing: 0.3,
                },
                tabBarIcon: ({ color, size }) => (
                    <Ionicons name={getTabIcon(route.name)} size={20} color={color} />
                ),
            })}
        >
            {isDoctor ? (
                <Tab.Screen name="ScanQR" component={DoctorScanScreen} options={{ tabBarLabel: 'Scan QR' }} />
            ) : (
                <>
                    <Tab.Screen name="Home" component={DashboardStack} options={{ tabBarLabel: 'Home' }} />
                    <Tab.Screen name="Web" component={VisualizeScreen} options={{ tabBarLabel: 'Visualize' }} />
                    <Tab.Screen name="Upload" component={IngestScreen} options={{ tabBarLabel: 'Upload' }} />
                    <Tab.Screen name="QR" component={QRScreen} options={{ tabBarLabel: 'QR' }} />
                    <Tab.Screen name="Stats" component={StatsScreen} options={{ tabBarLabel: 'Stats' }} />
                </>
            )}
        </Tab.Navigator>
    );
};

export default AppTabs;
