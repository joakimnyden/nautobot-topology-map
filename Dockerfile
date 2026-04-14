ARG NAUTOBOT_VER="3.0.8"
ARG PYTHON_VER="3.11"

FROM ghcr.io/nautobot/nautobot:${NAUTOBOT_VER}-py${PYTHON_VER} as nautobot-base

USER 0

RUN apt-get update && \
    apt-get upgrade -y && \
    apt-get autoremove -y && \
    apt-get clean all && \
    rm -rf /var/lib/apt/lists/* && \
    pip --no-cache-dir install --upgrade pip wheel


# Stage 1: Build Frontend
FROM node:20-slim AS frontend-builder
WORKDIR /source/frontend
COPY frontend/package*.json ./
RUN npm install
COPY frontend/ ./
RUN npm run build

#############################################################################

# FROM ghcr.io/nautobot/nautobot-dev:${NAUTOBOT_VERSION}-py${PYTHON_VER} as builder

# CMD ["nautobot-server", "runserver", "0.0.0.0:8080", "--insecure"]

# RUN apt-get update && \
#     apt-get upgrade -y && \
#     apt-get autoremove -y && \
#     apt-get clean all && \
#     rm -rf /var/lib/apt/lists/*

# COPY ../pyproject.toml ../poetry.lock /source/
# COPY ../plugins /source/plugins
# # COPY ../packages /source/packages

# # Install the nautobot project to include Nautobot
# RUN cd /source && \
#     poetry install --no-interaction --no-ansi && \
#     # Try to install the export plugin for Poetry v2, if it fails it's probably v1 so we can ignore it
#     poetry self add poetry-plugin-export || true && \
#     mkdir /tmp/dist && \
#     poetry export --without-hashes -o /tmp/dist/requirements.txt

# # -------------------------------------------------------------------------------------
# # Build Apps in plugins folder
# # -------------------------------------------------------------------------------------
# # RUN for plugin in /source/plugins/*; do \
# #         cd $plugin && \
# #         poetry build && \
# #         cp dist/*.whl /tmp/dist; \
# #     done

# COPY ../jobs /opt/nautobot/jobs
# # COPY ../metrics /opt/nautobot/metrics
# COPY ../config/nautobot_config.py /opt/nautobot/nautobot_config.py

# WORKDIR /source


# -------------------------------------------------------------------------------------
# stage 3 builder
# -------------------------------------------------------------------------------------
FROM ghcr.io/nautobot/nautobot:${NAUTOBOT_VER}-py${PYTHON_VER} as builder

CMD ["nautobot-server", "runserver", "0.0.0.0:8080", "--insecure"]

USER root

RUN apt-get update && \
    apt-get install -y --no-install-recommends \
    build-essential \
    vim && \
    rm -rf /var/lib/apt/lists/*

# Install uv for faster package management
RUN pip install --no-cache-dir uv

# Copy the plugin source
COPY nautobot_topology /source/nautobot_topology
COPY pyproject.toml /source
COPY README.md /source
WORKDIR /source

# Copy built frontend assets from Stage 1
COPY --from=frontend-builder /source/nautobot_topology/static/nautobot_topology/ /source/nautobot_topology/static/nautobot_topology/

# Install the plugin using uv
RUN uv pip install --system -e .

# build the plugin
RUN cd /source && \
    uv build && \
    uv export -o /tmp/dist/requirements.txt && \
    cp dist/*.whl /tmp/dist

USER nautobot


# -------------------------------------------------------------------------------------
# stage 4 Final Image
# -------------------------------------------------------------------------------------
FROM nautobot-base as nautobot

ARG PYTHON_VER
# Copy from base the required python libraries and binaries
COPY --from=builder /tmp/dist /tmp/dist
COPY --from=builder /opt/nautobot /opt/nautobot
COPY --from=builder /usr/local/lib/python${PYTHON_VER}/site-packages /usr/local/lib/python${PYTHON_VER}/site-packages
COPY --from=builder /usr/local/bin /usr/local/bin
# COPY --from=frontend-builder /source/nautobot_topology/static/nautobot_topology/ /opt/nautobot/nautobot_topology/static/nautobot_topology/
COPY nautobot_config.py /opt/nautobot/nautobot_config.py
# COPY nautobot_topology /opt/nautobot/nautobot_topology

# Install the plugin and its dependencies
RUN uv pip install --system /tmp/dist/*.whl

RUN nautobot-server collectstatic --no-input

USER nautobot

# Default command
CMD ["nautobot-server", "runserver", "0.0.0.0:8080", "--insecure"]

USER nautobot