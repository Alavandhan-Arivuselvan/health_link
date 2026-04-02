
import React from 'react';
import { createStackNavigator } from '@react-navigation/stack';
import HomeScreen from '../screens/home/HomeScreen';
import DashboardScreen from '../screens/home/DashboardScreen';
import ReportHistoryScreen from '../screens/home/ReportHistoryScreen';
import ReportDetailScreen from '../screens/home/ReportDetailScreen';
import FitbitInsightsScreen from '../screens/home/FitbitInsightsScreen';
import LessonScreen from '../screens/home/LessonScreen';
import ChatScreen from '../screens/home/ChatScreen';

const Stack = createStackNavigator();

const DashboardStack = () => {
    return (
        <Stack.Navigator screenOptions={{ headerShown: false }}>
            <Stack.Screen name="Home" component={HomeScreen} />
            <Stack.Screen name="DashboardView" component={DashboardScreen} />
            <Stack.Screen name="ReportHistory" component={ReportHistoryScreen} />
            <Stack.Screen name="ReportDetail" component={ReportDetailScreen} />
            <Stack.Screen name="FitbitInsights" component={FitbitInsightsScreen} />
            <Stack.Screen name="Lesson" component={LessonScreen} />
            <Stack.Screen name="Chat" component={ChatScreen} />
        </Stack.Navigator>
    );
};

export default DashboardStack;

