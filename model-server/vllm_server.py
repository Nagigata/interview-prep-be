import os
import runpy
import sys

# Force LIBRARY_PATH for Python subprocesses spawned by vLLM Engine
os.environ["LIBRARY_PATH"] = "/usr/lib/x86_64-linux-gnu"

if __name__ == "__main__":
    # Emulate python3 -m vllm.entrypoints.openai.api_server
    runpy.run_module("vllm.entrypoints.openai.api_server", run_name="__main__")
