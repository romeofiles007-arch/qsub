#!/bin/bash
unset PYTHONHOME PYTHONPATH
cd "E:/Web test/ระบบขายรถ/ระบบตัดเสียงเงียบ/tools/align"
PY310="C:/Users/romeo/AppData/Local/Python/pythoncore-3.10-64/python.exe"
echo "[$(date +%T)] create venv..."
"$PY310" -m venv venv
PY="venv/Scripts/python.exe"
"$PY" -m pip install --upgrade pip -q
echo "[$(date +%T)] install torch+torchaudio (CUDA 12.4)..."
"$PY" -m pip install torch torchaudio --index-url https://download.pytorch.org/whl/cu124 -q
echo "[$(date +%T)] install ctc-forced-aligner..."
"$PY" -m pip install ctc-forced-aligner -q 2>&1 | tail -3
echo "[$(date +%T)] verify:"
"$PY" -c "import torch;print('torch',torch.__version__,'cuda',torch.cuda.is_available())"
echo "INSTALL_DONE"
