import os
import json
import re
import datetime
import tempfile
import base64
import pandas as pd
import joblib
import numpy as np
import qrcode
from pdf2image import convert_from_path
import pytesseract
from pymongo import MongoClient
from sentence_transformers import SentenceTransformer
from huggingface_hub import InferenceClient
from pyvis.network import Network
from dotenv import load_dotenv

# Load .env file from the same directory as utils.py
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
load_dotenv(os.path.join(BASE_DIR, ".env"))

# Update this path to where you installed Tesseract on your PC
pytesseract.pytesseract.tesseract_cmd = r'C:\Program Files\Tesseract-OCR\tesseract.exe'
# Update this to your Poppler bin folder
POPPLER_PATH = r"C:\poppler\poppler-24.08.0\Library\bin"

# =========================================================
# 1. GLOBAL CONFIGURATION & SETUP
# =========================================================
HF_TOKEN = os.environ.get("HF_TOKEN")
MONGO_URI = os.environ.get("MONGO_URI")

# Models
EXTRACTOR_MODEL = "Qwen/Qwen3-4B-Instruct-2507:nscale"
SCRIBE_MODEL = "Qwen/Qwen3-4B-Instruct-2507:nscale"
CHAT_MODEL = "Qwen/Qwen2.5-7B-Instruct" # Fast, non-reasoning model for crisp RAG answers
VISION_MODEL = "Qwen/Qwen2.5-VL-7B-Instruct:hyperbolic" 

# Initialize Clients
llm_client = InferenceClient(api_key=HF_TOKEN)
mongo_client = MongoClient(MONGO_URI)
db = mongo_client["healthlink_db"]
embed_model = SentenceTransformer('all-MiniLM-L6-v2')

# =========================================================
# 2. STEP 1: OCR EXTRACTION
# =========================================================
def OCR_EXTRACTION(input_dir):
    all_reports_data = {} 
    print(f"🔍 Scanning directory: {input_dir}")
    for pdf_name in os.listdir(input_dir):
        if pdf_name.endswith(".pdf"):
            report_id = os.path.splitext(pdf_name)[0]
            print(f"📄 Starting OCR for {report_id}...")

            with tempfile.TemporaryDirectory() as temp_path:
                images = convert_from_path(os.path.join(input_dir, pdf_name), dpi=500, poppler_path=POPPLER_PATH)
                report_text = ""
                for i, img in enumerate(images):
                    page_text = pytesseract.image_to_string(img, config=r'--psm 6')
                    report_text += f"\n[DOC: {report_id} | PAGE: {i+1}]\n{page_text}"
                all_reports_data[report_id] = report_text
    return all_reports_data

# =========================================================
# 3. STEP 2: JSON EXTRACTION (TEXT & VISION)
# =========================================================
STRICT_PROMPT = """
[INST] You are a medical data extractor. Extract the following details from the text into a JSON object.

RULES:
1. Output ONLY valid JSON.
2. If data is missing, use null.
3. Date format: YYYY-MM-DD.

REQUIRED SCHEMA:
{
  "document_metadata": { "document_date": "YYYY-MM-DD", "hospital_name": "String" },
  "patient_info": { "name": "String", "age": Number, "sex": "String" },
  "clinical_data": {
     "diagnosis": ["String"],
     "medications": [ { "name": "String", "dosage": "String", "frequency": "String" } ],
     "vitals": [ { "name": "String", "value": "String" } ]
  }
}

TEXT:
"""

def repair_and_parse_json(text):
    if not text: return None
    start = text.find('{')
    end = text.rfind('}')
    if start == -1 or end == -1: return None
    json_str = text[start : end+1]
    json_str = re.sub(r',\s*}', '}', json_str)
    json_str = re.sub(r',\s*]', ']', json_str)
    try:
        return json.loads(json_str)
    except json.JSONDecodeError:
        return None

