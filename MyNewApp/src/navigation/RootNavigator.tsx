
import React from 'react';
import { createStackNavigator } from '@react-navigation/stack';
import { NavigationContainer, NavigationIndependentTree, DefaultTheme } from '@react-navigation/native';
import AuthStack from './AuthStack';
import AppTabs from './AppTabs';
import DoctorScreen from '../screens/doctor/DoctorScreen';
import DoctorPatientView from '../screens/doctor/DoctorPatientView';
import { Button } from 'react-native';
import { theme } from '../theme';

const Stack = createStackNavigator();

// Force dark mode across the entire navigation tree
const DarkNavTheme = {
    ...DefaultTheme,
    dark: true,
    colors: {
        ...DefaultTheme.colors,
        primary: theme.colors.accent,
        background: theme.colors.bgDark,
        card: theme.colors.bgCard,
        text: theme.colors.text,
        border: theme.colors.border,
        notification: theme.colors.error,
    },
};

const darkHeaderStyle = {
    backgroundColor: theme.colors.bgDark,
    shadowColor: 'transparent',
    elevation: 0,
};

const RootNavigator = () => {
    return (
        <NavigationIndependentTree>
            <NavigationContainer theme={DarkNavTheme}>
                <Stack.Navigator
                    screenOptions={{
                        headerShown: false,
                        headerStyle: darkHeaderStyle,
                        headerTintColor: theme.colors.text,
                        headerTitleStyle: { color: theme.colors.text, fontWeight: '700' },
                    }}
                >
                    <Stack.Screen name="Auth" component={AuthStack} />
                    <Stack.Screen
                        name="AppTabs"
                        component={AppTabs}
                        options={{
                            headerShown: true,
                            title: 'HealthLink',
                            headerStyle: darkHeaderStyle,
                        }}
                    />
                    <Stack.Screen
                        name="Doctor"
                        component={DoctorScreen}
                        options={{
                            headerShown: true,
                            title: 'Consult Doctor',
                            headerStyle: darkHeaderStyle,
                        }}
                    />
                    <Stack.Screen
                        name="DoctorPatientView"
                        component={DoctorPatientView}
                        options={{ headerShown: false }}
                    />
                </Stack.Navigator>
            </NavigationContainer>
        </NavigationIndependentTree>
    );
};

export default RootNavigator;
