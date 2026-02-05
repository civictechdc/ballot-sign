FROM python:3.11-slim

ENV PYTHONUNBUFFERED=1
WORKDIR /app

COPY requirements.txt /app/requirements.txt
RUN pip install --no-cache-dir -r /app/requirements.txt

COPY . /app
ENV PYTHONPATH=/app

EXPOSE 8001
CMD ["uvicorn", "ballot_backend:app", "--host", "0.0.0.0", "--port", "8001", "--reload", "--reload-dir", "/app"]
