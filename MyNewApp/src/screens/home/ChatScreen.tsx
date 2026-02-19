
import React, { useState } from 'react';
import { View, StyleSheet, Text, FlatList, TextInput, TouchableOpacity, Alert } from 'react-native';
import GradientBackground from '../../components/GradientBackground';
import { theme } from '../../theme';
import { chatAPI } from '../../services/api';

// Placeholder for document picker - in real app use react-native-document-picker
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
            const response = await chatAPI.sendMessage(newMsg.text);
            const botMsg = { id: (Date.now() + 1).toString(), text: response.data.reply, sender: 'bot' as const };
            setMessages(prev => [...prev, botMsg]);
        } catch (error) {
            const errorMsg = { id: (Date.now() + 1).toString(), text: 'Error connecting to backend.', sender: 'bot' as const };
            setMessages(prev => [...prev, errorMsg]);
        }
    };

    const handleFileUpload = async () => {
        // This is a placeholder. Real implementation needs react-native-document-picker
        Alert.alert('File Upload', 'Feature requires react-native-document-picker. Integrating placeholder logic.');

        // Simulating upload
        /*
        const formData = new FormData();
        formData.append('file', {
          uri: 'path/to/file',
          type: 'image/jpeg',
          name: 'upload.jpg',
        });
        await api.post('/upload', formData, { headers: { 'Content-Type': 'multipart/form-data' } });
        */
    };

    return (
        <GradientBackground style={styles.container}>
            <FlatList
                data={messages}
                keyExtractor={item => item.id}
                renderItem={({ item }) => (
                    <View style={[
                        styles.messageBubble,
                        item.sender === 'user' ? styles.userBubble : styles.botBubble
                    ]}>
                        <Text style={styles.messageText}>{item.text}</Text>
                    </View>
                )}
                contentContainerStyle={styles.listContent}
            />

            <View style={styles.inputContainer}>
                <TouchableOpacity style={styles.attachButton} onPress={handleFileUpload}>
                    <Text style={styles.attachText}>+</Text>
                </TouchableOpacity>
                <TextInput
                    style={styles.input}
                    value={inputText}
                    onChangeText={setInputText}
                    placeholder="Type a message..."
                />
                <TouchableOpacity style={styles.sendButton} onPress={sendMessage}>
                    <Text style={styles.sendText}>Send</Text>
                </TouchableOpacity>
            </View>
        </GradientBackground>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    listContent: {
        padding: theme.spacing.m,
    },
    messageBubble: {
        padding: theme.spacing.m,
        borderRadius: theme.borderRadius.m,
        marginVertical: 4,
        maxWidth: '80%',
    },
    userBubble: {
        alignSelf: 'flex-end',
        backgroundColor: theme.colors.primary,
    },
    botBubble: {
        alignSelf: 'flex-start',
        backgroundColor: theme.colors.white,
    },
    messageText: {
        color: theme.colors.text,
    },
    inputContainer: {
        flexDirection: 'row',
        padding: theme.spacing.m,
        backgroundColor: theme.colors.white,
        alignItems: 'center',
    },
    input: {
        flex: 1,
        height: 40,
        borderWidth: 1,
        borderColor: theme.colors.lightGray,
        borderRadius: 20,
        paddingHorizontal: 15,
        marginHorizontal: 10,
    },
    attachButton: {
        padding: 10,
    },
    attachText: {
        fontSize: 24,
        color: theme.colors.primary,
    },
    sendButton: {
        padding: 10,
    },
    sendText: {
        fontWeight: 'bold',
        color: theme.colors.primary,
    },
});

export default ChatScreen;
