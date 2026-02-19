import streamlit as st
import random
import time
import matplotlib.pyplot as plt
from datetime import date
import socket
import qrcode
from io import BytesIO

# -------------------- CONFIG --------------------
st.set_page_config(
    page_title="Medical Health App",
    layout="centered",
    initial_sidebar_state="collapsed"
)

# -------------------- STYLING --------------------
st.markdown("""
<style>

body {
    background: linear-gradient(135deg, #0f2027, #203a43, #2c5364);
}

.app-title {
    font-size: 30px;
    font-weight: 700;
    text-align: center;
    color: white;
    margin-bottom: 20px;
}

.glass-card {
    background: rgba(255, 255, 255, 0.08);
    backdrop-filter: blur(10px);
    padding: 20px;
    border-radius: 15px;
    margin-bottom: 20px;
    color: white;
}

.stButton>button {
    width: 100%;
    border-radius: 10px;
    height: 45px;
    background: linear-gradient(90deg, #00c6ff, #0072ff);
    color: white;
    font-weight: bold;
    border: none;
}

/* ----------- TOP NAVIGATION ----------- */

div[role="radiogroup"] {
    justify-content: center;
    margin-bottom: 25px;
}

div[role="radiogroup"] > label {
    background: transparent;
    padding: 8px 18px;
    border-radius: 8px;
    margin-right: 12px;
    color: white;
    font-weight: 500;
}

div[role="radiogroup"] > label[data-baseweb="radio"] > div:first-child {
    display: none;
}

/* Active underline */
div[role="radiogroup"] > label:has(input:checked) {
    border-bottom: 3px solid #ff4b4b;
}

</style>
""", unsafe_allow_html=True)

# -------------------- SESSION --------------------
if "logged_in" not in st.session_state:
    st.session_state.logged_in = False

if "otp" not in st.session_state:
    st.session_state.otp = None

if "user_data" not in st.session_state:
    st.session_state.user_data = {}

if "chat_history" not in st.session_state:
    st.session_state.chat_history = []

if "records" not in st.session_state:
    st.session_state.records = []

# -------------------- OTP FUNCTION --------------------
def generate_otp():
    return str(random.randint(1000, 9999))

# -------------------- HORIZONTAL NAVIGATION --------------------
if st.session_state.logged_in:
    pages = [
        "📊 Dashboard",
        "📈 Graph",
        "🤖 AI",
        "📥 Ingest",
        "📁 Records",
        "❤️ Stats",
        "⌚ Watch",
        "📱 QR Download",
        "🚪 Logout"
    ]
else:
    pages = ["🔐 Login", "📝 Register", "📱 QR Download"]

if "page" not in st.session_state:
    st.session_state.page = pages[0]

page = st.radio("", pages, horizontal=True)
st.session_state.page = page


# ==============================================================
# LOGIN
# ==============================================================

if page == "🔐 Login":

    st.markdown('<div class="app-title">🏥 Medical Health App</div>', unsafe_allow_html=True)
    st.markdown('<div class="glass-card">', unsafe_allow_html=True)

    phone = st.text_input("📱 Phone Number")

    if st.button("Send OTP"):
        st.session_state.otp = generate_otp()
        st.success(f"OTP Sent (Demo: {st.session_state.otp})")

    entered_otp = st.text_input("🔑 Enter OTP")

    if st.button("Login"):
        if entered_otp == st.session_state.otp:
            st.session_state.logged_in = True
            st.success("Login Successful")
            st.rerun()
        else:
            st.error("Invalid OTP")

    st.markdown('</div>', unsafe_allow_html=True)


# ==============================================================
# REGISTER
# ==============================================================

elif page == "📝 Register":

    st.markdown('<div class="app-title">📝 Register</div>', unsafe_allow_html=True)
    st.markdown('<div class="glass-card">', unsafe_allow_html=True)

    name = st.text_input("👤 Full Name")

    dob = st.date_input(
        "🎂 Date of Birth",
        min_value=date(1900, 1, 1),
        max_value=date.today()
    )

    today = date.today()
    age = today.year - dob.year - (
        (today.month, today.day) < (dob.month, dob.day)
    )

    st.info(f"📅 Calculated Age: {age} years")

    phone = st.text_input("📱 Phone Number")

    if st.button("Send OTP"):
        st.session_state.otp = generate_otp()
        st.success(f"OTP Sent (Demo: {st.session_state.otp})")

    entered_otp = st.text_input("🔑 Enter OTP")

    if st.button("Register"):
        if entered_otp == st.session_state.otp and name and phone:
            st.session_state.user_data = {
                "name": name,
                "dob": dob,
                "age": age,
                "phone": phone
            }
            st.success("Registration Successful!")
        else:
            st.error("Invalid OTP or Missing Details")

    st.markdown('</div>', unsafe_allow_html=True)


# ==============================================================
# DASHBOARD
# ==============================================================