def extract_structured_data(ocr_text):
    full_prompt = f"{STRICT_PROMPT}\n{ocr_text}\n[/INST]"
    print("⏳ Calling LLM to extract JSON...")
    try:
        completion = llm_client.chat.completions.create(
            model=EXTRACTOR_MODEL,
            messages=[{"role": "user", "content": full_prompt}],
            temperature=0.1,
            max_tokens=1500
        )
        return repair_and_parse_json(completion.choices[0].message.content)
    except Exception as e:
        print(f"❌ Extraction API Error: {e}")
        return None

def encode_image(image_path):
    with open(image_path, "rb") as image_file:
        return base64.b64encode(image_file.read()).decode('utf-8')

def extract_from_image(image_path):
    print(f"👁️ Analyzing Medical Image: {os.path.basename(image_path)}...")
    base64_img = encode_image(image_path)
    messages = [
        {
            "role": "user",
            "content": [
                {"type": "text", "text": STRICT_PROMPT},
                {"type": "image_url", "image_url": {"url": f"data:image/jpeg;base64,{base64_img}"}}
            ]
        }
    ]
    try:
        completion = llm_client.chat.completions.create(
            model=VISION_MODEL,
            messages=messages,
            temperature=0.1,
            max_tokens=1500
        )
        raw_output = completion.choices[0].message.content
        parsed_json = repair_and_parse_json(raw_output)
        if parsed_json:
            print("✅ Multimodal Vision Extraction Successful!")
            return parsed_json
        else:
            print("❌ Vision Model failed to output valid JSON.")
            return None
    except Exception as e:
        print(f"❌ Vision API Error: {e}")
        return None

# =========================================================
# 4. STEP 3: MONGODB INGESTION (SAFE HANDLING ADDED)
# =========================================================
def update_user_timeline(user_phone, parsed_json, doc_id):
    metadata = parsed_json.get("document_metadata") or {}
    raw_date = metadata.get("document_date")
    iso_date = raw_date if raw_date and len(raw_date) == 10 else datetime.datetime.now().strftime("%Y-%m-%d")
    
    events = []
    clinical = parsed_json.get("clinical_data") or {}
    
    for d in clinical.get("diagnosis") or []:
        events.append({"category": "Diagnosis", "item": d if isinstance(d, str) else d.get("name"), "status": "Active", "source_doc_id": doc_id})
    for m in clinical.get("medications") or []:
        events.append({"category": "Medication", "item": m.get("name"), "value": m.get("dosage"), "frequency": m.get("frequency"), "source_doc_id": doc_id})
    for v in clinical.get("vitals") or []:
        events.append({"category": "Vital", "item": v.get("name"), "value": v.get("value"), "source_doc_id": doc_id})

    base_path = f"timeline.{iso_date}"
    patient_info = parsed_json.get("patient_info") or {}
    
    db["users"].update_one(
        {"_id": user_phone},
        {
            "$setOnInsert": {
                "created_at": datetime.datetime.now(datetime.timezone.utc),
                "profile": {
                    "full_name": patient_info.get("name"),
                    "age": patient_info.get("age"),
                    "gender": patient_info.get("sex")
                }
            },
            "$set": {
                f"{base_path}.meta.primary_hospital": metadata.get("hospital_name"),
                "last_updated": datetime.datetime.now(datetime.timezone.utc)
            },
            "$push": {
                f"{base_path}.clinical_events": {"$each": events},
                f"{base_path}.attachments": {"file_id": doc_id, "upload_date": datetime.datetime.now(datetime.timezone.utc)}
            }
        },
        upsert=True 
    )
    print(f"✅ Timeline Updated: Added {len(events)} events to {iso_date}.")
    return iso_date

def json_to_clinical_text(section_name, json_item, context_str):
    data_str = json.dumps(json_item) if isinstance(json_item, (dict, list)) else str(json_item)
    messages = [{"role": "user", "content": f"You are an expert Medical Scribe. Convert this to a SINGLE, professional sentence.\nContext: {context_str}\nSection: {section_name}\nData: {data_str}\nSentence:"}]
    try:
        completion = llm_client.chat.completions.create(model=SCRIBE_MODEL, messages=messages, max_tokens=150, temperature=0.1)
        text = completion.choices[0].message.content.strip()
        return text if text else f"{context_str}: {section_name} - {data_str}"
    except:
        return f"{context_str}: {section_name} - {data_str}"

