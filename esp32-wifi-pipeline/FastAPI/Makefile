APP = main:app
PORT = 8000

install:
	pip install -r requirements.txt

run:
	python3 -m uvicorn $(APP) --host 0.0.0.0 --port $(PORT) --reload --reload-dir . --reload-exclude ".venv/*"

dev:
	python -m uvicorn $(APP) --reload --reload-dir . --reload-exclude ".venv/*"

stop:
	pkill -f "uvicorn" || true

ip:
	ipconfig getifaddr en0

createEnv:
	python3 -m venv .venv

	pip install python-multipart