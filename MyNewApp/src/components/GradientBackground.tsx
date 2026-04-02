
import React from 'react';
import { View, StyleSheet, ViewStyle, Platform } from 'react-native';

interface Props {
    children: React.ReactNode;
    style?: ViewStyle;
}

const GradientBackground: React.FC<Props> = ({ children, style }) => {
    return (
        <View style={[
            styles.container,
            Platform.OS === 'web' && { height: '100%' as any },
            style,
        ]}>
            {children}
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#0D1117',
    },
});

export default GradientBackground;
