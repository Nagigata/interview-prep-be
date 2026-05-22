import json
import os
from functools import lru_cache
from pathlib import Path
from typing import Any, Literal

from dotenv import load_dotenv


load_dotenv(Path(__file__).resolve().parents[1] / ".env")

# Transformers can use threaded weight materialization. On Windows + CUDA
# bitsandbytes this can crash the process with a native access violation, so
# keep model loading single-threaded for the local dev server.
os.environ.setdefault("HF_ENABLE_PARALLEL_LOADING", "false")
os.environ.setdefault("HF_PARALLEL_LOADING_WORKERS", "1")
os.environ.setdefault("HF_DEACTIVATE_ASYNC_LOAD", "1")

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


class TranscriptMessage(BaseModel):
    role: str
    content: str


class GenerateFeedbackRequest(BaseModel):
    role: str = ""
    level: str = ""
    type: str = ""
    techstack: str | list[str] = ""
    language: Literal["en", "vi"] = "en"
    transcript: list[TranscriptMessage]


class FeedbackCategoryScore(BaseModel):
    name: str
    score: int
    comment: str


class GenerateFeedbackResponse(BaseModel):
    totalScore: int
    categoryScores: list[FeedbackCategoryScore]
    strengths: list[str]
    areasForImprovement: list[str]
    finalAssessment: str
    provider: str = "local-qwen"


FEEDBACK_CATEGORY_NAMES = [
    "Communication Skills",
    "Technical Knowledge",
    "Problem-Solving",
    "Cultural & Role Fit",
    "Confidence & Clarity",
]


def project_root() -> Path:
    return Path(__file__).resolve().parents[2]


def question_adapter_path() -> str:
    configured_path = os.getenv("LOCAL_QUESTION_MODEL_ADAPTER_PATH") or os.getenv(
        "LOCAL_MODEL_ADAPTER_PATH"
    )
    if configured_path:
        return configured_path

    return str(project_root() / "qwen_interview_questions_lora")


def feedback_adapter_path() -> str:
    configured_path = os.getenv("LOCAL_FEEDBACK_MODEL_ADAPTER_PATH")
    if configured_path:
        return configured_path

    return str(
        project_root()
        / "qwen_interview_feedback_lora"
        / "qwen_interview_feedback_lora"
    )


def adapter_path(kind: Literal["question", "feedback"]) -> str:
    return question_adapter_path() if kind == "question" else feedback_adapter_path()


def model_name() -> str:
    return os.getenv("LOCAL_MODEL_BASE_MODEL", DEFAULT_BASE_MODEL)


def load_in_4bit() -> bool:
    return os.getenv("LOCAL_MODEL_LOAD_IN_4BIT", "true").lower() == "true"


def max_new_tokens(kind: Literal["question", "feedback"]) -> int:
    specific_key = (
        "LOCAL_QUESTION_MODEL_MAX_NEW_TOKENS"
        if kind == "question"
        else "LOCAL_FEEDBACK_MODEL_MAX_NEW_TOKENS"
    )
    default = "1400" if kind == "question" else "900"
    return int(os.getenv(specific_key, os.getenv("LOCAL_MODEL_MAX_NEW_TOKENS", default)))


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


