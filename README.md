# 🏥 HealthLink

A full-stack health intelligence platform that analyzes medical reports via OCR, builds a **Neo4j Knowledge Graph**, integrates **Fitbit smartwatch** data, and provides an **AI-powered GraphRAG chatbot** — all wrapped in a React Native (Expo) mobile app with a FastAPI backend. Includes a **QR-based doctor access system** with 1-hour temporary sessions.

---

## 🏗️ Architecture

```
┌───────────────────────────────────────────────────────────────┐
│                     React Native (Expo)                       │
│                                                               │
│   Patient App                        Doctor App               │
│   ─────────                          ──────────               │
│   Home / Dashboard                   Scan QR (only tab)       │
│   Chat (GraphRAG AI)                   → Patient Graph View   │
│   Upload (PDF / Image OCR)             → Patient Chat         │
│   Visualize (Neo4j Graph)              → 1-hour timer         │
│   QR Code (share profile)                                     │
│   Stats (Fitbit)                                              │
│   Report History                                              │
└────────────────────────┬──────────────────────────────────────┘
                         │  REST API
┌────────────────────────▼──────────────────────────────────────┐
│                     FastAPI Backend                           │
│                                                               │
│   /upload    → OCR + Neo4j KG ingestion                       │
│   /chat      → GraphRAG chatbot (Neo4j + Gemini LLM)          │
│   /qr        → QR code generation                             │
│   /api/doctor/scan         → Create 1hr doctor session        │
│   /api/doctor/patient-chat → Doctor chat (token-gated)        │
│   /api/graph-data          → Neo4j graph JSON                 │
│   /api/graph-html          → Interactive vis.js graph         │
│   /api/fitbit-insights     → Fitbit analytics & nudges        │
└──┬──────────┬──────────┬───────────┬──────────────────────────┘
   │          │          │           │
   ▼          ▼          ▼           ▼
MongoDB    Supabase    Neo4j      Fitbit API
(vectors)  (reports,   (Knowledge  (smartwatch
            users)      Graph)      data)
```

---

## 📁 Project Structure

```
health_link/
│
├── backend/                           # FastAPI Backend Server
│   ├── backend.py                     #   Main API (auth, upload, chat, graph, doctor sessions)
│   ├── utils.py                       #   OCR pipeline, LLM extraction, MongoDB, ML risk model
│   ├── neo4j_bridge.py                #   Neo4j integration bridge
│   ├── requirements.txt               #   Python dependencies
│   ├── .env / .env.local              #   Env vars (Twilio, Supabase, Neo4j, Gemini, MongoDB)
│   ├── risk_model_multi.pkl           #   ML multi-output risk prediction model
│   ├── features_list.pkl              #   ML feature names
│   ├── uploads/                       #   Uploaded medical files
│   └── doc/                           #   Sample medical documents
│
├── MyNewApp/                          # React Native (Expo) Frontend
│   ├── App.tsx                        #   Entry point
│   ├── src/
│   │   ├── config/host.ts             #     Backend BASE_URL
│   │   ├── theme/index.ts             #     Global theme (dark, glassmorphism)
│   │   ├── components/                #     GradientBackground, CustomButton, CustomInput
│   │   │
│   │   ├── navigation/
│   │   │   ├── RootNavigator.tsx      #     Root stack (Auth → AppTabs → DoctorPatientView)
│   │   │   ├── AuthStack.tsx          #     Login / Register / DoctorLogin / DoctorRegister
│   │   │   ├── AppTabs.tsx            #     Bottom tabs (role-based: patient vs doctor)
│   │   │   └── DashboardStack.tsx     #     Home → Dashboard → Reports → Fitbit
│   │   │
│   │   ├── screens/
│   │   │   ├── auth/
│   │   │   │   ├── LoginScreen.tsx        # Phone + OTP login
│   │   │   │   └── RegisterScreen.tsx     # User registration
│   │   │   │
│   │   │   ├── home/
│   │   │   │   ├── HomeScreen.tsx         # Main hub — service grid + notifications
│   │   │   │   ├── DashboardScreen.tsx    # Health score, metrics, recent uploads
│   │   │   │   ├── ChatScreen.tsx         # GraphRAG AI health assistant
│   │   │   │   ├── IngestScreen.tsx       # Upload medical docs (PDF/image → OCR)
│   │   │   │   ├── WebScreen.tsx          # Neo4j graph visualization (vis.js)
│   │   │   │   ├── StatsScreen.tsx        # Fitbit stats (heart rate, sleep, steps)
│   │   │   │   ├── QRScreen.tsx           # QR code health profile sharing
│   │   │   │   ├── ReportHistoryScreen    # Uploaded reports list
│   │   │   │   ├── ReportDetailScreen     # Individual report detail
│   │   │   │   └── FitbitInsightsScreen   # Fitbit energy, sleep, nudges
│   │   │   │
│   │   │   └── doctor/
│   │   │       ├── DoctorLoginScreen.tsx       # License + phone + OTP login
│   │   │       ├── DoctorRegisterScreen.tsx    # Doctor registration
│   │   │       ├── DoctorScanScreen.tsx        # QR scanner (camera) — doctor's only tab
│   │   │       ├── DoctorPatientView.tsx       # Patient graph + chat (1hr session)
│   │   │       └── DoctorScreen.tsx            # Doctor portal placeholder
│   │   │
│   │   └── services/api.ts            #     API client (auth, reports, chat, doctor)
│   │
│   └── package.json
│
├── KG/                                # Knowledge Graph Modules
│   ├── Graph_Schema/                  #   Neo4j schema + ingestion
│   │   ├── config.py                  #     Gemini + Neo4j credentials
│   │   ├── graph_db.py                #     Neo4j CRUD (nodes, relationships, trends)
│   │   ├── ingest.py                  #     Ingestion pipeline (medical, scan, wearable)
│   │   ├── extractor.py               #     Gemini LLM extraction prompts
│   │   ├── analysis.py                #     Graph analysis pass
│   │   ├── run.py                     #     Interactive CLI runner
│   │   └── test_conn.py               #     Neo4j connection test
│   │
│   └── GraphRag/                      #   GraphRAG chatbot engine
│       ├── graphrag_config.py         #     Gemini + Neo4j config (renamed to avoid collision)
│       ├── query_engine.py            #     Query classification, entity detection, LLM generation
│       ├── retriever.py               #     Neo4j graph traversal (local + global retrieval)
│       ├── context_builder.py         #     Formats graph data as LLM context
│       ├── Checkin.py                 #     Daily health check-in (5 AI-generated questions)
│       └── run.py                     #     Interactive CLI runner
│
├── ML/                                # Machine Learning Module
│   ├── train.py                       #     Train multi-output risk model
│   ├── authorize.py                   #     Fitbit OAuth2 authorization
│   ├── fetch.py / final_fetch.py      #     Fitbit API data pull
│   └── risk_model_multi.pkl           #     Trained risk model
│
└── doc/                               # Sample medical documents
```

