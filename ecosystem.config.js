module.exports = {
  apps: [
    {
      name: 'backend',
      cwd: '/home/ubuntu/interview-prep-be',
      script: 'dist/src/main.js',
    },
    {
      name: 'vllm-server',
      cwd: '/home/ubuntu/interview-prep-be',
      script: '/home/ubuntu/interview-prep-be/.venv-model/bin/python3',
      args: 'model-server/vllm_server.py --model unsloth/qwen2.5-3b-instruct-bnb-4bit --enable-lora --lora-modules question-lora=/home/ubuntu/adapters/qwen_interview_questions_lora feedback-lora=/home/ubuntu/adapters/qwen_interview_feedback_lora --max-model-len 8192 --enforce-eager --attention-backend TRITON_ATTN --port 8000',
      interpreter: 'none',
      env: {
        VLLM_USE_FLASHINFER_SAMPLER: '0',
      },
    },
    {
      name: 'model-questions',
      cwd: '/home/ubuntu/interview-prep-be',
      script: '/home/ubuntu/interview-prep-be/.venv-model/bin/uvicorn',
      args: 'app:app --app-dir model-server --host 0.0.0.0 --port 8001',
      interpreter: 'none',
    },
    {
      name: 'model-feedback',
      cwd: '/home/ubuntu/interview-prep-be',
      script: '/home/ubuntu/interview-prep-be/.venv-model/bin/uvicorn',
      args: 'app:app --app-dir model-server --host 0.0.0.0 --port 8002',
      interpreter: 'none',
    },
  ],
};