def update_vector_store(user_phone, parsed_json, doc_date):
    metadata = parsed_json.get("document_metadata") or {}
    hospital = metadata.get("hospital_name", "Unknown Hospital")
    context_str = f"On {doc_date} at {hospital}"
    sentences = []
    clinical = parsed_json.get("clinical_data") or {}
    
    for category, items in clinical.items():
        if isinstance(items, list):
            for item in items:
                text = json_to_clinical_text(category, item, context_str)
                sentences.append({"text": text, "category": category, "meta": item})

    if not sentences: return
    
    print(f"🔄 Generating {len(sentences)} vectors...")
    vector_docs = []
    for s in sentences:
        vector_docs.append({
            "user_id": user_phone,
            "date": doc_date,
            "category": s["category"],
            "text": s["text"],
            "vector": embed_model.encode(s["text"]).tolist(),
            "metadata": s["meta"]
        })

    db["vector_store"].delete_many({"user_id": user_phone, "date": doc_date})
    db["vector_store"].insert_many(vector_docs)
    print(f"✅ Vectors Updated: Indexed {len(vector_docs)} clinical facts.")

# =========================================================
# 5. STEP 4: GENERATE PYVIS GRAPH
# =========================================================
def generate_patient_graph(user_phone, output_file="healthlink_interactive.html"):
    print(f"🕸️ Generating semantic graph for {user_phone}...")
    user_doc = db["users"].find_one({"_id": user_phone})
    if not user_doc:
        print(f"❌ No data found for {user_phone}.")
        return None

    net = Network(height="100vh", width="100%", bgcolor="#0b0f19", font_color="white")
    net.set_options('{"interaction": { "hover": true, "zoomView": true, "navigationButtons": true }, "physics": {"forceAtlas2Based": {"gravitationalConstant": -150, "centralGravity": 0.02, "springLength": 100, "springConstant": 0.05}, "solver": "forceAtlas2Based", "stabilization": {"iterations": 150}}}')

    profile = user_doc.get("profile", {})
    patient_name = profile.get("full_name") or "Unknown Patient"
    p_age = profile.get("age", "N/A")
    p_gender = profile.get("gender", "N/A")

    patient_tooltip = f"""<div style="font-family: Arial; padding: 10px; background: #1e293b; border-radius: 8px; border: 1px solid #334155;"><h3 style="margin:0 0 5px 0; color: #38bdf8;">{patient_name}</h3><b>Age:</b> {p_age} <br><b>Gender:</b> {p_gender} <br><b>ID:</b> {user_phone}</div>"""
    net.add_node(patient_name, label=patient_name, title=patient_tooltip, color="#ef4444", size=40, shape="diamond")
    
    timeline = user_doc.get("timeline", {})
    color_map = {"Diagnosis": "#f97316", "Medication": "#06b6d4", "Vital": "#a855f7", "Other": "#8b5cf6"}

    for date_str in sorted(timeline.keys()):
        hospital = timeline[date_str].get("meta", {}).get("primary_hospital", "Unknown Hospital")
        date_node_id = f"DATE_{date_str}"
        date_tooltip = f"<div style='padding:5px;'><b>Visit Date:</b> {date_str}<br><b>Facility:</b> {hospital}</div>"
        
        net.add_node(date_node_id, label=date_str, title=date_tooltip, color="#eab308", size=25, shape="hexagon")
        net.add_edge(patient_name, date_node_id, color="#475569", width=2)

        events = timeline[date_str].get("clinical_events", [])
        categorized = {}
        for ev in events:
            if isinstance(ev, dict):
                categorized.setdefault(ev.get("category", "Other"), []).append(ev)

        for category, items in categorized.items():
            cat_node_id = f"CAT_{date_str}_{category}"
            cat_color = color_map.get(category, "#ffffff")
            net.add_node(cat_node_id, label=category, color=cat_color, size=15, shape="box")
            net.add_edge(date_node_id, cat_node_id, color="#475569", width=1, dashes=True)
            
            for item in items:
                item_name = str(item.get("item", "Unknown")).upper()
                global_item_id = f"GLOBAL_{category}_{item_name}"
                hover_details = "".join([f"<b>{k.title()}</b>: {v}<br>" for k, v in item.items() if k not in ["category", "item", "source_doc_id"]])
                item_tooltip = f"""<div style="font-family: Arial; padding: 8px; background: #0f172a; border-radius: 5px; border: 1px solid {cat_color};"><span style="color: {cat_color}; font-weight: bold;">{item_name}</span><br><hr style="border-color: #334155; margin: 5px 0;"><span style="font-size: 13px;">{hover_details}</span></div>"""
                
                net.add_node(global_item_id, label=item_name, title=item_tooltip, color=cat_color, size=12, shape="dot")
                net.add_edge(cat_node_id, global_item_id, color=cat_color, width=1.5)

    net.save_graph(output_file)

    js_injection = """
    <script type="text/javascript">
        network.on("hoverNode", function (params) {
            var hover_id = params.node;
            var connected_nodes = network.getConnectedNodes(hover_id);
            connected_nodes.push(hover_id);
            var all_nodes = nodes.get();
            var node_updates = [];
            for (var i = 0; i < all_nodes.length; i++) {
                var node = all_nodes[i];
                if (node.original_color === undefined) { node.original_color = node.color; }
                if (connected_nodes.includes(node.id)) {
                    node_updates.push({id: node.id, color: node.original_color, font: {color: 'white'}});
                } else {
                    node_updates.push({id: node.id, color: 'rgba(50,50,50,0.2)', font: {color: 'rgba(255,255,255,0.05)'}});
                }
            }
            nodes.update(node_updates);
            var connected_edges = network.getConnectedEdges(hover_id);
            var all_edges = edges.get();
            var edge_updates = [];
            for (var i = 0; i < all_edges.length; i++) {
                var edge = all_edges[i];
                if (edge.original_color === undefined) { edge.original_color = edge.color || '#475569'; }
                if (connected_edges.includes(edge.id)) {
                    edge_updates.push({id: edge.id, color: '#94a3b8', width: 3}); 
                } else {
                    edge_updates.push({id: edge.id, color: 'rgba(50,50,50,0.1)', width: 1}); 
                }
            }
            edges.update(edge_updates);
        });
        network.on("blurNode", function (params) {
            var all_nodes = nodes.get();
            var node_updates = [];
            for (var i = 0; i < all_nodes.length; i++) {
                if (all_nodes[i].original_color !== undefined) {
                    node_updates.push({id: all_nodes[i].id, color: all_nodes[i].original_color, font: {color: 'white'}});
                }
            }
            nodes.update(node_updates);
            var all_edges = edges.get();
            var edge_updates = [];
            for (var i = 0; i < all_edges.length; i++) {
                if (all_edges[i].original_color !== undefined) {
                    edge_updates.push({id: all_edges[i].id, color: all_edges[i].original_color, width: (all_edges[i].dashes ? 1 : 2)});
                }
            }
            edges.update(edge_updates);
        });
    </script>
    """
    # Post-process: inject custom JS and fix HTML for full-viewport mobile display
    css_injection = """
    <style>
        html, body { margin: 0; padding: 0; width: 100%; height: 100%; overflow: hidden; background-color: #0b0f19; }
        #mynetwork { width: 100%; height: 100vh; background-color: #0b0f19; border: none; }
        .card { margin: 0; padding: 0; border: none; height: 100%; }
        h1, center { display: none; }
    </style>
    """
    with open(output_file, "r+", encoding="utf-8") as f:
        html_content = f.read()
        # Inject hover/blur JS before </body>
        html_content = html_content.replace("</body>", js_injection + "\n</body>")
        # Inject full-viewport CSS into <head>
        html_content = html_content.replace("</head>", css_injection + "\n</head>")
        # Remove the broken lib/bindings/utils.js reference (causes 404)
        html_content = html_content.replace('<script src="lib/bindings/utils.js"></script>', '')
        f.seek(0)
        f.write(html_content)
        f.truncate()

    print(f"🎉 Fully Styled Graph saved to {output_file}")
    return output_file

