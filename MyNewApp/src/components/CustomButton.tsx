
import React from 'react';
import { TouchableOpacity, Text, StyleSheet, ActivityIndicator, ViewStyle, TextStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
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
    if (type === 'primary') {
        return (
            <TouchableOpacity
                onPress={onPress}
                disabled={disabled || loading}
                activeOpacity={0.8}
                style={[styles.wrapper, style]}
            >
                <LinearGradient
                    colors={disabled ? ['#3A4A5A', '#3A4A5A'] : ['#00D4AA', '#00B894']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={styles.gradient}
                >
                    {loading ? (
                        <ActivityIndicator color={theme.colors.white} />
                    ) : (
                        <Text style={[styles.text, textStyle]}>{title}</Text>
                    )}
                </LinearGradient>
            </TouchableOpacity>
        );
    }

    return (
        <TouchableOpacity
            style={[
                styles.container,
                type === 'outline' && styles.outline,
                disabled && styles.disabled,
                style
            ]}
            onPress={onPress}
            disabled={disabled || loading}
            activeOpacity={0.7}
        >
            {loading ? (
                <ActivityIndicator color={theme.colors.accent} />
            ) : (
                <Text style={[
                    styles.text,
                    type === 'outline' && styles.outlineText,
                    textStyle
                ]}>{title}</Text>
            )}
        </TouchableOpacity>
    );
};

const styles = StyleSheet.create({
    wrapper: {
        marginVertical: theme.spacing.s,
        borderRadius: theme.borderRadius.m,
        overflow: 'hidden',
        ...theme.shadow.card,
    },
    gradient: {
        height: 52,
        borderRadius: theme.borderRadius.m,
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: theme.spacing.l,
    },
    container: {
        height: 52,
        borderRadius: theme.borderRadius.m,
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: theme.spacing.l,
        marginVertical: theme.spacing.s,
    },
    outline: {
        borderWidth: 1.5,
        borderColor: theme.colors.border,
        backgroundColor: 'transparent',
    },
    disabled: {
        opacity: 0.5,
    },
    text: {
        ...theme.typography.button,
    },
    outlineText: {
        color: theme.colors.accent,
    },
});

export default CustomButton;
