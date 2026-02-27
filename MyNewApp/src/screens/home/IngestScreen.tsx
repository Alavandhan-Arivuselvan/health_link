import React from "react";
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    Alert,
    SafeAreaView,
    Platform,
} from "react-native";
import GradientBackground from '../../components/GradientBackground';
import { Ionicons } from "@expo/vector-icons";
import * as DocumentPicker from "expo-document-picker";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { theme } from '../../theme';
import { BASE_URL } from '../../config/host';

// Only import native upload on non-web platforms
let uploadAsyncFn: any = null;
let UploadType: any = null;
if (Platform.OS !== "web") {
    const legacy = require("expo-file-system/legacy");
    uploadAsyncFn = legacy.uploadAsync;
    UploadType = legacy.FileSystemUploadType;
}

const IngestScreen = () => {
    const [selectedFile, setSelectedFile] = React.useState<any>(null);
    const [uploading, setUploading] = React.useState(false);

    const selectFile = async () => {
        try {
            const result = await DocumentPicker.getDocumentAsync({
                type: ["application/pdf", "image/*"],
                copyToCacheDirectory: true,
            });
            if (!result.canceled && result.assets) {
                setSelectedFile(result.assets[0]);
            }
        } catch (error) {
            Alert.alert("Error", "Failed to select file");
        }
    };

    const uploadFile = async () => {
        if (!selectedFile) { Alert.alert("No File", "Please select a file first"); return; }
        setUploading(true);
        try {
            let status: number;
            let body: string;
            const userPhone = (await AsyncStorage.getItem("user_phone")) || "";

            if (Platform.OS === "web") {
                const formData = new FormData();
                if (selectedFile.file) {
                    formData.append("file", selectedFile.file);
                } else {
                    const resp = await fetch(selectedFile.uri);
                    const blob = await resp.blob();
                    formData.append("file", blob, selectedFile.name);
                }
                formData.append("user_phone", userPhone);
                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), 5 * 60 * 1000);
                const response = await fetch(`${BASE_URL}/upload`, {
                    method: "POST", body: formData, signal: controller.signal,
                });
                clearTimeout(timeoutId);
                body = await response.text();
                status = response.status;
            } else {
                const uploadResult = await uploadAsyncFn(
                    `${BASE_URL}/upload`, selectedFile.uri, {
                    fieldName: "file", httpMethod: "POST",
                    uploadType: UploadType.MULTIPART,
                    mimeType: selectedFile.mimeType || "application/pdf",
                    parameters: { user_phone: userPhone },
                }
                );
                status = uploadResult.status;
                body = uploadResult.body;
            }

            if (status !== 200) {
                const err = JSON.parse(body || "{}");
                Alert.alert("Upload Failed", err.detail || "Server rejected the file");
                return;
            }

            const old = await AsyncStorage.getItem("records");
            const arr = old ? JSON.parse(old) : [];
            arr.push(selectedFile.name);
            await AsyncStorage.setItem("records", JSON.stringify(arr));
            Alert.alert("Success", "File uploaded! Processing in background. ✅");
            setSelectedFile(null);
        } catch (error) {
            console.log("Upload exception:", error);
            Alert.alert("Error", "Failed to upload file");
        } finally {
            setUploading(false);
        }
    };

    return (
        <GradientBackground>
            <SafeAreaView style={{ flex: 1 }}>
                <View style={styles.content}>
                    {/* Header */}
                    <View style={styles.headerIcon}>
                        <Ionicons name="document-text" size={28} color={theme.colors.accent} />
                    </View>
                    <Text style={styles.title}>Upload Medical Records</Text>
                    <Text style={styles.subtitle}>Securely store your PDFs and reports</Text>

                    {/* Card */}
                    <View style={styles.card}>
                        <View style={styles.uploadIconCircle}>
                            <Ionicons name="cloud-upload-outline" size={48} color={theme.colors.accent} />
                        </View>

                        <Text style={styles.cardTitle}>Upload PDF / Image</Text>
                        <Text style={styles.cardDesc}>Select your medical document</Text>

                        <TouchableOpacity style={styles.selectBtn} onPress={selectFile}>
                            <Ionicons name="document-outline" size={18} color={theme.colors.text} />
                            <Text style={styles.btnText}>
                                {selectedFile ? "  Change File" : "  Select File"}
                            </Text>
                        </TouchableOpacity>

                        {selectedFile && (
                            <View style={styles.fileInfo}>
                                <Ionicons name="attach" size={16} color={theme.colors.accent} />
                                <Text style={styles.fileName}> {selectedFile.name}</Text>
                            </View>
                        )}

                        {selectedFile && (
                            <TouchableOpacity
                                style={[styles.uploadBtn, uploading && { opacity: 0.6 }]}
                                onPress={uploadFile}
                                disabled={uploading}
                            >
                                <Ionicons name="cloud-upload" size={18} color={theme.colors.bgDark} />
                                <Text style={styles.uploadBtnText}>
                                    {uploading ? "  Uploading..." : "  Upload"}
                                </Text>
                            </TouchableOpacity>
                        )}
                    </View>
                </View>
            </SafeAreaView>
        </GradientBackground>
    );
};

const styles = StyleSheet.create({
    content: {
        flex: 1,
        padding: 24,
        justifyContent: "center",
        alignItems: "center",
    },
    headerIcon: {
        width: 60,
        height: 60,
        borderRadius: 30,
        backgroundColor: theme.colors.glassLight,
        borderWidth: 1,
        borderColor: theme.colors.border,
        justifyContent: "center",
        alignItems: "center",
        marginBottom: theme.spacing.m,
    },
    title: {
        ...theme.typography.h2,
        marginBottom: 6,
    },
    subtitle: {
        color: theme.colors.textMuted,
        fontSize: 14,
        marginBottom: 28,
    },
    card: {
        backgroundColor: theme.colors.glassBg,
        padding: 28,
        borderRadius: theme.borderRadius.xl,
        alignItems: "center",
        borderWidth: 1,
        borderColor: theme.colors.border,
        width: "100%",
        ...theme.shadow.card,
    },
    uploadIconCircle: {
        width: 80,
        height: 80,
        borderRadius: 40,
        backgroundColor: theme.colors.glassLight,
        borderWidth: 1,
        borderColor: theme.colors.border,
        justifyContent: "center",
        alignItems: "center",
        marginBottom: theme.spacing.m,
    },
    cardTitle: {
        ...theme.typography.h3,
        marginBottom: 4,
    },
    cardDesc: {
        color: theme.colors.textMuted,
        fontSize: 14,
        marginBottom: 20,
    },
    selectBtn: {
        flexDirection: "row",
        alignItems: "center",
        backgroundColor: theme.colors.bgCard,
        paddingHorizontal: 22,
        paddingVertical: 13,
        borderRadius: theme.borderRadius.m,
        borderWidth: 1,
        borderColor: theme.colors.borderLight,
    },
    btnText: {
        color: theme.colors.text,
        fontWeight: "600",
    } as any,
    fileInfo: {
        flexDirection: "row",
        alignItems: "center",
        marginTop: 14,
    },
    fileName: {
        color: theme.colors.accent,
        fontSize: 13,
    },
    uploadBtn: {
        flexDirection: "row",
        alignItems: "center",
        backgroundColor: theme.colors.accent,
        paddingHorizontal: 28,
        paddingVertical: 13,
        borderRadius: theme.borderRadius.m,
        marginTop: 16,
    },
    uploadBtnText: {
        color: theme.colors.bgDark,
        fontWeight: "700",
    } as any,
});

export default IngestScreen;
