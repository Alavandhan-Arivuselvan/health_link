
import React from 'react';
import { View, StyleSheet, Text, FlatList, Image } from 'react-native';
import GradientBackground from '../../components/GradientBackground';
import CustomButton from '../../components/CustomButton';
import { theme } from '../../theme';

const doctors = [
    { id: '1', name: 'Dr. John Doe', spec: 'Cardiologist' },
    { id: '2', name: 'Dr. Jane Smith', spec: 'Dermatologist' },
    { id: '3', name: 'Dr. Emily White', spec: 'Pediatrician' },
];

const DoctorScreen = () => {
    return (
        <GradientBackground style={styles.container}>
            <Text style={styles.header}>Find a Doctor</Text>
            <FlatList
                data={doctors}
                keyExtractor={item => item.id}
                renderItem={({ item }) => (
                    <View style={styles.card}>
                        <View style={styles.avatarPlaceholder} />
                        <View style={styles.info}>
                            <Text style={styles.name}>{item.name}</Text>
                            <Text style={styles.spec}>{item.spec}</Text>
                        </View>
                        <CustomButton
                            title="Consult"
                            onPress={() => { }}
                            style={styles.button}
                            textStyle={{ fontSize: 14 }}
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
    header: {
        ...theme.typography.h1,
        color: theme.colors.white,
        textAlign: 'center',
        margin: theme.spacing.m,
    },
    listContent: {
        padding: theme.spacing.m,
    },
    card: {
        backgroundColor: theme.colors.white,
        flexDirection: 'row',
        alignItems: 'center',
        padding: theme.spacing.m,
        borderRadius: theme.borderRadius.m,
        marginBottom: theme.spacing.m,
    },
    avatarPlaceholder: {
        width: 50,
        height: 50,
        borderRadius: 25,
        backgroundColor: theme.colors.lightGray,
        marginRight: theme.spacing.m,
    },
    info: {
        flex: 1,
    },
    name: {
        ...theme.typography.h2,
        fontSize: 18,
    },
    spec: {
        color: theme.colors.gray,
    },
    button: {
        height: 36,
        paddingHorizontal: 12,
        borderRadius: 18,
    },
});

export default DoctorScreen;