# =========================================================
# 6. STEP 5: TIME-AWARE RAG CHATBOT ENGINE
# =========================================================
def get_medical_context(query, user_phone):
    query_vector = embed_model.encode(query).tolist()
    pipeline = [
        {"$vectorSearch": {
            "index": "vector_index", 
            "path": "vector", 
            "queryVector": query_vector, 
            "numCandidates": 50, 
            "limit": 10, 
            "filter": { "user_id": user_phone }
        }},
        {"$project": {"_id": 0, "text": 1, "date": 1, "score": { "$meta": "vectorSearchScore" }}}
    ]
    results = list(db["vector_store"].aggregate(pipeline))
    if not results: return None
        
    # Sort chronologically (Newest first)
    results.sort(key=lambda x: x.get('date', ''), reverse=True)

    context_str = ""
    for idx, doc in enumerate(results):
        context_str += f"[Doc {idx+1}] (Date: {doc.get('date', 'Unknown')}): {doc['text']}\n"
    return context_str

def ask_healthlink(user_query, user_phone):
    context = get_medical_context(user_query, user_phone)
    if not context: return "I couldn't find any medical records matching your question in the database."

    current_date = datetime.datetime.now().strftime("%Y-%m-%d")

    messages = [
        {
            "role": "system", 
            "content": f"""You are HealthLink, a helpful AI Medical Assistant. 
            CRITICAL TIME CONTEXT: Today's date is {current_date}. 
            The provided documents are sorted from NEWEST to OLDEST.
            RULES:
            1. Answer based ONLY on the provided Medical Context.
            2. Be conversational but highly accurate. Provide direct answers rather than just saying 'Yes' or 'No'.
            3. DO NOT use any internal monologue, reasoning, or <think> tags. 
            4. You must append citations directly after the relevant sentence using the format."""
        },
        {
            "role": "user", 
            "content": f"Medical Context:\n{context}\n\nUser Question: {user_query}"
        }
    ]

    try:
        completion = llm_client.chat.completions.create(model=CHAT_MODEL, messages=messages, max_tokens=800, temperature=0.1)
        return completion.choices[0].message.content
    except Exception as e:
        return f"⚠️ Error generating answer: {e}"

