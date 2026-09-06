# Traffic Routing Engine - Production Container Image
FROM python:3.11-slim

# Install system dependencies, g++ with C++20 and OpenMP support
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    g++ \
    libgomp1 \
    curl \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install Python requirements
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt gunicorn

# Copy source code and assets
COPY . .

# Compile high-speed C++20 OpenMP pybind11 core for Linux
RUN python scripts/build_cpp.py

# Default port (Render, Railway, Fly.io provide $PORT at runtime)
ENV PORT=5000
EXPOSE 5000

# Healthcheck
HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:${PORT}/api/health || exit 1

# Start Flask backend API
CMD ["sh", "-c", "python scripts/run_web.py --host 0.0.0.0 --port ${PORT}"]