elif page == "📊 Dashboard":

    user = st.session_state.user_data

    st.markdown('<div class="app-title">📊 Health Dashboard</div>', unsafe_allow_html=True)

    st.markdown(f"""
    <div class="glass-card">
        <h4>👤 {user.get("name","User")}</h4>
        <p>Age: {user.get("age","-")} <br>
        Phone: {user.get("phone","-")}</p>
    </div>
    """, unsafe_allow_html=True)


# ==============================================================
# INGEST
# ==============================================================

elif page == "📥 Ingest":

    st.markdown('<div class="app-title">📥 Upload Medical PDF</div>', unsafe_allow_html=True)

    uploaded_file = st.file_uploader("Upload PDF", type="pdf")

    if uploaded_file:
        if st.button("Save Record"):
            st.session_state.records.append(uploaded_file.name)
            st.success("Record Saved!")


# ==============================================================
# RECORDS
# ==============================================================

elif page == "📁 Records":

    st.markdown('<div class="app-title">📁 Medical Records</div>', unsafe_allow_html=True)

    if st.session_state.records:
        for record in st.session_state.records:
            st.success(f"📄 {record}")
    else:
        st.info("No records uploaded yet.")


# ==============================================================
# AI CHAT
# ==============================================================

elif page == "🤖 AI":

    st.markdown('<div class="app-title">🤖 AI Medical Assistant</div>', unsafe_allow_html=True)

    for msg in st.session_state.chat_history:
        with st.chat_message(msg["role"]):
            st.markdown(msg["content"])

    user_input = st.chat_input("Ask your medical question")

    if user_input:
        st.session_state.chat_history.append(
            {"role": "user", "content": user_input}
        )

        with st.chat_message("user"):
            st.markdown(user_input)

        with st.spinner("AI is thinking..."):
            time.sleep(1)

            text = user_input.lower()

            if "fever" in text:
                bot_reply = "You may have a mild infection. Stay hydrated."
            elif "headache" in text:
                bot_reply = "Headache may be due to stress or dehydration."
            else:
                bot_reply = "This is a demo AI assistant."

        st.session_state.chat_history.append(
            {"role": "assistant", "content": bot_reply}
        )

        with st.chat_message("assistant"):
            st.markdown(bot_reply)


# ==============================================================
# STATS
# ==============================================================

elif page == "❤️ Stats":

    st.markdown('<div class="app-title">❤️ Current Health Stats</div>', unsafe_allow_html=True)

    heart = st.number_input("Heart Rate (bpm)", value=72)
    bp = st.text_input("Blood Pressure")
    sugar = st.number_input("Blood Sugar", value=95)

    if st.button("Save Stats"):
        st.success("Health Stats Updated")


# ==============================================================
# WATCH
# ==============================================================

elif page == "⌚ Watch":

    st.markdown('<div class="app-title">⌚ Smart Watch</div>', unsafe_allow_html=True)

    if st.button("Connect Watch"):
        time.sleep(1)
        st.success("Watch Connected (Demo Mode)")

    st.info("Real implementation requires device API integration.")


# ==============================================================
# GRAPH
# ==============================================================

elif page == "📈 Graph":

    st.markdown('<div class="app-title">📈 Weekly Heart Rate</div>', unsafe_allow_html=True)

    days = ["Mon","Tue","Wed","Thu","Fri","Sat","Sun"]
    values = [72, 75, 78, 70, 74, 77, 73]

    fig, ax = plt.subplots()
    ax.plot(days, values, marker='o')
    ax.set_title("Heart Rate")
    ax.set_ylabel("BPM")

    st.pyplot(fig)


# ==============================================================
# QR DOWNLOAD
# ==============================================================

elif page == "📱 QR Download":

    st.markdown('<div class="app-title">📱 Get Mobile App</div>', unsafe_allow_html=True)
    st.markdown('<div class="glass-card">', unsafe_allow_html=True)

    try:
        # Get Local IP
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.connect(("8.8.8.8", 80))
        local_ip = s.getsockname()[0]
        s.close()
        
        url = f"https://drive.google.com/uc?export=download&id=1fglybOu_F533MEhVVB0uXvD2r-xydHZ0"
        
        st.info(f"Scan to download:\n1. Ensure phone is on same WiFi as PC\n2. Scan QR Code below")
        
        # Generate QR
        qr = qrcode.QRCode(version=1, box_size=10, border=5)
        qr.add_data(url)
        qr.make(fit=True)
        img = qr.make_image(fill_color="black", back_color="white")
        
        # Convert to bytes for streamlit
        buf = BytesIO()
        img.save(buf)
        st.image(buf.getvalue(), caption=url, width=300)
        
    except Exception as e:
        st.error(f"Could not generate QR Code: {e}")

    st.markdown('</div>', unsafe_allow_html=True)


# ==============================================================
# LOGOUT
# ==============================================================

elif page == "🚪 Logout":

    st.session_state.logged_in = False
    st.session_state.chat_history = []
    st.success("Logged Out")
    st.rerun()