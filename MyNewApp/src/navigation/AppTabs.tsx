
import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Text } from 'react-native';
import ChatScreen from '../screens/home/ChatScreen';
import WebScreen from '../screens/home/WebScreen';
import IngestScreen from '../screens/home/IngestScreen';
import StatsScreen from '../screens/home/StatsScreen';
import { theme } from '../theme';

const Tab = createBottomTabNavigator();

// Placeholder icon component until vector icons are installed
const TabIcon = ({ name, color }: { name: string, color: string }) => (
    <Text style={{ color, fontSize: 18, fontWeight: 'bold' as const }}>{name[0]}</Text>
);

const AppTabs = () => {
    return (
        <Tab.Navigator
            screenOptions={({ route }) => ({
                headerShown: false,
                tabBarActiveTintColor: theme.colors.primary,
                tabBarInactiveTintColor: theme.colors.gray,
                tabBarStyle: {
                    backgroundColor: theme.colors.white,
                    borderTopWidth: 0,
                    elevation: 10,
                    shadowColor: '#000',
                    shadowOpacity: 0.1,
                    shadowRadius: 10,
                },
                tabBarIcon: ({ color }) => <TabIcon name={route.name} color={color} />
            })}
        >
            <Tab.Screen name="Chat" component={ChatScreen} options={{ tabBarLabel: 'Chat' }} />
            <Tab.Screen name="Web" component={WebScreen} options={{ tabBarLabel: 'Visualize' }} />
            <Tab.Screen name="Upload" component={IngestScreen} options={{ tabBarLabel: 'Upload' }} />
            <Tab.Screen name="Stats" component={StatsScreen} options={{ tabBarLabel: 'Stats' }} />
        </Tab.Navigator>
    );
};

export default AppTabs;

