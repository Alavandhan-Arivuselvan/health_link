from backend import app
import uvicorn

@app.get("/")
def read_root():
    return {"Hello": "World"}

if __name__ == "__main__":
    port = 9000
    print(f"\n🚀 Starting HealthLink Backend on port {port}")
    print(f"   Local:  http://localhost:{port}")
    print(f"   LAN:    http://0.0.0.0:{port}")
    print(f"\n   To expose to the internet, run in a separate terminal:")
    print(f"   ngrok http {port}\n")
    uvicorn.run(app, host="0.0.0.0", port=port)
