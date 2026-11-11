  FROM python:3.12-slim

WORKDIR /app

COPY backend/requirements.txt /app/backend/requirements.txt
RUN pip install --no-cache-dir -r /app/backend/requirements.txt

COPY backend /app/backend
COPY workers /app/workers

ENV PYTHONPATH=/app/backend:/app
CMD ["python", "/app/workers/campaigns/dispatcher.py"]

