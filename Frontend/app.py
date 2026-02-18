# import streamlit as st
# from datetime import date
# import pandas as pd

# # --- 1. THEME-AWARE MOBILE UI CONFIG ---
# st.set_page_config(
#     page_title="HealthLink - Team Griffins", 
#     page_icon="🧬", 
#     layout="centered"
# )

# # Custom CSS for Mobile App experience and Theme-adaptive elements
# st.markdown("""
#     <style>
#     /* Mimic Mobile Device Width on Desktop */
#     .stApp { max-width: 450px; margin: 0 auto; border-radius: 20px; }
    
#     /* Auto-adjusting Card Container for Vitals and History */
#     .med-card {
#         padding: 1.2rem;
#         border-radius: 15px;
#         border: 1px solid rgba(128, 128, 128, 0.2);
#         background-color: rgba(128, 128, 128, 0.05);
#         margin-bottom: 15px;
#     }
    
#     /* HealthLink specific accent styling */
#     .age-highlight { 
#         background-color: rgba(0, 123, 255, 0.1); 
#         padding: 8px; 
#         border-radius: 10px; 
#         text-align: center; 
#         font-weight: bold;
#         color: #007bff;
#     }
    
#     /* Rounded Buttons and Inputs */
#     .stButton>button { width: 100%; border-radius: 20px; height: 3.5em; font-weight: bold; }
#     .stTextInput>div>div>input, .stDateInput>div>div>input { border-radius: 12px; }
#     </style>
#     """, unsafe_allow_html=True)

# # --- 2. CORE LOGIC FUNCTIONS ---
# def calculate_age(born):
#     today = date.today()
#     return today.year - born.year - ((today.month, today.day) < (born.month, born.day))

# # --- 3. SESSION STATE (Simulating SQLCipher & Local Vault) ---
# if "logged_in" not in st.session_state:
#     st.session_state.logged_in = False
# if "users_db" not in st.session_state:
#     # Team Leader Initial Account [cite: 3]
#     st.session_state.users_db = {
#         "Agiless": {"password": "123", "age": 21, "dob": date(2005, 1, 1)}
#     }

# # --- 4. NAVIGATION & VIEWS ---

# if not st.session_state.logged_in:
#     # --- LOGIN / REGISTER VIEW ---
#     st.markdown("<h1 style='text-align: center;'>🧬 HealthLink</h1>", unsafe_allow_html=True)
#     st.markdown("<p style='text-align: center; color: gray;'>Saranathan College of Engineering</p>", unsafe_allow_html=True)
    
#     tab_login, tab_reg = st.tabs(["Sovereign Login", "Create Account"])
    
#     with tab_login:
#         l_user = st.text_input("Username")
#         l_pass = st.text_input("Password", type="password")
#         if st.button("Unlock Vault", type="primary"):
#             if l_user in st.session_state.users_db and st.session_state.users_db[l_user]["password"] == l_pass:
#                 st.session_state.logged_in = True
#                 st.session_state.current_user = l_user
#                 st.rerun()
#             else:
#                 st.error("Invalid credentials or local vault not found.")

#     with tab_reg:
#         st.subheader("Patient Registration")
#         r_name = st.text_input("Full Name (as per Aadhaar)")
#         r_dob = st.date_input("Date of Birth", min_value=date(1920, 1, 1), max_value=date.today())
        
#         # Real-time Age Calculation
#         u_age = calculate_age(r_dob)
#         st.markdown(f"<div class='age-highlight'>Calculated Age: {u_age} years</div>", unsafe_allow_html=True)
        
#         r_pass = st.text_input("Create Vault Password", type="password")
#         r_confirm = st.text_input("Confirm Password", type="password")
        
#         if st.button("Initialize Local Health Thread"):
#             if r_pass != r_confirm:
#                 st.error("Passwords do not match.")
#             elif not r_name or not r_pass:
#                 st.warning("Please fill all fields.")
#             else:
#                 st.session_state.users_db[r_name] = {
#                     "password": r_pass, 
#                     "age": u_age, 
#                     "dob": r_dob
#                 }
#                 st.success("Account created successfully! Please switch to Login.")

# else:
#     # --- DASHBOARD VIEW (Logged In) ---
#     u_info = st.session_state.users_db[st.session_state.current_user]
    
#     # App Header with Identity Details [cite: 6]
#     st.markdown(f"### 👋 Welcome, {st.session_state.current_user}")
#     st.caption(f"Age: {u_info['age']} | DOB: {u_info['dob']} | SCE Student Identity Verified")
    
#     # 5-Tab Navigation for Mobile [cite: 15]
#     t_vitals, t_graph, t_ai, t_upload, t_history = st.tabs(["📊 Vitals", "🕸️ Graph", "🤖 AI", "📤 Ingest", "📁 Records"])

#     with t_vitals:
#         st.subheader("Wearable Stream")
#         c1, c2 = st.columns(2)
#         c1.metric("BPM", "74", "↑ 2")
#         c2.metric("Sleep", "7.5h", "92%")
        
