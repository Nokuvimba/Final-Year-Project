
APP = main:app
PORT = 8000

# Install dependencies
install:
	pip install -r requirements.txt

# Run FastAPI server (for ESP32 to post data)
run:
	uvicorn $(APP) --host 0.0.0.0 --port $(PORT) --reload

# Run locally for quick testing
dev:
	uvicorn $(APP) --reload

# View recent Wi-Fi scan data stored in Postgres
view:
	python viewPostgresDB.py

# Connect directly to the Postgres database
db:
	PGPASSWORD='Password' psql -h localhost -U wifiuser -d wifi_db

# Stop any running FastAPI process
stop:
	pkill -f "uvicorn" || true

ip:
	ipconfig getifaddr en0