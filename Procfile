#web: gunicorn -k uvicorn.workers.UvicornWorker app:app
web: uvicorn main:app --host 0.0.0.0 --port $PORT