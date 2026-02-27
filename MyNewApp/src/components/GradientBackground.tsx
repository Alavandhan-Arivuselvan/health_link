
import React from 'react';
import { StyleSheet, ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

interface Props {
    children: React.ReactNode;
    style?: ViewStyle;
}

const GradientBackground: React.FC<Props> = ({ children, style }) => {
    return (
        <LinearGradient
            colors={['#0B1120', '#162033', '#1A2840']}
            style={[styles.container, style]}
        >
            {children}
        </LinearGradient>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
});

export default GradientBackground;
