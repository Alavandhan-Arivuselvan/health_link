
import React, { useState } from 'react';
import { TextInput, StyleSheet, View, Text, TextInputProps } from 'react-native';
import { theme } from '../theme';

interface Props extends TextInputProps {
    label?: string;
    error?: string;
}

const CustomInput: React.FC<Props> = ({ label, error, style, ...props }) => {
    const [focused, setFocused] = useState(false);

    return (
        <View style={styles.container}>
            {label && <Text style={styles.label}>{label}</Text>}
            <TextInput
                style={[
                    styles.input,
                    focused && styles.inputFocused,
                    error ? styles.inputError : null,
                    style,
                ]}
                placeholderTextColor={theme.colors.gray}
                onFocus={(e) => { setFocused(true); props.onFocus?.(e); }}
                onBlur={(e) => { setFocused(false); props.onBlur?.(e); }}
                {...props}
            />
            {error && <Text style={styles.errorText}>{error}</Text>}
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        marginVertical: theme.spacing.s,
    },
    label: {
        fontSize: 13,
        fontWeight: '600',
        color: theme.colors.textMuted,
        marginBottom: 6,
        letterSpacing: 0.5,
        textTransform: 'uppercase',
    } as any,
    input: {
        height: 52,
        backgroundColor: theme.colors.bgCard,
        borderRadius: theme.borderRadius.m,
        paddingHorizontal: theme.spacing.m,
        borderWidth: 1.5,
        borderColor: theme.colors.border,
        color: theme.colors.text,
        fontSize: 15,
    },
    inputFocused: {
        borderColor: theme.colors.accent,
        backgroundColor: theme.colors.bgCardLight,
    },
    inputError: {
        borderColor: theme.colors.error,
    },
    errorText: {
        color: theme.colors.error,
        fontSize: 12,
        marginTop: 4,
    },
});

export default CustomInput;
