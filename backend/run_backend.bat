@echo off
echo Starting FastAPI Backend on 0.0.0.0:9000...
echo Ensure your firewall allows port 9000.
uvicorn main:app --host 0.0.0.0 --port 9000 --reload
pause