#         st.markdown("---")
#         st.subheader("Clinical Metrics")
#         chart_data = pd.DataFrame({"Value": [6.2, 6.1, 5.9]}, index=["Dec", "Jan", "Feb"])
#         st.line_chart(chart_data)
#         st.caption("Linking steps to HbA1c levels via Semantic KG.")

#     with t_graph:
#         st.subheader("Personal Health Knowledge Graph")
#         st.write("Visualizing your decentralized health thread[cite: 13].")
#         st.markdown("""
#         <div class='med-card'>
#             <span style='color:green;'>● GraphRAG Active</span><br>
#             <b>Relationship Found:</b> High physical activity (Wearable) linked to decreased morning glucose (Clinical).
#         </div>
#         """, unsafe_allow_html=True)
#         # Visualizing the Block Diagram Concept [cite: 21]
#         st.image("https://via.placeholder.com/400x250.png?text=Interactive+KG+Network", caption="On-device GraphRAG Synthesis")

#     with t_ai:
#         st.subheader("Local GenAI Assistant")
#         st.caption("Privacy-first Llama-3 8B Assistant ")
#         prompt = st.chat_input("Ask about your health summary...")
#         if prompt:
#             st.chat_message("user").write(prompt)
#             st.chat_message("assistant").write("Based on your Knowledge Graph: Your HbA1c has improved by 0.3% following your increased evening activity in January.")

#     with t_upload:
#         st.subheader("Multimodal Ingestion")
#         st.write("Upload PDF/CSV clinical reports for OCR extraction[cite: 17, 22].")
#         uploaded_file = st.file_uploader("Drop clinical reports here", type=['pdf', 'csv', 'png'])
#         if uploaded_file:
#             with st.spinner("Processing on-device OCR..."):
#                 st.success(f"Successfully linked '{uploaded_file.name}' to your Knowledge Graph.")

#     with t_history:
#         st.subheader("Past Medical Data")
#         st.write("Historical clinical records and consultation notes.")
#         st.markdown("""
#         <div class='med-card'>
#             <b>2025 - General Consultation</b><br>
#             <small>Dr. Smith • Hospital EHR • Normal Vitals</small>
#         </div>
#         <div class='med-card'>
#             <b>2024 - Lipid Profile</b><br>
#             <small>Lab Results • LDL: 110 mg/dL • Status: Stable</small>
#         </div>
#         """, unsafe_allow_html=True)

#     # Sidebar for logout and Team Credits [cite: 2]
#     with st.sidebar:
#         st.title("MedConnect Portal")
#         st.write("**Team:** Griffins")
#         st.write("**Institution:** Saranathan College of Engineering")
#         if st.button("Logout & Lock Vault"):
#             st.session_state.logged_in = False
#             st.rerun()


import streamlit as st
from datetime import date
import pandas as pd
import random
import time

# --- 1. THEME-AWARE MOBILE UI CONFIG ---
st.set_page_config(
    page_title="HealthLink - Team Griffins", 
    page_icon="🧬", 
    layout="centered"
)

# Custom CSS for Mobile App experience
st.markdown("""
    <style>
    .stApp { max-width: 450px; margin: 0 auto; border-radius: 20px; }
    .med-card {
        padding: 1.2rem;
        border-radius: 15px;
        border: 1px solid rgba(128, 128, 128, 0.2);
        background-color: rgba(128, 128, 128, 0.05);
        margin-bottom: 15px;
    }
    .stButton>button { width: 100%; border-radius: 20px; height: 3.5em; font-weight: bold; }
    .stTextInput>div>div>input, .stDateInput>div>div>input { border-radius: 12px; }
    .hero-text { text-align: center; color: #007bff; font-weight: bold; font-size: 1.5rem; }
    .status-badge { background-color: #00d1b2; color: white; padding: 2px 10px; border-radius: 10px; font-size: 0.8rem; }
    </style>
    """, unsafe_allow_html=True)

# --- 2. CORE LOGIC FUNCTIONS ---
def calculate_age(born):
    today = date.today()
    return today.year - born.year - ((today.month, today.day) < (born.month, born.day))

# --- 3. SESSION STATE ---
if "view" not in st.session_state:
    st.session_state.view = "Landing" # This ensures you see the Project Info first
if "logged_in" not in st.session_state:
    st.session_state.logged_in = False
if "users_db" not in st.session_state:
    st.session_state.users_db = {"9876543210": {"name": "Agiless", "age": 21, "dob": date(2005, 1, 1)}}
if "messages" not in st.session_state:
    st.session_state.messages = []

# --- 4. NAVIGATION CONTROL ---