def build_feedback_messages(payload: GenerateFeedbackRequest) -> list[dict[str, str]]:
    language_name = "Vietnamese" if payload.language == "vi" else "English"
    techstack = (
        ", ".join(payload.techstack)
        if isinstance(payload.techstack, list)
        else payload.techstack
    )
    input_payload = {
        "role": payload.role,
        "level": payload.level,
        "type": payload.type,
        "techstack": techstack,
        "language": payload.language,
        "transcript": [item.model_dump() for item in payload.transcript],
    }

    return [
        {
            "role": "system",
            "content": (
                "You are an AI interviewer analyzing a mock interview. "
                "Return ONLY valid JSON. Do not include markdown, explanations, "
                "or extra text. "
                f"Write comments, strengths, areasForImprovement, and "
                f"finalAssessment in {language_name}.\n\n"
                "The JSON MUST match exactly this schema:\n"
                "{\n"
                '  "totalScore": number,\n'
                '  "categoryScores": [\n'
                '    {"name": "Communication Skills", "score": number, "comment": string},\n'
                '    {"name": "Technical Knowledge", "score": number, "comment": string},\n'
                '    {"name": "Problem-Solving", "score": number, "comment": string},\n'
                '    {"name": "Cultural & Role Fit", "score": number, "comment": string},\n'
                '    {"name": "Confidence & Clarity", "score": number, "comment": string}\n'
                "  ],\n"
                '  "strengths": [string, string],\n'
                '  "areasForImprovement": [string, string],\n'
                '  "finalAssessment": string\n'
                "}\n\n"
                "Transcript quality rules:\n"
                "- The transcript may contain speech-to-text mistakes, fragmented "
                "sentences, repeated short turns, filler words, unclear "
                "pronunciation, or interrupted answers.\n"
                "- Ignore greeting-only, closing-only, or obvious non-answer "
                "fragments.\n"
                "- Evaluate only the candidate ideas that are clearly expressed.\n"
                "- Do not invent missing details.\n\n"
                "Scoring rubric (apply strictly to each category, 0-100):\n"
                "- 0-20: Candidate did NOT provide a real answer (silence, "
                "'I don't know', greeting only, 1-3 word non-answers, repetition "
                "of the question, off-topic).\n"
                "- 21-40: Attempted but largely incorrect, missed core concepts, "
                "or extremely vague.\n"
                "- 41-60: Basic answer covering surface points; lacks depth, "
                "examples, or precision.\n"
                "- 61-80: Solid answer with correct concepts and at least one "
                "concrete example.\n"
                "- 81-100: Excellent answer with depth, accurate technical "
                "detail, and concrete examples or trade-offs.\n\n"
                "Critical scoring rules:\n"
                "- totalScore MUST be the integer average of the 5 category scores.\n"
                "- If a category has no relevant content in the transcript, that "
                "category score MUST be 0.\n"
                "- DO NOT inflate scores out of politeness.\n"
                "- A transcript where the candidate only greets, says 'yes/no', "
                "'I don't know', or fails to address questions MUST receive "
                "totalScore <= 20.\n"
                "- If the transcript is empty or contains no meaningful user "
                "answer, set all category scores to 0 and explain there is not "
                "enough evidence to evaluate.\n"
                "- In strengths and areasForImprovement, quote what the candidate "
                "actually said when possible. Do not fabricate praise."
            ),
        },
        {
            "role": "user",
            "content": f"Input:\n{json.dumps(input_payload, ensure_ascii=False)}",
        },
    ]


def first_json_object(raw_text: str) -> str:
    cleaned = raw_text.strip().replace("```json", "").replace("```", "").strip()
    start = cleaned.find("{")
    if start < 0:
        raise ValueError("Model response does not contain a JSON object.")

    depth = 0
    in_string = False
    escape = False

    for index in range(start, len(cleaned)):
        char = cleaned[index]

        if in_string:
            if escape:
                escape = False
            elif char == "\\":
                escape = True
            elif char == '"':
                in_string = False
            continue

        if char == '"':
            in_string = True
        elif char == "{":
            depth += 1
        elif char == "}":
            depth -= 1
            if depth == 0:
                return cleaned[start : index + 1]

    raise ValueError("Model response contains incomplete JSON.")


def extract_json(raw_text: str) -> dict[str, Any]:
    cleaned = raw_text.strip().replace("```json", "").replace("```", "").strip()

    try:
        return json.loads(cleaned)
    except json.JSONDecodeError:
        return json.loads(first_json_object(cleaned))


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


def clamp_score(value: Any) -> int:
    try:
        score = round(float(value))
    except (TypeError, ValueError):
        score = 0
    return max(0, min(100, score))


def normalize_string_list(value: Any, fallback: list[str]) -> list[str]:
    if isinstance(value, list):
        items = [str(item).strip() for item in value if str(item).strip()]
    elif isinstance(value, str) and value.strip():
        items = [value.strip()]
    else:
        items = []

    return items or fallback


