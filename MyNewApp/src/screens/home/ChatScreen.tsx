
import React, { useState, useRef, useEffect } from 'react';
import {
    View,
    StyleSheet,
    Text,
    FlatList,
    TextInput,
    TouchableOpacity,
    KeyboardAvoidingView,
    Platform,
    Animated,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import GradientBackground from '../../components/GradientBackground';
import { theme } from '../../theme';
import { chatAPI } from '../../services/api';
import { Ionicons } from '@expo/vector-icons';

// ═══════════════════════════════════════════════════════════════════
// Typing Indicator Component
// ═══════════════════════════════════════════════════════════════════
const TypingIndicator = () => {
    const dot1 = useRef(new Animated.Value(0)).current;
    const dot2 = useRef(new Animated.Value(0)).current;
    const dot3 = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        const createDotAnim = (dot: Animated.Value, delay: number) =>
            Animated.loop(
                Animated.sequence([
                    Animated.delay(delay),
                    Animated.timing(dot, { toValue: 1, duration: 300, useNativeDriver: true }),
                    Animated.timing(dot, { toValue: 0, duration: 300, useNativeDriver: true }),
                    Animated.delay(600 - delay),
                ])
            );

        const anim1 = createDotAnim(dot1, 0);
        const anim2 = createDotAnim(dot2, 200);
        const anim3 = createDotAnim(dot3, 400);

        anim1.start();
        anim2.start();
        anim3.start();

        return () => {
            anim1.stop();
            anim2.stop();
            anim3.stop();
        };
    }, []);

    const renderDot = (anim: Animated.Value) => ({
        transform: [
            {
                translateY: anim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0, -6],
                }),
            },
        ],
        opacity: anim.interpolate({
            inputRange: [0, 1],
            outputRange: [0.4, 1],
        }),
    });

    return (
        <View style={styles.typingContainer}>
            <Animated.View style={[styles.typingDot, renderDot(dot1)]} />
            <Animated.View style={[styles.typingDot, renderDot(dot2)]} />
            <Animated.View style={[styles.typingDot, renderDot(dot3)]} />
        </View>
    );
};

// ═══════════════════════════════════════════════════════════════════
// Message Type
// ═══════════════════════════════════════════════════════════════════
interface Message {
    id: string;
    text: string;
    sender: 'user' | 'bot';
    timestamp: string;
    isError?: boolean;
    retryText?: string;
}

const formatTime = () => {
    const now = new Date();
    return now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
};

