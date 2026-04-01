
import React from 'react';
import { View, StyleSheet, Text, FlatList } from 'react-native';
import GradientBackground from '../../components/GradientBackground';
import CustomButton from '../../components/CustomButton';
import { theme } from '../../theme';
import { Ionicons } from '@expo/vector-icons';

const doctors = [
    { id: '1', name: 'Dr. John Doe', spec: 'Cardiologist', icon: 'heart' },
    { id: '2', name: 'Dr. Jane Smith', spec: 'Dermatologist', icon: 'body' },
    { id: '3', name: 'Dr. Emily White', spec: 'Pediatrician', icon: 'happy' },
];

const DoctorScreen = () => {
    return (
        <GradientBackground style={styles.container}>
            <View style={styles.headerArea}>
                <Text style={styles.header}>Find a Doctor</Text>
                <Text style={styles.headerSub}>Browse available specialists</Text>
            </View>
            <FlatList
                data={doctors}
                keyExtractor={item => item.id}
                renderItem={({ item }) => (
                    <View style={styles.card}>
                        <View style={styles.avatarCircle}>
                            <Ionicons name={item.icon as any} size={22} color={theme.colors.accent} />
                        </View>
                        <View style={styles.info}>
                            <Text style={styles.name}>{item.name}</Text>
                            <Text style={styles.spec}>{item.spec}</Text>
                        </View>
                        <CustomButton
                            title="Consult"
                            onPress={() => { }}
                            style={styles.button}
                            textStyle={{ fontSize: 13 }}
                        />
                    </View>
                )}
                contentContainerStyle={styles.listContent}
            />
        </GradientBackground>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    headerArea: {
        paddingHorizontal: theme.spacing.m,
        paddingTop: 50,
        paddingBottom: theme.spacing.s,
    },
    header: {
        ...theme.typography.h2,
    },
    headerSub: {
        fontSize: 14,
        color: theme.colors.textMuted,
        marginTop: 2,
    },
    listContent: {
        padding: theme.spacing.m,
    },
    card: {
        backgroundColor: theme.colors.bgCard,
        flexDirection: 'row',
        alignItems: 'center',
        padding: theme.spacing.m,
        borderRadius: theme.borderRadius.m,
        marginBottom: theme.spacing.s,
        ...theme.shadow.card,
    },
    avatarCircle: {
        width: 48,
        height: 48,
        borderRadius: 16,
        backgroundColor: 'rgba(0,201,167,0.1)',
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: theme.spacing.m,
    },
    info: {
        flex: 1,
    },
    name: {
        ...theme.typography.h3,
        fontSize: 16,
    },
    spec: {
        color: theme.colors.textMuted,
        fontSize: 13,
        marginTop: 2,
    },
    button: {
        height: 36,
        paddingHorizontal: 14,
        borderRadius: 18,
    },
});

export default DoctorScreen;
