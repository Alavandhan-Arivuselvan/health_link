
import React from 'react';
import { createStackNavigator } from '@react-navigation/stack';
import { NavigationContainer, NavigationIndependentTree } from '@react-navigation/native';
import AuthStack from './AuthStack';
import AppTabs from './AppTabs';
import DoctorScreen from '../screens/doctor/DoctorScreen';
import { Button } from 'react-native';
import { theme } from '../theme';

const Stack = createStackNavigator();

const RootNavigator = () => {
    return (
        <NavigationIndependentTree>
            <NavigationContainer>
                <Stack.Navigator screenOptions={{ headerShown: false }}>
                    <Stack.Screen name="Auth" component={AuthStack} />
                    <Stack.Screen
                        name="AppTabs"
                        component={AppTabs}
                        options={({ navigation }) => ({
                            headerShown: true,
                            title: 'HealthLink',
                            headerRight: () => (
                                <Button
                                    onPress={() => navigation.navigate('Doctor')}
                                    title="Dr."
                                    color={theme.colors.primary}
                                />
                            )
                        })}
                    />
                    <Stack.Screen
                        name="Doctor"
                        component={DoctorScreen}
                        options={{ headerShown: true, title: 'Consult Doctor' }}
                    />
                </Stack.Navigator>
            </NavigationContainer>
        </NavigationIndependentTree>
    );
};

export default RootNavigator;
