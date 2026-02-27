# 🏥 HealthLink

A comprehensive health insights mobile application that analyzes medical reports via OCR, builds a Neo4j Knowledge Graph, integrates Fitbit smartwatch data, and provides AI-powered health chat — all wrapped in a modern React Native (Expo) frontend with a FastAPI backend.

---

## 📁 Project Structure

```
health_link/
│
├── README.md                          # This file
├── summery.md                         # Project summary & notes
├── .gitignore
│
├── backend/                           # 🔧 FastAPI Backend Server
│   ├── backend.py                     #   Main API server (auth, upload, chat, graph, fitbit)
│   ├── utils.py                       #   Core pipeline: OCR, LLM extraction, MongoDB, RAG chat, ML risk model
│   ├── main.py                        #   Alternate entrypoint
│   ├── requirements.txt               #   Python dependencies
│   ├── .env.local                     #   🔑 Env vars (Twilio, Supabase, Neo4j, Gemini, MongoDB)
│   ├── .env                           #   Secondary env file
│   ├── __init__.py
│   ├── risk_model_multi.pkl           #   ML multi-output risk prediction model
│   ├── features_list.pkl              #   ML feature names
│   ├── healthlink_interactive.html    #   Legacy pyvis graph (deprecated)
│   ├── test_api_flow.py               #   API integration test
│   ├── test_upload.py                 #   Upload endpoint test
│   ├── uploads/                       #   Uploaded medical files (PDFs, images)
│   ├── doc/                           #   Sample medical documents
│   └── lib/                           #   Vendored JS libs
│       ├── bindings/
│       ├── tom-select/
│       └── vis-9.1.2/
│
├── MyNewApp/                          # 📱 React Native (Expo) Frontend
│   ├── App.tsx                        #   App entry point
│   ├── app.json                       #   Expo config
│   ├── package.json                   #   NPM dependencies
│   ├── tsconfig.json                  #   TypeScript config
│   ├── eas.json                       #   EAS Build config
│   ├── eslint.config.js               #   Linting config
│   │
│   └── src/
│       ├── config/
│       │   └── host.ts                #     Backend BASE_URL config
│       │
│       ├── theme/
│       │   └── index.ts               #     Global theme (colors, typography, spacing)
│       │
│       ├── components/
│       │   ├── GradientBackground.tsx  #     Shared gradient wrapper
│       │   ├── CustomButton.tsx        #     Reusable button
│       │   └── CustomInput.tsx         #     Reusable text input
│       │
│       ├── navigation/
│       │   ├── RootNavigator.tsx       #     Root stack: Auth → AppTabs → Doctor
│       │   ├── AuthStack.tsx           #     Login / Register stack
│       │   ├── AppTabs.tsx             #     Bottom tab navigator (Home, Chat, Upload, Web, Stats, QR)
│       │   └── DashboardStack.tsx      #     Home tab stack (Home → Dashboard → Reports → Fitbit)
│       │
│       ├── screens/
│       │   ├── auth/
│       │   │   ├── LoginScreen.tsx     #     Phone + OTP login
│       │   │   └── RegisterScreen.tsx  #     User registration
│       │   │
│       │   ├── home/
│       │   │   ├── HomeScreen.tsx       #    🏠 Main hub — service grid + notification modal
│       │   │   ├── DashboardScreen.tsx  #    📊 Health score, metrics, recent uploads
│       │   │   ├── ChatScreen.tsx       #    💬 AI health assistant chat
│       │   │   ├── IngestScreen.tsx     #    📤 Upload medical docs (OCR)
│       │   │   ├── WebScreen.tsx        #    🌐 Neo4j Knowledge Graph visualization
│       │   │   ├── StatsScreen.tsx      #    📈 Fitbit stats (heart rate, sleep, steps)
│       │   │   ├── QRScreen.tsx         #    📱 QR code health profile sharing
│       │   │   ├── ReportHistoryScreen.tsx  # 📋 List of uploaded reports
│       │   │   ├── ReportDetailScreen.tsx   # 📄 Individual report detail view
│       │   │   └── FitbitInsightsScreen.tsx # ⌚ Fitbit energy, sleep, nudges
│       │   │
│       │   └── doctor/
│       │       ├── DoctorScreen.tsx          # 🩺 Doctor portal landing
│       │       ├── DoctorLoginScreen.tsx     # Doctor login
│       │       └── DoctorRegisterScreen.tsx  # Doctor registration
│       │
│       └── services/
│           └── api.ts                 #     API client (auth, reports, chat, smartwatch)
│
├── KG/                                # 🧠 Knowledge Graph Module
│   └── Graph_Schema/
│       ├── config.py                  #     Gemini + Neo4j credentials
│       ├── graph_db.py                #     Neo4j CRUD (nodes, relationships, trends)
│       ├── ingest.py                  #     Ingestion pipeline (medical, scan, wearable)
│       ├── extractor.py               #     Gemini LLM extraction prompts
│       ├── analysis.py                #     Graph analysis pass
│       ├── run.py                     #     Interactive CLI runner
│       ├── test_conn.py               #     Neo4j connection test
│       ├── README.md                  #     KG module docs
│       └── .env                       #     🔑 Neo4j + Gemini keys
│
├── ML/                                # 🤖 Machine Learning Module
│   ├── train.py                       #     Train multi-output risk model
│   ├── test.py                        #     Test ML predictions
│   ├── new_t1.py                      #     Smartwatch data analysis
│   ├── wear.py                        #     Wearable data processing
│   ├── authorize.py                   #     Fitbit OAuth2 authorization
│   ├── fetch.py                       #     Fitbit API data fetch
│   ├── final_fetch.py                 #     Full 2-week Fitbit data pull
│   ├── fitbit_2weeks_data.json        #     Cached Fitbit data
│   ├── risk_model_multi.pkl           #     Trained risk model
│   ├── features_list.pkl              #     Feature names
│   └── Sleep_health_and_lifestyle_dataset.csv  # Training dataset
│
├── doc/                               # 📎 Sample medical documents
├── uploads/                           # 📂 Root-level uploads folder
└── env/                               # 🐍 Python virtual environment
```

