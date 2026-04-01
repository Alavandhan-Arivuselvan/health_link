import os

import json

import re

import datetime

import tempfile

import base64

import pandas as pd

import joblib

import numpy as np

from pdf2image import convert_from_path

import pytesseract

from pymongo import MongoClient

from sentence_transformers import SentenceTransformer

from huggingface_hub import InferenceClient


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

EXTRACTOR_MODEL = "meta-llama/Llama-3.3-70B-Instruct:novita"

SCRIBE_MODEL = "meta-llama/Llama-3.3-70B-Instruct:novita"

CHAT_MODEL = "meta-llama/Llama-3.3-70B-Instruct:novita"

VISION_MODEL = "Qwen/Qwen2.5-VL-7B-Instruct:hyperbolic"



# Initialize Clients

llm_client = InferenceClient(api_key=HF_TOKEN)

mongo_client = MongoClient(MONGO_URI)

db = mongo_client["healthlink_db"]

embed_model = SentenceTransformer('all-MiniLM-L6-v2')



# Load ML Model Globally

try:

    rf_model = joblib.load('risk_model_multi.pkl')

    rf_features = joblib.load('features_list.pkl')

    print("✅ Successfully loaded Agiless Multi-Output Risk Model!")

except Exception as e:

    print(f"⚠️ Warning: Could not load model files. Error: {e}")



# =========================================================

# 2. STEP 1: OCR EXTRACTION (For PDFs)

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
[INST] You are an expert clinical data extractor. Your job is to extract comprehensive medical details from the provided OCR text into a structured JSON object.

CRITICAL RULES:
1. Output ONLY valid JSON. Do not include markdown formatting.
2. If a specific piece of data is missing, use null.
3. Date format: YYYY-MM-DD. (Use Discharge or Admission date if document date is unclear).
4. Clean up any obvious OCR errors in names or numbers.
5. Be exhaustive. Do not summarize; extract ALL medications, lab values, and diagnoses found.

