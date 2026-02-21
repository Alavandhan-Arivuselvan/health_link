
import React from 'react';
import { StatusBar } from 'react-native';
import RootNavigator from './src/navigation/RootNavigator';
import { theme } from './src/theme';

const App = () => {
    return (
        <>
            <StatusBar backgroundColor={theme.colors.primary} barStyle="light-content" />
            <RootNavigator />
        </>
    );
};

export default App;
