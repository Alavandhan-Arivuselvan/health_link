
import React from 'react';
import { TextInput, StyleSheet, View, Text, TextInputProps } from 'react-native';
import { theme } from '../theme';

interface Props extends TextInputProps {
    label?: string;
    error?: string;
}

const CustomInput: React.FC<Props> = ({ label, error, style, ...props }) => {
    return (
        <View style={styles.container}>
            {label && <Text style={styles.label}>{label}</Text>}
            <TextInput
                style={[styles.input, error ? styles.inputError : null, style]}
                placeholderTextColor={theme.colors.gray}
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
        ...theme.typography.label,
        marginBottom: theme.spacing.s,
        color: theme.colors.text,
    },
    input: {
        height: 50,
        backgroundColor: theme.colors.white,
        borderRadius: theme.borderRadius.m,
        paddingHorizontal: theme.spacing.m,
        borderWidth: 1,
        borderColor: theme.colors.lightGray,
        color: theme.colors.text,
        fontSize: 16,
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