def normalize_feedback(data: dict[str, Any]) -> GenerateFeedbackResponse:
    raw_category_scores = data.get("categoryScores", [])
    category_scores: list[FeedbackCategoryScore] = []

    if isinstance(raw_category_scores, dict):
        raw_category_scores = [
            {"name": name, "score": raw_category_scores.get(name), "comment": ""}
            for name in FEEDBACK_CATEGORY_NAMES
        ]

    if isinstance(raw_category_scores, list):
        by_name = {
            str(item.get("name")): item
            for item in raw_category_scores
            if isinstance(item, dict) and item.get("name")
        }
    else:
        by_name = {}

    for name in FEEDBACK_CATEGORY_NAMES:
        item = by_name.get(name, {})
        category_scores.append(
            FeedbackCategoryScore(
                name=name,
                score=clamp_score(item.get("score")),
                comment=str(item.get("comment") or "No detailed comment provided."),
            )
        )

    return GenerateFeedbackResponse(
        totalScore=clamp_score(data.get("totalScore")),
        categoryScores=category_scores,
        strengths=normalize_string_list(
            data.get("strengths"),
            ["Not enough evidence to identify clear strengths."],
        ),
        areasForImprovement=normalize_string_list(
            data.get("areasForImprovement"),
            ["Provide more complete answers during the interview."],
        ),
        finalAssessment=str(
            data.get("finalAssessment")
            or "There is not enough evidence to provide a detailed assessment."
        ),
    )


@lru_cache(maxsize=2)
def load_model(kind: Literal["question", "feedback"]):
    adapter = adapter_path(kind)
    if not Path(adapter).exists():
        raise RuntimeError(f"LoRA adapter path does not exist: {adapter}")

    tokenizer = AutoTokenizer.from_pretrained(adapter, trust_remote_code=False)
    quantization_config = None
    if load_in_4bit() and torch.cuda.is_available():
        quantization_config = BitsAndBytesConfig(load_in_4bit=True)

    model_kwargs = {
        "quantization_config": quantization_config,
        "device_map": "auto" if quantization_config else None,
        "trust_remote_code": False,
    }
    if quantization_config is None:
        model_kwargs["dtype"] = torch_dtype()

    base_model = AutoModelForCausalLM.from_pretrained(
        model_name(),
        **model_kwargs,
    )
    model = PeftModel.from_pretrained(
        base_model,
        adapter,
        is_trainable=False,
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
        "questionAdapterPath": question_adapter_path(),
        "feedbackAdapterPath": feedback_adapter_path(),
        "baseModel": model_name(),
        "cuda": torch.cuda.is_available(),
    }


@app.post("/generate-questions", response_model=GenerateQuestionsResponse)
async def generate_questions(payload: GenerateQuestionsRequest):
    try:
        tokenizer, model = load_model("question")
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
                max_new_tokens=max_new_tokens("question"),
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


@app.post("/generate-feedback", response_model=GenerateFeedbackResponse)
async def generate_feedback(payload: GenerateFeedbackRequest):
    try:
        tokenizer, model = load_model("feedback")
        messages = build_feedback_messages(payload)
        prompt = tokenizer.apply_chat_template(
            messages,
            tokenize=False,
            add_generation_prompt=True,
        )
        inputs = tokenizer(prompt, return_tensors="pt").to(model_device(model))

        with torch.inference_mode():
            output_ids = model.generate(
                **inputs,
                max_new_tokens=max_new_tokens("feedback"),
                do_sample=False,
                repetition_penalty=float(
                    os.getenv("LOCAL_FEEDBACK_MODEL_REPETITION_PENALTY", "1.05")
                ),
                pad_token_id=tokenizer.eos_token_id,
            )

        generated_ids = output_ids[0][inputs["input_ids"].shape[-1] :]
        raw_text = tokenizer.decode(generated_ids, skip_special_tokens=True)
        data = extract_json(raw_text)

        return normalize_feedback(data)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc
