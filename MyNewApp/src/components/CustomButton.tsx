
import React from 'react';
import { TouchableOpacity, Text, StyleSheet, ActivityIndicator, ViewStyle, TextStyle } from 'react-native';
import { theme } from '../theme';

interface Props {
    title: string;
    onPress: () => void;
    loading?: boolean;
    disabled?: boolean;
    style?: ViewStyle;
    textStyle?: TextStyle;
    type?: 'primary' | 'secondary' | 'outline';
}

const CustomButton: React.FC<Props> = ({
    title,
    onPress,
    loading = false,
    disabled = false,
    style,
    textStyle,
    type = 'primary'
}) => {
    const getBackgroundColor = () => {
        if (disabled) return theme.colors.gray;
        if (type === 'outline') return 'transparent';
        return theme.colors.secondary;
    };

    const getTextColor = () => {
        if (type === 'outline') return theme.colors.secondary;
        return theme.colors.white;
    };

    return (
        <TouchableOpacity
            style={[
                styles.container,
                { backgroundColor: getBackgroundColor(), borderColor: theme.colors.secondary },
                type === 'outline' && styles.outline,
                style
            ]}
            onPress={onPress}
            disabled={disabled || loading}
        >
            {loading ? (
                <ActivityIndicator color={theme.colors.white} />
            ) : (
                <Text style={[styles.text, { color: getTextColor() }, textStyle]}>{title}</Text>
            )}
        </TouchableOpacity>
    );
};

const styles = StyleSheet.create({
    container: {
        height: 50,
        borderRadius: theme.borderRadius.l,
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: theme.spacing.m,
        marginVertical: theme.spacing.s,
        elevation: 2,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
    },
    outline: {
        borderWidth: 2,
    },
    text: {
        fontSize: theme.typography.button.fontSize,
        fontWeight: 'bold',
    },
});

export default CustomButton;
