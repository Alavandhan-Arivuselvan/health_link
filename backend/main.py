from fastapi import FastAPI
from fastapi.responses import FileResponse
import os

app = FastAPI()

@app.get("/")
def read_root():
    return {"Hello": "World"}

@app.get("/download")
def download_app():
    file_path = os.path.join(os.path.dirname(__file__), "demo.html")
    if os.path.exists(file_path):
        return FileResponse(file_path, filename="demo.html", media_type="text/html")
    return {"error": "File not found"}
