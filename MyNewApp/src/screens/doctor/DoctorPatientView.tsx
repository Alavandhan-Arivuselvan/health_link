
import React, { useState, useEffect, useRef } from 'react';
import {
    View, StyleSheet, Text, TouchableOpacity, TextInput,
    FlatList, KeyboardAvoidingView, Platform, Alert, ActivityIndicator,
} from 'react-native';
import { WebView } from 'react-native-webview';
import GradientBackground from '../../components/GradientBackground';
import { theme } from '../../theme';
import { Ionicons } from '@expo/vector-icons';
import { BASE_URL } from '../../config/host';

type Tab = 'graph' | 'chat';
type Message = { id: string; role: 'user' | 'assistant'; text: string };

const DoctorPatientView = ({ route, navigation }: any) => {
    const { token, patientPhone, ttlSeconds } = route.params;
    const [activeTab, setActiveTab] = useState<Tab>('graph');
    const [remaining, setRemaining] = useState(ttlSeconds);
    const [messages, setMessages] = useState<Message[]>([
        { id: '0', role: 'assistant', text: `Session active. You have access to this patient's health graph. Ask me anything about their medical data.` },
    ]);
    const [input, setInput] = useState('');
    const [sending, setSending] = useState(false);
    const flatListRef = useRef<FlatList>(null);

    // Countdown timer
    useEffect(() => {
        const interval = setInterval(() => {
            setRemaining((prev: number) => {
                if (prev <= 1) {
                    clearInterval(interval);
                    Alert.alert('Session Expired', 'Your access to this patient has been revoked.', [
                        { text: 'OK', onPress: () => navigation.goBack() },
                    ]);
                    return 0;
                }
                return prev - 1;
            });
        }, 1000);
        return () => clearInterval(interval);
    }, []);

    const formatTime = (secs: number) => {
        const m = Math.floor(secs / 60);
        const s = secs % 60;
        return `${m}:${s.toString().padStart(2, '0')}`;
    };

    const sendMessage = async () => {
        const text = input.trim();
        if (!text || sending) return;

        const userMsg: Message = { id: Date.now().toString(), role: 'user', text };
        setMessages(prev => [...prev, userMsg]);
        setInput('');
        setSending(true);

        try {
            const response = await fetch(`${BASE_URL}/api/doctor/patient-chat`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ token, message: text }),
            });

            if (response.status === 401) {
                Alert.alert('Session Expired', 'Your access has been revoked.', [
                    { text: 'OK', onPress: () => navigation.goBack() },
                ]);
                return;
            }

            const data = await response.json();
            const botMsg: Message = {
                id: (Date.now() + 1).toString(),
                role: 'assistant',
                text: data.reply || 'No response received.',
            };
            setMessages(prev => [...prev, botMsg]);
            if (data.remaining_seconds) setRemaining(data.remaining_seconds);
        } catch (err) {
            setMessages(prev => [...prev, {
                id: (Date.now() + 1).toString(),
                role: 'assistant',
                text: 'Could not reach the server. Please try again.',
            }]);
        } finally {
            setSending(false);
        }
    };

    const graphUrl = `${BASE_URL}/api/graph-html`;

    const timerColor = remaining < 300 ? '#EF5350' : remaining < 600 ? '#FFB74D' : theme.colors.accent;

    return (
        <GradientBackground style={styles.container}>
            {/* Top bar with patient info + timer */}
            <View style={styles.topBar}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
                    <Ionicons name="arrow-back" size={22} color={theme.colors.text} />
                </TouchableOpacity>
                <View style={styles.patientInfo}>
                    <Ionicons name="person" size={16} color={theme.colors.accent} />
                    <Text style={styles.patientText}>Patient: {patientPhone}</Text>
                </View>
                <View style={[styles.timerBadge, { borderColor: timerColor }]}>
                    <Ionicons name="time-outline" size={14} color={timerColor} />
                    <Text style={[styles.timerText, { color: timerColor }]}> {formatTime(remaining)}</Text>
                </View>
            </View>

            {/* Tab switcher */}
            <View style={styles.tabBar}>
                <TouchableOpacity
                    style={[styles.tab, activeTab === 'graph' && styles.tabActive]}
                    onPress={() => setActiveTab('graph')}
                >
                    <Ionicons name="git-network-outline" size={18} color={activeTab === 'graph' ? theme.colors.accent : theme.colors.textMuted} />
                    <Text style={[styles.tabText, activeTab === 'graph' && styles.tabTextActive]}>Graph</Text>
                </TouchableOpacity>
                <TouchableOpacity
                    style={[styles.tab, activeTab === 'chat' && styles.tabActive]}
                    onPress={() => setActiveTab('chat')}
                >
                    <Ionicons name="chatbubble-outline" size={18} color={activeTab === 'chat' ? theme.colors.accent : theme.colors.textMuted} />
                    <Text style={[styles.tabText, activeTab === 'chat' && styles.tabTextActive]}>Chat</Text>
                </TouchableOpacity>
            </View>

            {/* Content */}
            {activeTab === 'graph' ? (
                <View style={styles.graphContainer}>
                    {Platform.OS === 'web' ? (
                        <iframe
                            src={graphUrl}
                            style={{ width: '100%', height: '100%', border: 'none', borderRadius: 12 } as any}
                        />
                    ) : (
                        <WebView source={{ uri: graphUrl }} style={{ flex: 1, borderRadius: 12 }} />
                    )}
                </View>
            ) : (
                <KeyboardAvoidingView
                    style={styles.chatContainer}
                    behavior={Platform.OS === 'ios' ? 'padding' : undefined}
                    keyboardVerticalOffset={100}
                >
                    <FlatList
                        ref={flatListRef}
                        data={messages}
                        keyExtractor={(item) => item.id}
                        onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
                        contentContainerStyle={styles.messageList}
                        renderItem={({ item }) => (
                            <View
                                style={[
                                    styles.messageBubble,
                                    item.role === 'user' ? styles.userBubble : styles.botBubble,
                                ]}
                            >
                                <Text style={[
                                    styles.messageText,
                                    item.role === 'user' ? styles.userText : styles.botText,
                                ]}>
                                    {item.text}
                                </Text>
                            </View>
                        )}
                    />

                    <View style={styles.inputRow}>
                        <TextInput
                            style={styles.textInput}
                            placeholder="Ask about this patient..."
                            placeholderTextColor={theme.colors.textMuted}
                            value={input}
                            onChangeText={setInput}
                            onSubmitEditing={sendMessage}
                            editable={!sending && remaining > 0}
                        />
                        <TouchableOpacity
                            style={[styles.sendBtn, (!input.trim() || sending) && styles.sendBtnDisabled]}
                            onPress={sendMessage}
                            disabled={!input.trim() || sending}
                        >
                            {sending ? (
                                <ActivityIndicator size="small" color={theme.colors.bgDark} />
                            ) : (
                                <Ionicons name="send" size={18} color={theme.colors.bgDark} />
                            )}
                        </TouchableOpacity>
                    </View>
                </KeyboardAvoidingView>
            )}
        </GradientBackground>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1 },
    topBar: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
        paddingTop: 50, paddingHorizontal: 16, paddingBottom: 10,
    },
    backBtn: {
        width: 36, height: 36, borderRadius: 18,
        backgroundColor: theme.colors.glassLight, justifyContent: 'center', alignItems: 'center',
    },
    patientInfo: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    patientText: { color: theme.colors.text, fontSize: 14, fontWeight: '600' } as any,
    timerBadge: {
        flexDirection: 'row', alignItems: 'center',
        paddingHorizontal: 10, paddingVertical: 5, borderRadius: 16,
        borderWidth: 1.5, backgroundColor: theme.colors.bgCard,
    },
    timerText: { fontSize: 13, fontWeight: '700' } as any,
    tabBar: {
        flexDirection: 'row', marginHorizontal: 16, marginBottom: 8,
        backgroundColor: theme.colors.bgCard, borderRadius: theme.borderRadius.m,
        borderWidth: 1, borderColor: theme.colors.border, padding: 4,
    },
    tab: {
        flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
        paddingVertical: 10, borderRadius: theme.borderRadius.m - 2, gap: 6,
    },
    tabActive: { backgroundColor: theme.colors.glassLight },
    tabText: { color: theme.colors.textMuted, fontSize: 14, fontWeight: '600' } as any,
    tabTextActive: { color: theme.colors.accent },
    graphContainer: {
        flex: 1, marginHorizontal: 16, marginBottom: 16, borderRadius: 12,
        overflow: 'hidden', borderWidth: 1, borderColor: theme.colors.border,
    },
    chatContainer: { flex: 1 },
    messageList: { paddingHorizontal: 16, paddingBottom: 8 },
    messageBubble: {
        maxWidth: '80%', padding: 12,
        borderRadius: 16, marginVertical: 4,
    },
    userBubble: {
        alignSelf: 'flex-end', backgroundColor: theme.colors.accent,
        borderBottomRightRadius: 4,
    },
    botBubble: {
        alignSelf: 'flex-start', backgroundColor: theme.colors.bgCard,
        borderWidth: 1, borderColor: theme.colors.border, borderBottomLeftRadius: 4,
    },
    messageText: { fontSize: 14, lineHeight: 20 },
    userText: { color: theme.colors.bgDark },
    botText: { color: theme.colors.text },
    inputRow: {
        flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16,
        paddingVertical: 10, gap: 8, borderTopWidth: 1, borderTopColor: theme.colors.border,
    },
    textInput: {
        flex: 1, backgroundColor: theme.colors.bgCard, color: theme.colors.text,
        paddingHorizontal: 16, paddingVertical: 12, borderRadius: 24,
        borderWidth: 1, borderColor: theme.colors.border, fontSize: 14,
    },
    sendBtn: {
        width: 44, height: 44, borderRadius: 22, backgroundColor: theme.colors.accent,
        justifyContent: 'center', alignItems: 'center',
    },
    sendBtnDisabled: { opacity: 0.4 },
});

export default DoctorPatientView;
