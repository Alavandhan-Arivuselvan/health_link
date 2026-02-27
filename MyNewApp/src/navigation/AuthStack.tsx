
import React from 'react';
import { createStackNavigator } from '@react-navigation/stack';
import LoginScreen from '../screens/auth/LoginScreen';
import RegisterScreen from '../screens/auth/RegisterScreen';
import DoctorLoginScreen from '../screens/doctor/DoctorLoginScreen';
import DoctorRegisterScreen from '../screens/doctor/DoctorRegisterScreen';

const Stack = createStackNavigator();

const AuthStack = () => {
    return (
        <Stack.Navigator screenOptions={{ headerShown: false }}>
            <Stack.Screen name="Login" component={LoginScreen} />
            <Stack.Screen name="Register" component={RegisterScreen} />
            <Stack.Screen name="DoctorLogin" component={DoctorLoginScreen} />
            <Stack.Screen name="DoctorRegister" component={DoctorRegisterScreen} />
        </Stack.Navigator>
    );
};

export default AuthStack;
