ARG NAUTOBOT_VER="3.0.8"
ARG PYTHON_VER="3.11"

# Stage 1: Build Frontend
FROM node:20-slim AS frontend-builder
WORKDIR /source/frontend
COPY frontend/package*.json ./
RUN npm install
COPY frontend/ ./
RUN npm run build

# Stage 2: Build Plugin
FROM ghcr.io/nautobot/nautobot:${NAUTOBOT_VER}-py${PYTHON_VER}

USER root

# Install dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

# Install uv for faster package management
RUN pip install --no-cache-dir uv

# Copy the plugin source
COPY . /source
WORKDIR /source

# Copy built frontend assets from Stage 1
COPY --from=frontend-builder /source/nautobot_topology/static/nautobot_topology/ /source/nautobot_topology/static/nautobot_topology/

# Install the plugin using uv
RUN uv pip install --system -e .

USER nautobot
