# Local Qwen Interview Model Servers

This FastAPI service serves the fine-tuned Qwen LoRA adapters used for interview question and feedback generation.

The NestJS backend keeps Gemini as the safe fallback provider. Set `AI_QUESTION_PROVIDER=local-qwen` or `AI_FEEDBACK_PROVIDER=local-qwen` to route generation to local Qwen.

## Folder Assumption

By default, the server expects the question LoRA adapter folder here:

```txt
D:\DAIHOC\DATN\qwen_interview_questions_lora
```

and the feedback LoRA adapter folder here:

```txt
D:\DAIHOC\DATN\qwen_interview_feedback_lora\qwen_interview_feedback_lora
```

## Setup

```bash
cd backend
python -m venv .venv-model
.venv-model\Scripts\activate
pip install -r model-server\requirements.txt
```

## Start Servers

Question server:

```bash
npm run model:questions
```

Feedback server:

```bash
npm run model:feedback
```

Health checks:

```bash
curl http://localhost:8001/health
curl http://localhost:8002/health
```

## Backend Environment

Use Gemini:

```env
AI_QUESTION_PROVIDER=gemini
```

Use local Qwen LoRA:

```env
AI_QUESTION_PROVIDER=local-qwen
AI_FEEDBACK_PROVIDER=local-qwen
LOCAL_QUESTION_MODEL_URL=http://localhost:8001
LOCAL_FEEDBACK_MODEL_URL=http://localhost:8002
AI_LOCAL_FALLBACK_TO_GEMINI=true
LOCAL_MODEL_TIMEOUT_MS=600000
```

Optional model server env:

```env
LOCAL_MODEL_BASE_MODEL=unsloth/qwen2.5-3b-instruct-bnb-4bit
LOCAL_QUESTION_MODEL_ADAPTER_PATH=D:\DAIHOC\DATN\qwen_interview_questions_lora
LOCAL_FEEDBACK_MODEL_ADAPTER_PATH=D:\DAIHOC\DATN\qwen_interview_feedback_lora\qwen_interview_feedback_lora
LOCAL_MODEL_LOAD_IN_4BIT=true
LOCAL_MODEL_MAX_NEW_TOKENS=1400
LOCAL_FEEDBACK_MODEL_MAX_NEW_TOKENS=900
LOCAL_MODEL_TEMPERATURE=0.7
LOCAL_MODEL_TOP_P=0.9
LOCAL_MODEL_REPETITION_PENALTY=1.05
LOCAL_FEEDBACK_MODEL_REPETITION_PENALTY=1.05
LOCAL_MODEL_DEVICE=cuda
```

## Notes

- The LoRA folder contains adapter weights only, not the full base model.
- The first startup can take time because the base model must be downloaded or loaded from cache.
- GPU is strongly recommended. CPU inference may work but will be slow.
- `LOCAL_MODEL_LOAD_IN_4BIT=true` is recommended for 6GB VRAM GPUs.
- If the local server fails and `AI_LOCAL_FALLBACK_TO_GEMINI=true`, NestJS will fall back to Gemini automatically.
- The feedback model is experimental. Keep backend transcript validation enabled so empty or too-short interviews are rejected before calling the model.
- For local 6GB VRAM machines, run only the model server you are actively testing. Running question and feedback models at the same time can be heavy.
- If you see warnings about copying LoRA weights to `meta` parameters, restart the model server after updating `model-server/app.py`; the server now loads the base model into real memory before attaching the LoRA adapter.
