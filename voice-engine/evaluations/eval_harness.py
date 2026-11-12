"""
TRIVAANA AI: Voice & Multilingual Agent Regression Evaluation Harness
Delegates to shared backend/services/eval_service.py so API and CLI evaluations cannot drift.
"""

from services.eval_service import DEFAULT_EVAL_CASES, run_regression_suite

__all__ = ["DEFAULT_EVAL_CASES", "run_regression_suite"]
