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
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import * as DocumentPicker from "expo-document-picker";
import AsyncStorage from "@react-native-async-storage/async-storage";

// Only import native upload on non-web platforms
let uploadAsyncFn: any = null;
let UploadType: any = null;
if (Platform.OS !== "web") {
    const legacy = require("expo-file-system/legacy");
    uploadAsyncFn = legacy.uploadAsync;
    UploadType = legacy.FileSystemUploadType;
}

const API_URL =
    Platform.OS === "web"
        ? "http://localhost:9000"
        : "http://10.67.77.22:9000";

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
        if (!selectedFile) {
            Alert.alert("No File", "Please select a file first");
            return;
        }

        setUploading(true);
        try {
            let status: number;
            let body: string;

            // Get logged-in user's phone from AsyncStorage
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

                // 5 minute timeout for OCR processing
                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), 5 * 60 * 1000);

                const response = await fetch(`${API_URL}/upload`, {
                    method: "POST",
                    body: formData,
                    signal: controller.signal,
                });
                clearTimeout(timeoutId);
                body = await response.text();
                status = response.status;
            } else {
                const uploadResult = await uploadAsyncFn(
                    `${API_URL}/upload`,
                    selectedFile.uri,
                    {
                        fieldName: "file",
                        httpMethod: "POST",
                        uploadType: UploadType.MULTIPART,
                        mimeType: selectedFile.mimeType || "application/pdf",
                        parameters: { user_phone: userPhone },
                    }
                );
                status = uploadResult.status;
                body = uploadResult.body;
            }

            console.log("Upload response:", status, body);

            if (status !== 200) {
                const err = JSON.parse(body || "{}");
                Alert.alert("Upload Failed", err.detail || "Server rejected the file");
                return;
            }

            const old = await AsyncStorage.getItem("records");
            const arr = old ? JSON.parse(old) : [];
            arr.push(selectedFile.name);
            await AsyncStorage.setItem("records", JSON.stringify(arr));

            Alert.alert("Success", "File uploaded! Processing in background. Check Visualize tab shortly. ✅");
            setSelectedFile(null);
        } catch (error) {
            console.log("Upload exception:", error);
            Alert.alert("Error", "Failed to upload file");
        } finally {
            setUploading(false);
        }
    };

    return (
        <LinearGradient
            colors={["#0f2027", "#203a43", "#2c5364"]}
            style={styles.container}
        >
            <SafeAreaView style={{ flex: 1 }}>
                <View style={styles.content}>
                    <Text style={styles.title}>Upload Medical Records</Text>
                    <Text style={styles.subtitle}>
                        Securely store your PDFs and reports
                    </Text>

                    <View style={styles.card}>
                        <Ionicons
                            name="cloud-upload-outline"
                            size={60}
                            color="#00c6ff"
                        />

                        <Text style={styles.cardTitle}>Upload PDF / Image</Text>
                        <Text style={styles.cardDesc}>
                            Select your medical document
                        </Text>

                        <TouchableOpacity style={styles.selectBtn} onPress={selectFile}>
                            <Ionicons name="document-outline" size={20} color="white" />
                            <Text style={styles.btnText}>
                                {selectedFile ? "  Change File" : "  Select File"}
                            </Text>
                        </TouchableOpacity>

                        {selectedFile && (
                            <Text style={styles.fileName}>📄 {selectedFile.name}</Text>
                        )}

                        {selectedFile && (
                            <TouchableOpacity
                                style={[styles.uploadBtn, uploading && { opacity: 0.6 }]}
                                onPress={uploadFile}
                                disabled={uploading}
                            >
                                <Ionicons name="cloud-upload" size={20} color="white" />
                                <Text style={styles.btnText}>
                                    {uploading ? "  Uploading..." : "  Upload"}
                                </Text>
                            </TouchableOpacity>
                        )}
                    </View>
                </View>
            </SafeAreaView>
        </LinearGradient>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    content: {
        flex: 1,
        padding: 20,
        justifyContent: "center",
    },
    title: {
        fontSize: 22,
        fontWeight: "700" as const,
        color: "white",
        marginBottom: 8,
    },
    subtitle: {
        color: "#ccc",
        marginBottom: 30,
    },
    card: {
        backgroundColor: "rgba(255,255,255,0.08)",
        padding: 25,
        borderRadius: 20,
        alignItems: "center" as const,
        borderWidth: 1,
        borderColor: "rgba(255,255,255,0.2)",
    },
    cardTitle: {
        fontSize: 18,
        color: "white",
        fontWeight: "600" as const,
        marginTop: 15,
    },
    cardDesc: {
        color: "#aaa",
        marginBottom: 20,
    },
    selectBtn: {
        flexDirection: "row" as const,
        alignItems: "center" as const,
        backgroundColor: "rgba(255,255,255,0.15)",
        paddingHorizontal: 20,
        paddingVertical: 12,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: "rgba(255,255,255,0.3)",
    },
    fileName: {
        color: "#00c6ff",
        marginTop: 14,
        marginBottom: 4,
        fontSize: 13,
    },
    uploadBtn: {
        flexDirection: "row" as const,
        alignItems: "center" as const,
        backgroundColor: "#00c6ff",
        paddingHorizontal: 24,
        paddingVertical: 12,
        borderRadius: 12,
        marginTop: 14,
    },
    btnText: {
        color: "white",
        fontWeight: "600" as const,
    },
});

export default IngestScreen;
