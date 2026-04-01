from backend import app
import uvicorn

@app.get("/")
def read_root():
    return {"Hello": "World"}

import os

if __name__ == "__main__":
    port = int(os.environ.get("PORT", 9000))
    print(f"\n🚀 Starting HealthLink Backend on port {port}")
    print(f"   Local:  http://localhost:{port}")
    print(f"   LAN:    http://0.0.0.0:{port}")
    print(f"\n   To expose to the internet, run in a separate terminal:")
    print(f"   ngrok http {port}\n")
    uvicorn.run(app, host="0.0.0.0", port=port)
