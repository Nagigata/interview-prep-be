import json
import os
from functools import lru_cache
from pathlib import Path
from typing import Any, Literal

from dotenv import load_dotenv


load_dotenv(Path(__file__).resolve().parents[1] / ".env")

import torch
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field
from peft import PeftModel
from transformers import AutoModelForCausalLM, AutoTokenizer, BitsAndBytesConfig


DEFAULT_BASE_MODEL = "unsloth/qwen2.5-3b-instruct-bnb-4bit"


class GenerateQuestionsRequest(BaseModel):
    role: str
    level: str
    type: str
    techstack: str
    amount: int = Field(default=5, ge=1, le=20)
    language: Literal["en", "vi"] = "en"


class InterviewQuestion(BaseModel):
    question: str
    expectedAnswer: str | None = None
    category: str | None = None
    difficulty: str | None = None


class GenerateQuestionsResponse(BaseModel):
    questions: list[InterviewQuestion]
    provider: str = "local-qwen"


def project_root() -> Path:
    return Path(__file__).resolve().parents[2]


def adapter_path() -> str:
    configured_path = os.getenv("LOCAL_MODEL_ADAPTER_PATH")
    if configured_path:
        return configured_path

    return str(project_root() / "qwen_interview_questions_lora")


def model_name() -> str:
    return os.getenv("LOCAL_MODEL_BASE_MODEL", DEFAULT_BASE_MODEL)


def load_in_4bit() -> bool:
    return os.getenv("LOCAL_MODEL_LOAD_IN_4BIT", "true").lower() == "true"


def max_new_tokens() -> int:
    return int(os.getenv("LOCAL_MODEL_MAX_NEW_TOKENS", "1400"))


def torch_dtype() -> torch.dtype:
    if not torch.cuda.is_available():
        return torch.float32

    dtype = os.getenv("LOCAL_MODEL_DTYPE", "float16").lower()
    return torch.bfloat16 if dtype == "bfloat16" else torch.float16


def target_device() -> torch.device:
    configured_device = os.getenv("LOCAL_MODEL_DEVICE")
    if configured_device == "cuda" and not torch.cuda.is_available():
        raise RuntimeError(
            "LOCAL_MODEL_DEVICE=cuda but this Python environment cannot access CUDA. "
            "Install a CUDA-enabled PyTorch build in backend/.venv-model or set "
            "LOCAL_MODEL_DEVICE=cpu for very slow CPU testing."
        )

    if configured_device:
        return torch.device(configured_device)

    return torch.device("cuda" if torch.cuda.is_available() else "cpu")


def model_device(model) -> torch.device:
    return next(model.parameters()).device


def build_messages(payload: GenerateQuestionsRequest) -> list[dict[str, str]]:
    language_name = "Vietnamese" if payload.language == "vi" else "English"
    input_payload = {
        "role": payload.role,
        "level": payload.level,
        "type": payload.type,
        "techstack": payload.techstack,
        "amount": payload.amount,
        "language": payload.language,
    }

    return [
        {
            "role": "system",
            "content": (
                "You are an AI interview-question generator. "
                "Your job is to generate interview questions based on role, "
                "level, interview type, techstack, amount, and language. "
                "Return ONLY valid JSON. Do not include markdown, explanations, "
                "or extra text."
            ),
        },
        {
            "role": "user",
            "content": (
                "Return JSON matching exactly this schema:\n"
                "{\n"
                '  "questions": [\n'
                "    {\n"
                '      "question": "string",\n'
                '      "expectedAnswer": "string",\n'
                '      "category": "string",\n'
                '      "difficulty": "string"\n'
                "    }\n"
                "  ]\n"
                "}\n\n"
                f"Generate the response in {language_name}.\n\n"
                f"Input:\n{json.dumps(input_payload, ensure_ascii=False)}"
            ),
        },
    ]


def extract_json(raw_text: str) -> dict[str, Any]:
    cleaned = raw_text.strip().replace("```json", "").replace("```", "").strip()

    try:
        return json.loads(cleaned)
    except json.JSONDecodeError:
        start = cleaned.find("{")
        end = cleaned.rfind("}")
        if start >= 0 and end > start:
            return json.loads(cleaned[start : end + 1])
        raise


def normalize_questions(data: dict[str, Any], amount: int) -> list[InterviewQuestion]:
    raw_questions = data.get("questions", data)

    if not isinstance(raw_questions, list):
        raise ValueError("Model response does not contain a questions array.")

    questions: list[InterviewQuestion] = []
    for item in raw_questions[:amount]:
        if isinstance(item, str):
            questions.append(InterviewQuestion(question=item))
            continue

        if isinstance(item, dict) and item.get("question"):
            questions.append(InterviewQuestion(**item))

    if not questions:
        raise ValueError("Model response did not include valid questions.")

    return questions


@lru_cache(maxsize=1)
def load_model():
    adapter = adapter_path()
    if not Path(adapter).exists():
        raise RuntimeError(f"LoRA adapter path does not exist: {adapter}")

    tokenizer = AutoTokenizer.from_pretrained(adapter, trust_remote_code=True)
    quantization_config = None
    if load_in_4bit() and torch.cuda.is_available():
        quantization_config = BitsAndBytesConfig(
            load_in_4bit=True,
            bnb_4bit_quant_type="nf4",
            bnb_4bit_compute_dtype=torch.float16,
            bnb_4bit_use_double_quant=True,
        )

    base_model = AutoModelForCausalLM.from_pretrained(
        model_name(),
        dtype=None if quantization_config else torch_dtype(),
        quantization_config=quantization_config,
        device_map="auto" if quantization_config else None,
        low_cpu_mem_usage=False,
        trust_remote_code=True,
    )
    model = PeftModel.from_pretrained(
        base_model,
        adapter,
        is_trainable=False,
        low_cpu_mem_usage=False,
    )
    if quantization_config is None:
        model.to(target_device())
    model.eval()
    return tokenizer, model


app = FastAPI(title="PrepWise Local Qwen Model Server")


@app.get("/health")
def health():
    return {
        "status": "ok",
        "provider": "local-qwen",
        "adapterPath": adapter_path(),
        "baseModel": model_name(),
        "cuda": torch.cuda.is_available(),
    }


@app.post("/generate-questions", response_model=GenerateQuestionsResponse)
def generate_questions(payload: GenerateQuestionsRequest):
    try:
        tokenizer, model = load_model()
        messages = build_messages(payload)
        prompt = tokenizer.apply_chat_template(
            messages,
            tokenize=False,
            add_generation_prompt=True,
        )
        inputs = tokenizer(prompt, return_tensors="pt").to(model_device(model))

        with torch.inference_mode():
            output_ids = model.generate(
                **inputs,
                max_new_tokens=max_new_tokens(),
                do_sample=True,
                temperature=float(os.getenv("LOCAL_MODEL_TEMPERATURE", "0.7")),
                top_p=float(os.getenv("LOCAL_MODEL_TOP_P", "0.9")),
                repetition_penalty=float(
                    os.getenv("LOCAL_MODEL_REPETITION_PENALTY", "1.05")
                ),
                pad_token_id=tokenizer.eos_token_id,
            )

        generated_ids = output_ids[0][inputs["input_ids"].shape[-1] :]
        raw_text = tokenizer.decode(generated_ids, skip_special_tokens=True)
        data = extract_json(raw_text)
        questions = normalize_questions(data, payload.amount)

        return GenerateQuestionsResponse(questions=questions)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc
