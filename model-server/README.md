# Local Qwen Interview Question Model Server

This FastAPI service serves the fine-tuned Qwen LoRA adapter used for interview question generation.

The NestJS backend keeps Gemini as the default provider. Set `AI_QUESTION_PROVIDER=local-qwen` to route question generation to this local server.

## Folder Assumption

By default, the server expects the LoRA adapter folder here:

```txt
D:\DAIHOC\DATN\qwen_interview_questions_lora
```

Override it with:

```env
LOCAL_MODEL_ADAPTER_PATH=D:\DAIHOC\DATN\qwen_interview_questions_lora
```

## Setup

```bash
cd backend
python -m venv .venv-model
.venv-model\Scripts\activate
pip install -r model-server\requirements.txt
```

## Start Server

```bash
uvicorn app:app --app-dir model-server --host 0.0.0.0 --port 8001
```

Health check:

```bash
curl http://localhost:8001/health
```

## Backend Environment

Use Gemini:

```env
AI_QUESTION_PROVIDER=gemini
```

Use local Qwen LoRA:

```env
AI_QUESTION_PROVIDER=local-qwen
LOCAL_MODEL_URL=http://localhost:8001
AI_LOCAL_FALLBACK_TO_GEMINI=false
LOCAL_MODEL_TIMEOUT_MS=600000
```

Optional model server env:

```env
LOCAL_MODEL_BASE_MODEL=unsloth/qwen2.5-3b-instruct-bnb-4bit
LOCAL_MODEL_ADAPTER_PATH=D:\DAIHOC\DATN\qwen_interview_questions_lora
LOCAL_MODEL_LOAD_IN_4BIT=true
LOCAL_MODEL_MAX_NEW_TOKENS=1400
LOCAL_MODEL_TEMPERATURE=0.7
LOCAL_MODEL_TOP_P=0.9
LOCAL_MODEL_REPETITION_PENALTY=1.05
LOCAL_MODEL_DEVICE=cuda
```

## Notes

- The LoRA folder contains adapter weights only, not the full base model.
- The first startup can take time because the base model must be downloaded or loaded from cache.
- GPU is strongly recommended. CPU inference may work but will be slow.
- `LOCAL_MODEL_LOAD_IN_4BIT=true` is recommended for 6GB VRAM GPUs.
- If the local server fails and `AI_LOCAL_FALLBACK_TO_GEMINI=true`, NestJS will fall back to Gemini automatically.
- If you see warnings about copying LoRA weights to `meta` parameters, restart the model server after updating `model-server/app.py`; the server now loads the base model into real memory before attaching the LoRA adapter.