---

## 🔑 Key Features

### Patient Side
- **Medical Report Upload** — PDF/image → OCR → Gemini LLM extraction → Neo4j Knowledge Graph
- **GraphRAG AI Chat** — ask questions about your health data (backed by Neo4j graph traversal + Gemini)
- **Knowledge Graph Visualization** — interactive vis.js graph of all medical data
- **Fitbit Integration** — heart rate, sleep, steps, energy analysis with AI nudges
- **ML Risk Prediction** — multi-output risk model for heart, obesity, respiratory risks
- **QR Code Sharing** — share health profile QR for doctor access
- **Report History** — track all uploaded reports with Supabase
- **OTP Authentication** — phone + password + Twilio OTP verification

### Doctor Side
- **QR Scanner** — scan patient's QR code to get temporary access
- **1-Hour Session** — token-based access with countdown timer, auto-revoked on expiry
- **Patient Graph** — view patient's Neo4j knowledge graph
- **Patient Chat** — ask AI about patient's health data (GraphRAG)
- **OTP Login** — license number + phone + password + OTP

---

## 🔌 API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/register` | User registration |
| POST | `/login` | Phone + password login |
| POST | `/send-otp` | Send OTP via Twilio |
| POST | `/verify-otp` | Verify OTP code |
| POST | `/doctor/login` | Doctor login (license + password) |
| POST | `/doctor/register` | Doctor registration |
| POST | `/upload` | Upload medical file → OCR + Neo4j |
| POST | `/upload-report` | Upload with Supabase tracking |
| GET | `/reports/{phone}` | List user reports |
| GET | `/reports/detail/{id}` | Report detail |
| POST | `/chat` | GraphRAG AI chat |
| POST | `/qr` | Generate QR data |
| GET | `/api/graph-data` | Neo4j graph (JSON) |
| GET | `/api/graph-html` | Interactive graph visualization |
| GET | `/api/fitbit-insights` | Fitbit analytics |
| POST | `/api/doctor/scan` | Create 1hr doctor session (token) |
| POST | `/api/doctor/patient-graph` | Patient graph (token-gated) |
| POST | `/api/doctor/patient-chat` | Doctor chat about patient (token-gated) |
| POST | `/api/doctor/session-status` | Check session validity |
| POST | `/smartwatch-data` | ML risk analysis |

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

### GraphRAG Chatbot (standalone CLI)
```bash
cd KG/GraphRag
python run.py
```

---

## 🔧 Environment Variables

Create `.env` files in `backend/` and `KG/Graph_Schema/`:

```env
# Twilio (OTP)
TWILIO_ACCOUNT_SID=...
TWILIO_AUTH_TOKEN=...
TWILIO_PHONE_NUMBER=...

# Supabase (auth + reports)
SUPABASE_URL=...
SUPABASE_KEY=...

# Neo4j (Knowledge Graph)
NEO4J_URI=...
NEO4J_USERNAME=...
NEO4J_PASSWORD=...

# Google Gemini (AI)
GEMINI_API_KEY=...
GEMINI_MODEL=gemini-3-flash-preview

# MongoDB (vectors)
MONGO_URI=...
```

---

## 🧠 Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React Native, Expo, TypeScript |
| Backend | FastAPI, Python |
| Database | Neo4j (graph), MongoDB (vectors), Supabase (auth/reports) |
| AI/ML | Google Gemini, GraphRAG, scikit-learn |
| OCR | PyMuPDF, pytesseract, pdf2image |
| Auth | Twilio OTP, bcrypt |
| Visualization | vis.js (interactive graph) |
| Wearable | Fitbit Web API |