---

## 🏗️ Architecture

```
┌──────────────────────────────────────────────────────────┐
│                    React Native (Expo)                    │
│   HomeScreen → Dashboard / Chat / Upload / Graph / Stats │
└───────────────────────┬──────────────────────────────────┘
                        │  REST API
┌───────────────────────▼──────────────────────────────────┐
│                   FastAPI Backend                         │
│   /upload → OCR + MongoDB + Neo4j KG ingestion           │
│   /chat   → RAG chatbot (HuggingFace + MongoDB vectors)  │
│   /api/graph-data → Neo4j nodes & edges (JSON)           │
│   /api/graph-html → Interactive vis.js graph page         │
│   /api/fitbit-insights → Fitbit analytics & nudges       │
└──┬──────────┬──────────┬──────────┬──────────────────────┘
   │          │          │          │
   ▼          ▼          ▼          ▼
MongoDB    Supabase    Neo4j     Fitbit API
(timeline, (report    (Knowledge  (smartwatch
 vectors)   tracking)  Graph)     data)
```

---

## 🔑 Key API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/register` | User registration with OTP |
| POST | `/verify-otp` | OTP verification |
| POST | `/login` | Phone + password login |
| POST | `/upload` | Upload medical file → OCR + Neo4j ingestion |
| POST | `/upload-report` | Upload with Supabase tracking |
| GET | `/reports` | List user reports from Supabase |
| POST | `/chat` | AI health chat (RAG) |
| GET | `/api/graph-data` | Neo4j graph as JSON |
| GET | `/api/graph-html` | Interactive graph visualization |
| GET | `/api/fitbit-insights` | Fitbit energy, sleep, nudges |
| POST | `/api/fitbit-refresh` | Refresh Fitbit data |
| POST | `/smartwatch-data` | Process smartwatch ML risk model |

---

## 🚀 Quick Start

### Backend
```bash
cd backend
pip install -r requirements.txt
uvicorn backend:app --host 0.0.0.0 --port 9000 --reload
```

### Frontend
```bash
cd MyNewApp
npm install
npm start --host
```

### Knowledge Graph (standalone CLI)
```bash
cd KG/Graph_Schema
python run.py
```