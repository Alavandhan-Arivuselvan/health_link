import os
from dotenv import load_dotenv

# Fix SSL cert verification on machines with incomplete cert stores
# (common on Windows in corporate/college networks)
try:
    import certifi
    os.environ.setdefault('SSL_CERT_FILE', certifi.where())
except ImportError:
    pass

load_dotenv()

# Gemini
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
GEMINI_MODEL = "gemini-3-flash-preview"  # update to your preferred model

# Neo4j
NEO4J_URI = os.getenv("NEO4J_URI")
NEO4J_USER = os.getenv("NEO4J_USERNAME")
NEO4J_PASSWORD = os.getenv("NEO4J_PASSWORD")

# Ingestion settings
DATE_FORMAT = "%Y-%m-%d"