def clean_response(llm_output):
    text = re.sub(r'<think>.*?</think>', '', llm_output, flags=re.DOTALL)
    text = text.replace('<Answer>', '').replace('</Answer>', '')
    return text.strip()

# =========================================================
# 7. FEATURE: WEARABLE IOT MACHINE LEARNING PIPELINE
# =========================================================
try:
    rf_model = joblib.load(os.path.join(BASE_DIR, 'risk_model_multi.pkl'))
    rf_features = joblib.load(os.path.join(BASE_DIR, 'features_list.pkl'))
    print("✅ Successfully loaded Agiless Multi-Output Risk Model!")
except Exception as e:
    print(f"⚠️ Warning: Could not load model files. Error: {e}")

def process_real_smartwatch_data(user_phone, user_name, weekly_data_list):
    print(f"\n⌚ Analyzing Smartwatch Vitals for {user_name} ({user_phone})...")
    df_full = pd.DataFrame(weekly_data_list)
    
    for feat in rf_features:
        if feat not in df_full.columns:
            df_full[feat] = 0 

    test_data_prepared = df_full[rf_features]
    probs = rf_model.predict_proba(test_data_prepared)

    heart_probs = [p[1] for p in probs[0]]
    obesity_probs = [p[1] for p in probs[1]]
    resp_probs = [p[1] for p in probs[2]]
    
    avg_heart_risk = sum(heart_probs) / len(heart_probs)
    avg_obesity_risk = sum(obesity_probs) / len(obesity_probs)
    avg_resp_risk = sum(resp_probs) / len(resp_probs)

    avg_hr = df_full['Heart Rate'].mean()
    avg_sleep = df_full['Sleep Duration'].mean()
    avg_steps = df_full['Daily Steps'].mean()
    
    report_date = weekly_data_list[-1]['Date']
    print(f"📊 ML Risk Averages -> Heart: {avg_heart_risk:.2f}, Obesity: {avg_obesity_risk:.2f}, Resp: {avg_resp_risk:.2f}")

    diagnosis = []
    if avg_heart_risk > 0.5: diagnosis.append("Elevated Heart Risk Detected")
    if avg_obesity_risk > 0.5: diagnosis.append("Elevated Obesity Risk Detected")
    if avg_resp_risk > 0.5: diagnosis.append("Elevated Respiratory Risk Detected")
    
    if not diagnosis:
        diagnosis.append("Normal Vitals - Healthy Week")
    else:
        print(f"⚠️ ALERT: ML Model flagged risks: {', '.join(diagnosis)}")

    simulated_json = {
        "document_metadata": { 
            "document_date": report_date, 
            "hospital_name": "Agiless Wearable ML Engine" 
        },
        "patient_info": { "name": user_name, "age": int(df_full['Age'].iloc[0]) if 'Age' in df_full else None, "sex": "Unknown" },
        "clinical_data": {
            "diagnosis": diagnosis,
            "medications": [],
            "vitals": [
                { "name": "Heart Risk Probability", "value": f"{avg_heart_risk*100:.1f}%" },
                { "name": "Obesity Risk Probability", "value": f"{avg_obesity_risk*100:.1f}%" },
                { "name": "Respiratory Risk Probability", "value": f"{avg_resp_risk*100:.1f}%" },
                { "name": "Weekly Avg HR", "value": f"{int(avg_hr)} bpm" },
                { "name": "Weekly Avg Sleep", "value": f"{avg_sleep:.1f} hrs" },
                { "name": "Weekly Avg Steps", "value": str(int(avg_steps)) }
            ]
        }
    }
    return simulated_json

