FROM ubuntu:22.04

ENV DEBIAN_FRONTEND=noninteractive

# 1. Install prerequisites
RUN apt-get update && apt-get install -y \
    build-essential gcc g++ \
    python3 python3-pip python3-venv python3-dev \
    wget tar bzip2 git \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /sim

# 2. Download clean NS-3.35
RUN wget -q --no-check-certificate https://www.nsnam.org/releases/ns-allinone-3.35.tar.bz2 \
    && tar xjf ns-allinone-3.35.tar.bz2 \
    && rm ns-allinone-3.35.tar.bz2

# 3. Clone ns3-ai
WORKDIR /sim/ns-allinone-3.35/ns-3.35/contrib
RUN git clone https://github.com/hust-diangroup/ns3-ai.git

# 4. Git-commit hunt to find the missing wscript
WORKDIR /sim/ns-allinone-3.35/ns-3.35/contrib/ns3-ai
RUN COMMIT=$(git rev-list HEAD | while read commit; do \
        git ls-tree -r $commit | grep -q "wscript" && echo $commit && break; \
    done) && \
    git checkout $COMMIT -q && \
    sed -i "s/conf.env\\[.ENABLE_PYTHON_BINDINGS.\\]/True/g" wscript

# 5. Copy custom code
WORKDIR /sim/ns-allinone-3.35/ns-3.35
COPY ns3_files/scratch/rl-tcp-inference scratch/rl-tcp-inference/
COPY ns3_files/contrib/ns3-ai/py_interface/py_interface.py contrib/ns3-ai/py_interface/
COPY ns3_files/contrib/ns3-ai/examples/rl-tcp/ contrib/ns3-ai/examples/rl-tcp/

# 6. Venv setup
RUN python3 -m venv /sim/ns3env
ENV PATH="/sim/ns3env/bin:$PATH"
ENV PIP_EXTRA_INDEX_URL=https://download.pytorch.org/whl/cpu

# 7. Install Python packages
RUN pip install --upgrade pip \
    && pip install stable_baselines3 numpy requests fastapi uvicorn pydantic gymnasium psutil websocket-client

# 8. Build NS-3 C++ core FIRST
WORKDIR /sim/ns-allinone-3.35/ns-3.35
RUN ./waf configure \
    --disable-python \
    --enable-modules=core,network,internet,point-to-point,applications,stats,traffic-control,ns3-ai \
    && ./waf build

# 9. Build shm_pool Python C-extension AFTER waf
RUN cd contrib/ns3-ai/py_interface && pip install .

# 10. Verify shm_pool.so was built
RUN find /sim/ns3env/lib -name "*shm_pool*" \
    && echo "✅ shm_pool.so confirmed in venv site-packages" \
    || (echo "❌ shm_pool.so MISSING - build failed" && exit 1)

# 11. Copy models
COPY ns3_files/models/ /sim/models/

# 12. Copy sim_server — py_interface.py must NOT exist in this folder
# Verify before building: ls ns3_files/sim_server/services/
# py_interface.py must not be listed there
COPY ns3_files/sim_server/ /sim/sim_server/

# 13. Delete any stray py_interface.py copies that snuck in via sim_server
# This is a hard guarantee — even if one accidentally exists, it gets removed
RUN find /sim/sim_server -name "py_interface.py" -delete \
    && echo "✅ No stray py_interface.py in sim_server"

EXPOSE 8000
WORKDIR /sim/sim_server

CMD ["/sim/ns3env/bin/python3", "-u", "/sim/sim_server/main.py"]