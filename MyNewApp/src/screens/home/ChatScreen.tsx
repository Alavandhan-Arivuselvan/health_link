
import React, { useState } from 'react';
import { View, StyleSheet, Text, FlatList, TextInput, TouchableOpacity, KeyboardAvoidingView, Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import GradientBackground from '../../components/GradientBackground';
import { theme } from '../../theme';
import { chatAPI } from '../../services/api';
import { Ionicons } from '@expo/vector-icons';

const ChatScreen = () => {
    const [messages, setMessages] = useState<{ id: string, text: string, sender: 'user' | 'bot' }[]>([
        { id: '1', text: 'Hello! How can I help you today?', sender: 'bot' }
    ]);
    const [inputText, setInputText] = useState('');

    const sendMessage = async () => {
        if (!inputText.trim()) return;
        const newMsg = { id: Date.now().toString(), text: inputText, sender: 'user' as const };
        setMessages(prev => [...prev, newMsg]);
        setInputText('');
        try {
            const userPhone = (await AsyncStorage.getItem("user_phone")) || "";
            const response = await chatAPI.sendMessage(newMsg.text, userPhone);
            const botMsg = { id: (Date.now() + 1).toString(), text: response.data.reply, sender: 'bot' as const };
            setMessages(prev => [...prev, botMsg]);
        } catch (error) {
            const errorMsg = { id: (Date.now() + 1).toString(), text: 'Error connecting to backend.', sender: 'bot' as const };
            setMessages(prev => [...prev, errorMsg]);
        }
    };

    return (
        <GradientBackground style={styles.container}>
            <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }} keyboardVerticalOffset={80}>
                {/* Header */}
                <View style={styles.header}>
                    <View style={styles.headerIcon}>
                        <Ionicons name="chatbubble-ellipses" size={18} color={theme.colors.accent} />
                    </View>
                    <View>
                        <Text style={styles.headerTitle}>Health Assistant</Text>
                        <Text style={styles.headerSub}>AI-powered medical chat</Text>
                    </View>
                </View>

                <FlatList
                    data={messages}
                    keyExtractor={item => item.id}
                    renderItem={({ item }) => (
                        <View style={[
                            styles.messageBubble,
                            item.sender === 'user' ? styles.userBubble : styles.botBubble
                        ]}>
                            <Text style={[
                                styles.messageText,
                                item.sender === 'user' && styles.userMessageText
                            ]}>{item.text}</Text>
                        </View>
                    )}
                    contentContainerStyle={styles.listContent}
                />

                {/* Input bar — positioned above the floating tab bar */}
                <View style={styles.inputContainer}>
                    <TextInput
                        style={styles.input}
                        value={inputText}
                        onChangeText={setInputText}
                        placeholder="Type a message..."
                        placeholderTextColor={theme.colors.gray}
                        onSubmitEditing={sendMessage}
                    />
                    <TouchableOpacity style={styles.sendButton} onPress={sendMessage}>
                        <Ionicons name="send" size={18} color={theme.colors.bgDark} />
                    </TouchableOpacity>
                </View>
            </KeyboardAvoidingView>
        </GradientBackground>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 20,
        paddingTop: 48,
        paddingBottom: 12,
    },
    headerIcon: {
        width: 38,
        height: 38,
        borderRadius: 12,
        backgroundColor: 'rgba(0,201,167,0.1)',
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 12,
    },
    headerTitle: {
        ...theme.typography.h3,
    },
    headerSub: {
        fontSize: 12,
        color: theme.colors.textMuted,
    },
    listContent: {
        padding: theme.spacing.m,
        paddingBottom: 8,
    },
    messageBubble: {
        padding: 14,
        borderRadius: theme.borderRadius.m,
        marginVertical: 4,
        maxWidth: '82%',
    },
    userBubble: {
        alignSelf: 'flex-end',
        backgroundColor: theme.colors.accent,
        borderBottomRightRadius: 4,
    },
    botBubble: {
        alignSelf: 'flex-start',
        backgroundColor: theme.colors.bgCard,
        borderBottomLeftRadius: 4,
    },
    messageText: {
        color: theme.colors.textSecondary,
        fontSize: 15,
        lineHeight: 21,
    },
    userMessageText: {
        color: theme.colors.bgDark,
        fontWeight: '500',
    } as any,
    inputContainer: {
        flexDirection: 'row',
        padding: theme.spacing.m,
        paddingBottom: 90,
        backgroundColor: theme.colors.bgCard,
        alignItems: 'center',
    },
    input: {
        flex: 1,
        height: 44,
        borderRadius: 22,
        paddingHorizontal: 18,
        backgroundColor: theme.colors.bgDark,
        color: theme.colors.text,
        fontSize: 15,
    },
    sendButton: {
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: theme.colors.accent,
        justifyContent: 'center',
        alignItems: 'center',
        marginLeft: 10,
    },
});

export default ChatScreen;