// ═══════════════════════════════════════════════════════════════════
// ChatScreen
// ═══════════════════════════════════════════════════════════════════
const ChatScreen = () => {
    const [messages, setMessages] = useState<Message[]>([
        {
            id: '1',
            text: "Hello! 👋 I'm your HealthLink assistant. Ask me anything about your health records, medications, or conditions.",
            sender: 'bot',
            timestamp: formatTime(),
        },
    ]);
    const [inputText, setInputText] = useState('');
    const [isTyping, setIsTyping] = useState(false);
    const flatListRef = useRef<FlatList>(null);

    // Auto-scroll to bottom when new messages arrive
    useEffect(() => {
        if (messages.length > 0) {
            setTimeout(() => {
                flatListRef.current?.scrollToEnd({ animated: true });
            }, 100);
        }
    }, [messages, isTyping]);

    const sendMessage = async (overrideText?: string) => {
        const text = (overrideText || inputText).trim();
        if (!text) return;

        const newMsg: Message = {
            id: Date.now().toString(),
            text,
            sender: 'user',
            timestamp: formatTime(),
        };
        setMessages(prev => [...prev, newMsg]);
        if (!overrideText) setInputText('');
        setIsTyping(true);

        try {
            const userPhone = (await AsyncStorage.getItem('user_phone')) || '';
            const response = await chatAPI.sendMessage(text, userPhone);
            const replyText = response.data.reply || 'Sorry, I could not process that.';
            const botMsg: Message = {
                id: (Date.now() + 1).toString(),
                text: replyText,
                sender: 'bot',
                timestamp: formatTime(),
            };
            setMessages(prev => [...prev, botMsg]);
        } catch (error) {
            const errorMsg: Message = {
                id: (Date.now() + 1).toString(),
                text: 'Failed to connect to the server. Please check your connection and try again.',
                sender: 'bot',
                timestamp: formatTime(),
                isError: true,
                retryText: text,
            };
            setMessages(prev => [...prev, errorMsg]);
        } finally {
            setIsTyping(false);
        }
    };

    const handleRetry = (retryText: string) => {
        // Remove the error message
        setMessages(prev => prev.filter(m => !m.isError || m.retryText !== retryText));
        sendMessage(retryText);
    };

    const renderMessage = ({ item }: { item: Message }) => (
        <View
            style={[
                styles.messageBubble,
                item.sender === 'user' ? styles.userBubble : styles.botBubble,
                item.isError && styles.errorBubble,
            ]}
        >
            <Text
                style={[
                    styles.messageText,
                    item.sender === 'user' && styles.userMessageText,
                    item.isError && styles.errorMessageText,
                ]}
            >
                {item.text}
            </Text>
            <View style={styles.messageFooter}>
                <Text style={[styles.timestamp, item.sender === 'user' && styles.userTimestamp]}>
                    {item.timestamp}
                </Text>
                {item.isError && item.retryText && (
                    <TouchableOpacity
                        style={styles.retryBtn}
                        onPress={() => handleRetry(item.retryText!)}
                    >
                        <Ionicons name="refresh" size={12} color={theme.colors.error} />
                        <Text style={styles.retryText}>Retry</Text>
                    </TouchableOpacity>
                )}
            </View>
        </View>
    );

    return (
        <GradientBackground style={styles.container}>
            <KeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                style={{ flex: 1 }}
                keyboardVerticalOffset={80}
            >
                {/* Header */}
                <View style={styles.header}>
                    <View style={styles.headerIcon}>
                        <Ionicons name="chatbubble-ellipses" size={18} color={theme.colors.accent} />
                    </View>
                    <View style={{ flex: 1 }}>
                        <Text style={styles.headerTitle}>Health Assistant</Text>
                        <View style={styles.statusRow}>
                            <View style={[styles.statusDot, isTyping && styles.statusDotActive]} />
                            <Text style={styles.headerSub}>
                                {isTyping ? 'Typing...' : 'AI-powered medical chat'}
                            </Text>
                        </View>
                    </View>
                </View>

                <FlatList
                    ref={flatListRef}
                    data={messages}
                    keyExtractor={item => item.id}
                    renderItem={renderMessage}
                    contentContainerStyle={styles.listContent}
                    showsVerticalScrollIndicator={false}
                    onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
                    ListFooterComponent={
                        isTyping ? (
                            <View style={[styles.messageBubble, styles.botBubble, styles.typingBubble]}>
                                <TypingIndicator />
                            </View>
                        ) : null
                    }
                />

                {/* Input bar */}
                <View style={styles.inputContainer}>
                    <TextInput
                        style={styles.input}
                        value={inputText}
                        onChangeText={setInputText}
                        placeholder="Type a message..."
                        placeholderTextColor={theme.colors.gray}
                        onSubmitEditing={() => sendMessage()}
                        returnKeyType="send"
                        multiline={false}
                    />
                    <TouchableOpacity
                        style={[styles.sendButton, !inputText.trim() && styles.sendButtonDisabled]}
                        onPress={() => sendMessage()}
                        disabled={!inputText.trim() || isTyping}
                    >
                        <Ionicons
                            name="send"
                            size={18}
                            color={inputText.trim() ? theme.colors.bgDark : theme.colors.gray}
                        />
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
    statusRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: 2,
    },
    statusDot: {
        width: 6,
        height: 6,
        borderRadius: 3,
        backgroundColor: theme.colors.gray,
        marginRight: 6,
    },
    statusDotActive: {
        backgroundColor: theme.colors.accent,
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
    errorBubble: {
        backgroundColor: 'rgba(248,81,73,0.08)',
        borderWidth: 1,
        borderColor: 'rgba(248,81,73,0.2)',
    },
    typingBubble: {
        paddingVertical: 18,
        paddingHorizontal: 20,
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
    errorMessageText: {
        color: theme.colors.errorLight,
    },
    messageFooter: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginTop: 6,
    },
    timestamp: {
        fontSize: 10,
        color: theme.colors.textMuted,
        opacity: 0.6,
    },
    userTimestamp: {
        color: 'rgba(13,17,23,0.5)',
    },
    retryBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 8,
        backgroundColor: 'rgba(248,81,73,0.1)',
    },
    retryText: {
        fontSize: 11,
        fontWeight: '600',
        color: theme.colors.error,
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
    sendButtonDisabled: {
        backgroundColor: theme.colors.bgDark,
    },

    // Typing indicator
    typingContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 5,
    },
    typingDot: {
        width: 8,
        height: 8,
        borderRadius: 4,
        backgroundColor: theme.colors.accent,
    },
});

export default ChatScreen;
