
from fastapi.testclient import TestClient
from backend.backend import app
import os
import shutil

client = TestClient(app)

def test_upload():
    # 1. Test Valid Image Upload
    with open("test.jpg", "wb") as f:
        f.write(b"fake image data")
    
    with open("test.jpg", "rb") as f:
        response = client.post("/upload", files={"file": ("test.jpg", f, "image/jpeg")})
    
    print(f"Image Upload: {response.json()}")
    assert response.status_code == 200
    assert response.json()["status"] == "success"

    # 2. Test Valid PDF Upload
    with open("test.pdf", "wb") as f:
        f.write(b"fake pdf data")
    
    with open("test.pdf", "rb") as f:
        response = client.post("/upload", files={"file": ("test.pdf", f, "application/pdf")})

    print(f"PDF Upload: {response.json()}")
    assert response.status_code == 200
    
    # 3. Test Invalid File Type
    with open("test.txt", "wb") as f:
        f.write(b"text data")
        
    with open("test.txt", "rb") as f:
        response = client.post("/upload", files={"file": ("test.txt", f, "text/plain")})
        
    print(f"Invalid Upload: {response.json()}")
    assert response.status_code == 400
    
    # Cleanup
    for file in ["test.jpg", "test.pdf", "test.txt"]:
        if os.path.exists(file):
            os.remove(file)
            
    print("\nAll upload tests passed!")

if __name__ == "__main__":
    test_upload()
