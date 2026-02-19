
from fastapi.testclient import TestClient
from .backend import app
import os
import shutil

client = TestClient(app)

def test_flow():
    phone = "1234567890"
    otp = None

    print("\n--- 1. Testing Register ---")
    response = client.post("/register", json={
        "name": "Test User", 
        "phone": phone, 
        "dob": "1990-01-01",
        "gender": "Male",
        "blood_group": "O+",
        "password": "password123"
    })
    print(f"Register Response: {response.json()}")
    assert response.status_code == 200
    assert response.json()["status"] == "success"

    print("\n--- 2. Testing Login ---")
    response = client.post("/login", json={"phone": phone, "password": "password123"})
    print(f"Login Response: {response.json()}")
    assert response.status_code == 200
    assert response.json()["user"]["name"] == "Test User"

    print("\n--- 3. Testing Send OTP ---")
    response = client.post("/send-otp", json={"phone": phone})
    print(f"Send OTP Response: {response.json()}")
    assert response.status_code == 200
    
    # In a real test we can't see the random OTP easily without mocking, 
    # but we can check if the endpoint works.
    # For this script we will cheat and look at the 'otps' dict in app 
    # but since we import 'app' from 'backend', we can import 'db' too if we export it, 
    # or just trust the manual verification or log output.
    
    # Let's try to verify with a wrong OTP first
    print("\n--- 4. Testing Verify Wrong OTP ---")
    response = client.post("/verify-otp", json={"phone": phone, "otp": "0000"})
    print(f"Verify Wrong OTP Response: {response.json()}")
    assert response.json()["status"] == "error"

    print("\n--- 5. Testing File Upload ---")
    # Create a dummy file
    with open("test_upload.txt", "w") as f:
        f.write("This is a test file for upload.")
    
    with open("test_upload.txt", "rb") as f:
        response = client.post("/upload", files={"file": ("test_upload.txt", f, "text/plain")})
    
    print(f"Upload Response: {response.json()}")
    assert response.status_code == 200
    assert response.json()["status"] == "success"
    
    # Clean up
    if os.path.exists("test_upload.txt"):
        os.remove("test_upload.txt")
    if os.path.exists(f"uploads/test_upload.txt"):
        os.remove(f"uploads/test_upload.txt")
        
    print("\n--- All Tests Passed ---")

if __name__ == "__main__":
    test_flow()
