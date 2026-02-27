
import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import DashboardStack from './DashboardStack';
import ChatScreen from '../screens/home/ChatScreen';
import WebScreen from '../screens/home/WebScreen';
import IngestScreen from '../screens/home/IngestScreen';
import QRScreen from '../screens/home/QRScreen';
import StatsScreen from '../screens/home/StatsScreen';
import { theme } from '../theme';

const Tab = createBottomTabNavigator();

const getTabIcon = (routeName: string): keyof typeof Ionicons.glyphMap => {
    switch (routeName) {
        case 'Dashboard': return 'home';
        case 'Chat': return 'chatbubble';
        case 'Web': return 'stats-chart';
        case 'Upload': return 'cloud-upload';
        case 'QR': return 'qr-code';
        case 'Stats': return 'pulse';
        default: return 'ellipse';
    }
};

const AppTabs = () => {
    return (
        <Tab.Navigator
            screenOptions={({ route }) => ({
                headerShown: false,
                tabBarActiveTintColor: theme.colors.accent,
                tabBarInactiveTintColor: theme.colors.gray,
                tabBarStyle: {
                    backgroundColor: theme.colors.bgCard,
                    borderTopWidth: 0,
                    elevation: 20,
                    shadowColor: '#000',
                    shadowOpacity: 0.4,
                    shadowRadius: 15,
                    height: 80,
                    paddingBottom: 20,
                    paddingTop: 10,
                },
                tabBarLabelStyle: {
                    fontSize: 11,
                    fontWeight: '600' as const,
                    letterSpacing: 0.3,
                },
                tabBarIcon: ({ color, size }) => (
                    <Ionicons name={getTabIcon(route.name)} size={22} color={color} />
                ),
            })}
        >
            <Tab.Screen name="Dashboard" component={DashboardStack} options={{ tabBarLabel: 'Dashboard' }} />
            <Tab.Screen name="Chat" component={ChatScreen} options={{ tabBarLabel: 'Chat' }} />
            <Tab.Screen name="Web" component={WebScreen} options={{ tabBarLabel: 'Visualize' }} />
            <Tab.Screen name="Upload" component={IngestScreen} options={{ tabBarLabel: 'Upload' }} />
            <Tab.Screen name="QR" component={QRScreen} options={{ tabBarLabel: 'QR' }} />
            <Tab.Screen name="Stats" component={StatsScreen} options={{ tabBarLabel: 'Stats' }} />
        </Tab.Navigator>
    );
};

export default AppTabs;
