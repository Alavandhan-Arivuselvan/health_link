
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
    const isPrimary = type === 'primary';
    const isOutline = type === 'outline';

    return (
        <TouchableOpacity
            onPress={onPress}
            disabled={disabled || loading}
            activeOpacity={0.75}
            style={[
                styles.base,
                isPrimary && styles.primary,
                isOutline && styles.outline,
                !isPrimary && !isOutline && styles.secondary,
                disabled && styles.disabled,
                style,
            ]}
        >
            {loading ? (
                <ActivityIndicator color={isPrimary ? theme.colors.bgDark : theme.colors.accent} />
            ) : (
                <Text style={[
                    styles.text,
                    isPrimary && styles.primaryText,
                    isOutline && styles.outlineText,
                    !isPrimary && !isOutline && styles.secondaryText,
                    textStyle,
                ]}>{title}</Text>
            )}
        </TouchableOpacity>
    );
};

const styles = StyleSheet.create({
    base: {
        height: 48,
        borderRadius: 999,
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: theme.spacing.l,
        marginVertical: theme.spacing.s,
    },
    primary: {
        backgroundColor: theme.colors.accent,
    },
    outline: {
        borderWidth: 1.5,
        borderColor: theme.colors.accent,
        backgroundColor: 'transparent',
    },
    secondary: {
        backgroundColor: theme.colors.bgCard,
        borderWidth: 1,
        borderColor: theme.colors.border,
    },
    disabled: {
        opacity: 0.45,
    },
    text: {
        fontSize: 16,
        fontWeight: '700',
        letterSpacing: 0.2,
    } as any,
    primaryText: {
        color: theme.colors.bgDark,
    },
    outlineText: {
        color: theme.colors.accent,
    },
    secondaryText: {
        color: theme.colors.text,
    },
});

export default CustomButton;
