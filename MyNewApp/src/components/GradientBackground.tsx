
import React from 'react';
import { StyleSheet, View, ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { theme } from '../theme';

interface Props {
    children: React.ReactNode;
    style?: ViewStyle;
}

const GradientBackground: React.FC<Props> = ({ children, style }) => {
    return (
        <LinearGradient
            colors={[theme.colors.secondary, theme.colors.primary]}
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
