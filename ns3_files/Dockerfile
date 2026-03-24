FROM ubuntu:22.04

# Avoid interactive prompts
ENV DEBIAN_FRONTEND=noninteractive

# ── System dependencies ──────────────────────────────
RUN apt-get update && apt-get install -y \
    build-essential \
    gcc \
    g++ \
    python3 \
    python3-pip \
    python3-venv \
    python3-dev \
    wget \
    tar \
    bzip2 \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /sim

# ── Download and extract ns-3.35 ─────────────────────
RUN wget -q https://www.nsnam.org/releases/ns-allinone-3.35.tar.bz2 \
    && tar xjf ns-allinone-3.35.tar.bz2 \
    && rm ns-allinone-3.35.tar.bz2

WORKDIR /sim/ns-allinone-3.35/ns-3.35

# ── Copy project-specific files ──────────────────────
COPY ns3_files/scratch/rl-tcp-inference scratch/rl-tcp-inference/
COPY ns3_files/contrib/ns3-ai/py_interface/py_interface.py contrib/ns3-ai/py_interface/
COPY ns3_files/contrib/ns3-ai/examples/rl-tcp/ contrib/ns3-ai/examples/rl-tcp/

# ── Python virtual environment ───────────────────────
RUN python3 -m venv /sim/ns3env
ENV PATH="/sim/ns3env/bin:$PATH"
RUN pip install --upgrade pip \
    && pip install stable_baselines3 numpy requests

# ── Build ns-3 ───────────────────────────────────────
RUN ./waf configure --enable-examples 2>&1 | tail -5 \
    && ./waf build 2>&1 | tail -5

# ── Convenience: set working directory for training ──
WORKDIR /sim/ns-allinone-3.35/ns-3.35

# Container stays running for interactive use
CMD ["/bin/bash"]
