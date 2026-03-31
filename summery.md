# HealthLink - Project Summary

This document provides a highly detailed summary of the **HealthLink** project, including the comprehensive tech stack, libraries used, and all features implemented across the frontend, backend, and machine learning modules.

---

## 🛠 Full Technology Stack & Tools Used

### 1. Frontend (Mobile Application)
Located in the `MyNewApp` directory, the frontend is a robust, cross-platform mobile application.

*   **Core Framework**: React Native (v0.81.5), React (v19)
*   **Build/Development Tool**: Expo SDK 54, Expo Router, EAS (Expo Application Services)
*   **Navigation**: 
    *   `@react-navigation/native`, `@react-navigation/bottom-tabs`, `@react-navigation/stack`, `@react-navigation/drawer`
*   **Networking / APIClient**: Axios
*   **UI & Styling**:
    *   `react-native-linear-gradient` / `expo-linear-gradient` for modern gradient backgrounds.
    *   `@expo/vector-icons` (Ionicons) for iconography.
    *   `react-native-safe-area-context` for responsive, notch-friendly screens.
*   **Data Visualization & Media**:
    *   `react-native-chart-kit` and `react-native-svg` for rendering health status charts.
    *   `react-native-qrcode-svg` for generating and displaying QR codes.
    *   `expo-image`, `react-native-webview` for rich media rendering.
*   **Device Features & Storage**:
    *   `@react-native-async-storage/async-storage` for local token and preference storage.
    *   `expo-document-picker` and `react-native-image-picker` for selecting medical reports/images.
    *   `expo-haptics` for tactile feedback to enhance UX.

### 2. Backend (API Server)
Located in the `backend` directory, the backend acts as the central engine handling authentication, AI processing, database operations, and medical evaluations.

*   **Core Framework**: Python, FastAPI
*   **Server / Gateway**: Uvicorn (ASGI web server), Cloudflared (for exposing local server to the internet)
*   **Database Integration**: Supabase (PostgreSQL as a Service), PyMongo (MongoDB driver for potential unstructured data needs)
*   **Authentication & Security**:
    *   `bcrypt` for secure password hashing.
    *   `twilio` for SMS-based OTP (One-Time Password) generation and verification.
*   **Document Processing & OCR**:
    *   `pdf2image` and `pytesseract` (Tesseract OCR) to extract and digitize text from uploaded medical documents (PDFs and Images).
    *   `python-multipart` to handle file uploads.
*   **AI, NLP, and Data Interaction**:
    *   `sentence-transformers` and `huggingface-hub` for natural language processing, embeddings, and intelligent chat features.
    *   `streamlit` for rapid data dashboards (if applicable).
*   **Data Visualization**:
    *   `matplotlib` and `pyvis` (Generates interactive HTML network graphs like `healthlink_interactive.html` for complex data relations).

### 3. Machine Learning (Risk Assessment Engine)
Located in the `backend` and `ML` directories.

*   **Data Processing**: `pandas`, `numpy`
*   **Model Format & Storage**: `joblib` (for loading `risk_model_multi.pkl` and `features_list.pkl`)
*   **Implementation Base**: Scikit-Learn (Random Forest model configured for multi-label classification)
*   **Training Dataset Base**: Trained on sleep, health, and lifestyle datasets (`Sleep_health_and_lifestyle_dataset.csv`).

---

## ✨ Features Implemented

### 1. Robust Role-Based Authentication
*   **Dual Onboarding**: Separate registration and login flows for Normal Users (Patients) and Doctors. Doctors register using a medical license number alongside basic info.
*   **Secure Storage**: Passwords are mathematically hashed using `bcrypt` before being stored in the Supabase PostgreSQL database.
*   **SMS OTP Verification**: Integrated with the Twilio API to dispatch a 4-digit code to the user's mobile number. Provides database-level validation (`otps` table) to securely grant access or verify accounts.

### 2. AI-Powered Medical Document Analysis
*   **Background Processing**: Users can upload medical records in either PDF or Image format. The FastAPI backend employs `BackgroundTasks` to avoid freezing the app interface.
*   **OCR Capabilities**: Utilizes Tesseract OCR to read text out of medical scans/reports to feed into the patient's context or NLP models.

### 3. Machine Learning Health Risk Assessment
*   **Weekly Data Analysis**: Ingests arrays of localized health data (e.g., Sleep Duration, Quality of Sleep, Heart Rate, Daily Steps).
*   **Predictive Diagnostics**: Feeds formatted data into a trained Multi-label Random Forest model (`calculate_weekly_risk` function).
*   **Verdict Generation**: Computes discrete probabilities across three main factors:
    *   **Heart Risk**
    *   **Obesity Risk**
    *   **Respiratory Risk**
*   If the probability of any disease crosses a 70% threshold, it flags the user dynamically with a "HIGH RISK" verdict and specifies the vulnerable areas.

### 4. Interactive AI Chatbot Interface
*   **Contextual Assistance**: Implemented a `/chat` API endpoint (`start_interactive_chat()`) that leverages NLP pipelines.
*   Allows the user to ask medical or app-related queries, parsing their health context and replying dynamically using Transformers.

### 5. Interactive Health & Network Graphs
*   **Visual Reports**: Can generate complex interactive network graphs of medical entities or health metrics using `pyvis`, returned cleanly to the frontend React Native WebView directly through the `/graph` endpoint.

### 6. QR-Code Health Profiling
*   **Instant Sharing**: An endpoint generates a dedicated URL pointing to a user's health stats.
*   The frontend securely renders this as a scannable QR Code (`react-native-qrcode-svg`), allowing doctors or peers to instantly load the patient's profile in-person.

### 7. Seamless Cross-Network Connectivity
*   Developed to be instantly usable remotely. Uses `cloudflared` to expose the backend API running on `localhost:9000` securely to the Expo mobile app, allowing OTA (Over-The-Air) testing and interactions anywhere in the world.