# =========================================================
# 8. FEATURE: DOCTOR QR CODE GENERATOR
# =========================================================
def generate_doctor_qr(user_phone, base_url="http://localhost:8000"):
    graph_url = f"{base_url}/doctor/view/{user_phone}?token=temp_scan"
    qr = qrcode.QRCode(version=1, error_correction=qrcode.constants.ERROR_CORRECT_H, box_size=10, border=4)
    qr.add_data(graph_url)
    qr.make(fit=True)
    img = qr.make_image(fill_color="#0b0f19", back_color="white")
    output_image = f"qr_code_{user_phone}.png"
    img.save(output_image)
    print(f"📲 QR Code generated: {output_image}")
    return output_image

# =========================================================
# 9. THE MASTER WORKFLOW & INTERACTIVE CHAT
# =========================================================
def start_interactive_chat(patient_phone):
    print(f"\n======================================")
    print(f" 💬 STARTING HEALTHLINK CHAT ")
    print(f" Patient ID: {patient_phone}")
    print(f" Type 'exit' or 'quit' to end.")
    print(f"======================================\n")
    
    while True:
        user_input = input("You: ")
        if user_input.lower() in ['exit', 'quit']:
            print("Ending chat session. Goodbye!")
            break
            
        raw_ans = ask_healthlink(user_input, patient_phone)
        clean_ans = clean_response(raw_ans)
        print(f"HealthLink: {clean_ans}\n")

