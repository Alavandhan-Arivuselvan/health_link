
import React from 'react';
import { createStackNavigator } from '@react-navigation/stack';
import DashboardScreen from '../screens/home/DashboardScreen';
import ReportHistoryScreen from '../screens/home/ReportHistoryScreen';
import ReportDetailScreen from '../screens/home/ReportDetailScreen';

const Stack = createStackNavigator();

const DashboardStack = () => {
    return (
        <Stack.Navigator screenOptions={{ headerShown: false }}>
            <Stack.Screen name="DashboardHome" component={DashboardScreen} />
            <Stack.Screen name="ReportHistory" component={ReportHistoryScreen} />
            <Stack.Screen name="ReportDetail" component={ReportDetailScreen} />
        </Stack.Navigator>
    );
};

export default DashboardStack;