# VIEW 1: PROJECT LANDING PAGE (Visible to all)
if st.session_state.view == "Landing":
    st.markdown("<h1 style='text-align: center;'>🧬 HealthLink</h1>", unsafe_allow_html=True)
    st.markdown("<p class='hero-text'>Secure, Local GenAI Health Knowledge Graph</p>", unsafe_allow_html=True)
    
    st.image("https://via.placeholder.com/400x200.png?text=HealthLink+Architecture+Overview", caption="Unifying Lifestyle and Clinical Data")
    
    with st.expander("📝 Problem Statement", expanded=True):
        st.write("**Dark Silos:** Health data is trapped between wearables and hospital portals. fragmentation prevents complete history.")

    with st.expander("💡 Proposed Solution", expanded=True):
        st.write("**Semantic Thread:** A decentralized Knowledge Graph residing on the phone, merging multimodal data for private, grounded GenAI insights.")

    st.markdown("---")
    if st.button("🚀 Enter Prototype Dashboard", type="primary"):
        st.session_state.view = "Auth"
        st.rerun()
    
    # Footer
    st.markdown("<p style='text-align: center; font-size: 0.8rem;'>Saranathan College of Engineering | Team Griffins</p>", unsafe_allow_html=True)

# VIEW 2: LOGIN / REGISTER PAGE
elif st.session_state.view == "Auth" and not st.session_state.logged_in:
    st.markdown("<h2 style='text-align: center;'>🔐 Sovereign Onboarding</h2>", unsafe_allow_html=True)
    
    tab_login, tab_reg = st.tabs(["OTP Login", "Create Local Vault"])
    
    with tab_login:
        phone = st.text_input("Mobile Number", value="9876543210", max_chars=10)
        st.caption("Demo Account: 9876543210")
        
        if st.button("Unlock Vault & Login", type="primary"):
            if phone in st.session_state.users_db:
                st.session_state.logged_in = True
                st.session_state.current_user_phone = phone
                st.rerun()
            else: st.error("User not found.")
        
        if st.button("← Back to Project Info"):
            st.session_state.view = "Landing"
            st.rerun()

    with tab_reg:
        r_name = st.text_input("Full Name")
        r_phone = st.text_input("Mobile", max_chars=10, key="reg_phone")
        r_dob = st.date_input("DOB", min_value=date(1950, 1, 1))
        u_age = calculate_age(r_dob)
        st.info(f"Detected Age: {u_age}")
        if st.button("Register via Aadhaar"):
            st.session_state.users_db[r_phone] = {"name": r_name, "age": u_age, "dob": r_dob}
            st.success("Vault Initialized! Switch to Login tab.")

# VIEW 3: USER DASHBOARD (Private)
elif st.session_state.logged_in:
    user = st.session_state.users_db[st.session_state.current_user_phone]
    
    # Header with Logout
    col_a, col_b = st.columns([3,1])
    col_a.markdown(f"### 👋 {user['name']}")
    if col_b.button("Logout"):
        st.session_state.logged_in = False
        st.session_state.view = "Landing"
        st.rerun()
    st.caption(f"ID: +91 {st.session_state.current_user_phone} | Age: {user['age']}")

    # 5-Step Workflow Tabs (Assistant 3rd)
    t1, t2, t3, t4, t5 = st.tabs(["📊 Stats", "🕸️ Graph", "🤖 AI", "📤 Ingest", "📁 Records"])

    with t1:
        st.subheader("Multimodal Vitals")
        c1, c2 = st.columns(2)
        c1.metric("BPM", "74", "↑ 2")
        c2.metric("Sleep", "7.2h", "Normal")
        st.line_chart(pd.DataFrame({"Glucose": [102, 98, 94]}, index=["Dec", "Jan", "Feb"]))

    with t2:
        st.subheader("Knowledge Graph Synthesis")
        st.markdown("<div class='med-card'><span class='status-badge'>Linked</span><br><br><b>GraphRAG Insight:</b> High physical activity (Wearable) linked to decreased morning glucose (Clinical).</div>", unsafe_allow_html=True)
        
        st.image("https://via.placeholder.com/400x220.png?text=Personal+Health+Knowledge+Graph", caption="Semantic Health Thread")

    with t3:
        st.subheader("Local GenAI Assistant")
        st.caption("Powered by Llama-3 8B")
        for msg in st.session_state.messages:
            st.chat_message(msg["role"]).write(msg["content"])
        
        if prompt := st.chat_input("Ask about your medical history..."):
            st.session_state.messages.append({"role": "user", "content": prompt})
            st.chat_message("user").write(prompt)
            # Response grounded in the KG
            res = f"Hi {user['name']}, your glucose (94 mg/dL) shows improvement over the last 30 days based on your OCR-processed lab reports."
            st.session_state.messages.append({"role": "assistant", "content": res})
            st.chat_message("assistant").write(res)

    with t4:
        st.subheader("Multimodal Ingestion")
        st.write("Upload PDF/CSV clinical reports for on-device OCR extraction.")
        st.file_uploader("Drop clinical reports here", type=['pdf', 'png'])
        st.info("Files processed locally for 100% privacy.")

    with t5:
        st.subheader("Past History")
        st.markdown("""
        <div class='med-card'><b>2025 - General Checkup</b><br><small>Dr. Kumar • SCE Health Center</small></div>
        <div class='med-card'><b>2024 - Lipid Profile</b><br><small>Metabolic Health: Good • HbA1c: 6.1</small></div>
        """, unsafe_allow_html=True)