def run_healthlink_pipeline(input_pdf_folder, patient_phone):
    print(f"\n🚀 Starting Full HealthLink Pipeline for {patient_phone}...\n")
    ocr_results = OCR_EXTRACTION(input_pdf_folder)
    
    for doc_id, raw_text in ocr_results.items():
        print(f"\n--- Processing Document: {doc_id} ---")
        parsed_json = extract_structured_data(raw_text)
        if not parsed_json:
            print(f"❌ Skipping {doc_id} due to extraction failure.")
            continue
            
        doc_date = update_user_timeline(patient_phone, parsed_json, doc_id)
        update_vector_store(patient_phone, parsed_json, doc_date)
        print(f"✅ Document {doc_id} successfully ingested!")

    generate_patient_graph(patient_phone)

def pipline(path, phone):
    run_healthlink_pipeline(path, phone)

# =========================================================
# 10. EXECUTION / TEST BLOCK
# =========================================================
if __name__ == "__main__":
    test_phone = "9999999999"
    
    print("Select a test mode:")
    print("1. Test Document Pipeline (runs your custom pipline function)")
    print("2. Test Multimodal Image Pipeline")
    print("3. Test Graph Generation & Chatbot ONLY")
    print("4. Test Smartwatch ML Pipeline (Features + Model)")
    print("5. Generate Doctor QR Code")
    choice = input("Enter choice (1/2/3/4/5): ")

    if choice == '1':
        doc_path = os.path.join(BASE_DIR, "doc")
        pipline(doc_path, test_phone)

    elif choice == '2':
        test_image_path = os.path.join(BASE_DIR, "xray.jpg") 
        if os.path.exists(test_image_path):
            parsed_json = extract_from_image(test_image_path)
            if parsed_json:
                doc_date = update_user_timeline(test_phone, parsed_json, "doc_image_01")
                update_vector_store(test_phone, parsed_json, doc_date)
                generate_patient_graph(test_phone)
                print("🎉 Image successfully digitized and added to Knowledge Graph!")
        else:
            print(f"❌ Could not find {test_image_path}.")

    elif choice == '3':
        generate_patient_graph(test_phone)
        start_interactive_chat(test_phone)

    elif choice == '4':
        print("\n🚀 Testing Actual ML Model Pipeline...")
        # Simulating abnormal week
        raw_data = [
            {'Date': '2026-02-12', 'Age': 19, 'Sleep Duration': 4.2, 'Quality of Sleep': 3.0, 'Heart Rate': 88, 'Daily Steps': 1202},
            {'Date': '2026-02-13', 'Age': 19, 'Sleep Duration': 3.5, 'Quality of Sleep': 2.5, 'Heart Rate': 90, 'Daily Steps': 853},
            {'Date': '2026-02-14', 'Age': 19, 'Sleep Duration': 10.5, 'Quality of Sleep': 4.0, 'Heart Rate': 85, 'Daily Steps': 1505},
            {'Date': '2026-02-15', 'Age': 19, 'Sleep Duration': 4.0, 'Quality of Sleep': 2.0, 'Heart Rate': 89, 'Daily Steps': 2130},
            {'Date': '2026-02-16', 'Age': 19, 'Sleep Duration': 5.1, 'Quality of Sleep': 3.5, 'Heart Rate': 87, 'Daily Steps': 1102},
            {'Date': '2026-02-17', 'Age': 19, 'Sleep Duration': 3.8, 'Quality of Sleep': 2.5, 'Heart Rate': 90, 'Daily Steps': 943},
            {'Date': '2026-02-18', 'Age': 19, 'Sleep Duration': 9.8, 'Quality of Sleep': 4.5, 'Heart Rate': 84, 'Daily Steps': 1305}
        ]
        
        ml_json = process_real_smartwatch_data(test_phone, "Agiless User", raw_data)
        doc_date = update_user_timeline(test_phone, ml_json, "agiless_sync_01")
        update_vector_store(test_phone, ml_json, doc_date)
        generate_patient_graph(test_phone)
        print("\n🎉 ML Data fully integrated! Check your healthlink_interactive.html graph!")

    elif choice == '5':
        generate_doctor_qr(test_phone)