REQUIRED SCHEMA:
{
  "document_metadata": { 
      "document_date": "YYYY-MM-DD", 
      "hospital_name": "String (Look at headers for Clinic/Hospital Name)" 
  },
  "patient_info": { 
      "name": "String (Carefully locate 'Name:', 'Patient:', 'MR.', 'MRS.')", 
      "age": Number, 
      "sex": "String (Male/Female/Other)" 
  },
  "clinical_data": {
     "diagnosis": ["String (Include all known cases, stage of disease, and new diagnoses)"],
     "symptoms": ["String (Include chief complaints and key history of present illness)"],
     "medications": [ { "name": "String", "dosage": "String", "frequency": "String" } ],
     "lab_reports": [ { "name": "String (e.g., Serum Creatinine, HbA1c, Blood Urea)", "value": "String (Include units)" } ],
     "vitals": [ { "name": "String (e.g., Blood Pressure, SpO2, Pulse)", "value": "String" } ]
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

    # print("⏳ Calling LLM to extract JSON...")

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

# 4. STEP 3: MONGODB INGESTION (TIMELINE & VECTORS)

# =========================================================

def update_user_timeline(user_phone, parsed_json, doc_id):
    # Safe metadata fetch
    metadata = parsed_json.get("document_metadata") or {}
    raw_date = metadata.get("document_date")
    iso_date = raw_date if raw_date and len(raw_date) == 10 else datetime.datetime.now().strftime("%Y-%m-%d")
    
    events = []
    # Safe clinical_data fetch (defaults to empty dict if null)
    clinical = parsed_json.get("clinical_data") or {}
    
    # 1. Diagnosis
    for d in clinical.get("diagnosis") or []:
        events.append({"category": "Diagnosis", "item": d if isinstance(d, str) else d.get("name"), "status": "Active", "source_doc_id": doc_id})
        
    # 2. Medications
    for m in clinical.get("medications") or []:
        events.append({"category": "Medication", "item": m.get("name"), "value": m.get("dosage"), "frequency": m.get("frequency"), "source_doc_id": doc_id})
        
    # 3. Vitals
    for v in clinical.get("vitals") or []:
        events.append({"category": "Vital", "item": v.get("name"), "value": v.get("value"), "source_doc_id": doc_id})

    # 🔥 4. NEW: Symptoms (Safe Extract)
    for s in clinical.get("symptoms") or []:
        events.append({"category": "Symptom", "item": s if isinstance(s, str) else s.get("name", "Unknown"), "status": "Active", "source_doc_id": doc_id})
        
    # 🔥 5. NEW: Lab Reports (Safe Extract)
    for l in clinical.get("lab_reports") or []:
        events.append({"category": "Lab Result", "item": l.get("name"), "value": l.get("value"), "source_doc_id": doc_id})

    base_path = f"timeline.{iso_date}"
    
    # Safe profile fetch
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

    hospital = parsed_json.get("document_metadata", {}).get("hospital_name", "Unknown Hospital")

    context_str = f"On {doc_date} at {hospital}"

    sentences = []

    clinical = parsed_json.get("clinical_data", {})

   

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

# 6. STEP 5: RAG CHATBOT ENGINE

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

       

    results.sort(key=lambda x: x.get('date', ''), reverse=True)



    context_str = ""

    for idx, doc in enumerate(results):

        context_str += f"[Doc {idx+1}] (Date: {doc.get('date', 'Unknown')}): {doc['text']}\n"

       

    return context_str

   

def ask_healthlink(user_query, user_phone,nameee="Agiless"):

    # 1. Fetch the user's static profile directly from MongoDB

    user_doc = db["users"].find_one({"_id": user_phone})

    patient_name = "Unknown"

    patient_age = "Unknown"

    patient_gender = "Unknown"

   

    if user_doc and "profile" in user_doc:

        profile = user_doc["profile"]

        patient_name = profile.get("full_name") or nameee

        patient_age = profile.get("age") or "Unknown"

        patient_gender = profile.get("gender") or "Unknown"



    # 2. Get the clinical vector context

    context = get_medical_context(user_query, user_phone)

    if not context: return "I couldn't find any medical records matching your question in the database."



    current_date = datetime.datetime.now().strftime("%Y-%m-%d")



    # 3. Inject the profile directly into the System Prompt!

    messages = [

        {

            "role": "system",

            "content": f"""You are HealthLink, a direct and concise AI Medical Assistant.

           

            PATIENT PROFILE:

            - Name: {patient_name}

            - Age: {patient_age}

            - Gender: {patient_gender}

           

            CRITICAL TIME CONTEXT: Today's date is {current_date}.

            The provided documents are sorted from NEWEST to OLDEST.



            RULES:

            1. Answer based ONLY on the provided Medical Context and Patient Profile.

            2. Be conversational but accurate.

            3. DO NOT use any internal monologue or <think> tags.

            4. Use to cite the document number."""

        },

        {

            "role": "user",

            "content": f"Medical Context:\n{context}\n\nUser Question: {user_query}\n\nDirect Answer:"

        }

    ]



    try:

        completion = llm_client.chat.completions.create(model=CHAT_MODEL, messages=messages, max_tokens=800, temperature=0.1)

        raw_ans = completion.choices[0].message.content

        return re.sub(r'<think>.*?</think>', '', raw_ans, flags=re.DOTALL).replace('<Answer>', '').replace('</Answer>', '').strip()

    except Exception as e:

        return f"⚠️ Error generating answer: {e}"



def clean_response(llm_output):

    text = re.sub(r'<think>.*?</think>', '', llm_output, flags=re.DOTALL)

    text = text.replace('<Answer>', '').replace('</Answer>', '')

    return text.strip()



# =========================================================

# 7. THE MASTER WORKFLOW & INTERACTIVE CHAT (TERMINAL DEBUG)

# =========================================================

def start_interactive_chat(patient_phone,inp):

    print(f"\n======================================")

    print(f" 💬 STARTING HEALTHLINK CHAT ")

    print(f" Patient ID: {patient_phone}")

    print(f" Type 'exit' or 'quit' to end.")

    print(f"======================================\n")

        

    raw_ans = ask_healthlink(inp, patient_phone)

    clean_ans = clean_response(raw_ans)

    print(f"HealthLink: {clean_ans}\n")
    return clean_ans


# =========================================================

# 8. STEP 6: IOT SMARTWATCH MULTI-OUTPUT RISK MODEL

# =========================================================

def process_real_smartwatch_data(user_phone, raw_data_dict):

    """

    Takes the raw Agiless JSON dictionary, runs it through your multi-output PKL model,

    calculates average probabilities, formats it, and updates DB & Graph.

    """

    print(f"\n⌚ Analyzing Actual Smartwatch Vitals for {user_phone}...")



    weekly_data_list = raw_data_dict.get(user_phone, [])

    if not weekly_data_list:

        print("❌ No data found for this user in the JSON.")

        return None



    # 1. Prepare DataFrame

    df_full = pd.DataFrame(weekly_data_list)



    # 2. Handle missing features strictly based on features_list.pkl

    for feat in rf_features:

        if feat not in df_full.columns:

            df_full[feat] = 0



    # 3. Predict Probabilities

    test_data_prepared = df_full[rf_features]

    probs = rf_model.predict_proba(test_data_prepared)



    # 4. Extract Weekly Probabilities for the 3 targets

    heart_probs = [p[1] for p in probs[0]]

    obesity_probs = [p[1] for p in probs[1]]

    resp_probs = [p[1] for p in probs[2]]



    # Add probabilities to our dataframe to calculate averages (just like your new_t.py)

    df_full['Heart_Prob'] = heart_probs

    df_full['Obesity_Prob'] = obesity_probs

    df_full['Resp_Prob'] = resp_probs



    # 5. Print Weekly Report (Exact terminal output from your logic)

    print("\n" + "="*40)

    print("      WEEKLY RISK ACCURACY REPORT      ")

    print("="*40)



    THRESHOLD = 0.70

    diagnosis = []



    avg_heart_risk = df_full['Heart_Prob'].mean()

    avg_obesity_risk = df_full['Obesity_Prob'].mean()

    avg_resp_risk = df_full['Resp_Prob'].mean()

    avg_hr = df_full['Heart Rate'].mean()

    avg_sleep = df_full['Sleep Duration'].mean()

    avg_steps = df_full['Daily Steps'].mean()



    print(f"User: {user_phone}")

    print(f"Avg Steps/Day: {avg_steps:.0f}")

    print(f"Avg Heart Rate: {avg_hr:.1f} BPM")

    print("-" * 25)

    print(f"Weekly Risk Probabilities:")

    print(f" → Heart Risk:      {avg_heart_risk*100:.2f}%")

    print(f" → Obesity Risk:    {avg_obesity_risk*100:.2f}%")

    print(f" → Respiratory Risk: {avg_resp_risk*100:.2f}%")



    # Determine Final Verdict

    if avg_heart_risk >= THRESHOLD: diagnosis.append("Elevated Heart Risk Detected")

    if avg_obesity_risk >= THRESHOLD: diagnosis.append("Elevated Obesity Risk Detected")

    if avg_resp_risk >= THRESHOLD: diagnosis.append("Elevated Respiratory Risk Detected")



    verdict = "LOW RISK" if not diagnosis else f"HIGH RISK ({', '.join(diagnosis)})"

    print(f"\nFINAL WEEKLY VERDICT: {verdict}")

    print("="*40)

   

    if not diagnosis:

        diagnosis.append("Normal Vitals - Healthy Week")



    # 6. Format output to match the HealthLink JSON Schema perfectly

    report_date = weekly_data_list[-1]['Date']

    simulated_json = {

        "document_metadata": {

            "document_date": report_date,

            "hospital_name": "Wearable ML Engine"

        },

        "patient_info": { "age": int(df_full['Age'].iloc[0]) if 'Age' in df_full else None, "sex": "Unknown" },

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



    # 7. Automatically update DB, Vectors, and regenerate the Graph

    doc_id = f"agiless_sync_{report_date.replace('-', '')}"

    doc_date = update_user_timeline(user_phone, simulated_json, doc_id)

    update_vector_store(user_phone, simulated_json, doc_date)

    # Graph is now handled by Neo4j (via /api/graph-html)



    print(f"🎉 ML Data fully integrated!")



    return simulated_json



# =========================================================

# 9. API INGESTION HELPERS (For FastAPI)

# =========================================================

def process_medical_file(user_phone: str, file_path: str):
    """API Master function for both PDFs and Medical Images"""
    # 1. Determine file type based on extension
    ext = os.path.splitext(file_path)[1].lower()
    parsed_json = None
    doc_id = ""

    # ==========================================
    # BRANCH A: PDF PROCESSING (OCR + TEXT LLM)
    # ==========================================
    if ext == '.pdf':
        print(f"\n📄 Processing PDF Document: {os.path.basename(file_path)}")
        doc_id = os.path.splitext(os.path.basename(file_path))[0]
        
        try:
            images = convert_from_path(file_path, dpi=500, poppler_path=POPPLER_PATH)
            report_text = ""
            for i, img in enumerate(images):
                page_text = pytesseract.image_to_string(img, config=r'--psm 6')
                report_text += f"\n[DOC: {doc_id} | PAGE: {i+1}]\n{page_text}"
            
            parsed_json = extract_structured_data(report_text)
        except Exception as e:
            print(f"❌ PDF Processing Error: {e}")

    # ==========================================
    # BRANCH B: IMAGE PROCESSING (VISION LLM)
    # ==========================================
    elif ext in ['.jpg', '.jpeg', '.png']:
        print(f"\n👁️ Processing Medical Image: {os.path.basename(file_path)}")
        doc_id = f"img_{datetime.datetime.now().strftime('%Y%m%d%H%M%S')}"
        parsed_json = extract_from_image(file_path)

    # ==========================================
    # INVALID FILE TYPE
    # ==========================================
    else:
        print(f"❌ Unsupported file type: {ext}")
        return {"status": "error", "message": f"Unsupported file extension: {ext}"}

    # ==========================================
    # SHARED LOGIC: DATABASE & GRAPH UPDATES
    # ==========================================
    if parsed_json:
        print(f"💾 Pushing {doc_id} data to MongoDB and updating Graph...")
        doc_date = update_user_timeline(user_phone, parsed_json, doc_id)
        update_vector_store(user_phone, parsed_json, doc_date)
        # Graph is now handled by Neo4j (via /api/graph-html)
        
        return {
            "status": "success", 
            "file_type": "pdf" if ext == '.pdf' else "image",
            "data": parsed_json
        }
        
    return {"status": "error", "message": "Failed to extract valid data from the file."}
# process_medical_file("9999999998", r"./doc/OIP.jpg")