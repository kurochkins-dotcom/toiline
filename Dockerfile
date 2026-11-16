FROM python:3.13-slim
WORKDIR /app
COPY server.py toi.py ./
COPY static ./static
ENV PORT=8000 DATA_DIR=/data PYTHONUNBUFFERED=1
EXPOSE 8000
CMD ["python", "server.py"]
