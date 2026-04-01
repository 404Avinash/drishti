"""API request/response schemas with validation and sanitization."""

from __future__ import annotations

import re

from pydantic import BaseModel, ConfigDict, Field, field_validator

_SANITIZE_RE = re.compile(r"[^a-zA-Z0-9_\-\s\.:,@/]")


def sanitize_text(value: str) -> str:
    cleaned = _SANITIZE_RE.sub("", value).strip()
    return cleaned


class LoginRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    username: str = Field(min_length=3, max_length=120)
    password: str = Field(min_length=8, max_length=256)

    @field_validator("username")
    @classmethod
    def _sanitize_username(cls, value: str) -> str:
        return sanitize_text(value)


class RegisterRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    username: str = Field(min_length=3, max_length=120)
    password: str = Field(min_length=10, max_length=256)
    role: str = Field(default="viewer", min_length=4, max_length=32)

    @field_validator("username", "role")
    @classmethod
    def _sanitize_fields(cls, value: str) -> str:
        return sanitize_text(value)


class BayesianInferRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    delay_minutes: int = Field(ge=0, le=600)
    time_of_day: str = Field(min_length=3, max_length=16)
    signal_cycle_time: float = Field(ge=0.1, le=60.0)
    maintenance_active: bool
    centrality_rank: int = Field(ge=0, le=100)
    traffic_density: float = Field(ge=0.0, le=1.0)

    @field_validator("time_of_day")
    @classmethod
    def _validate_time_of_day(cls, value: str) -> str:
        cleaned = sanitize_text(value).upper()
        if cleaned not in {"DAY", "NIGHT"}:
            raise ValueError("time_of_day must be DAY or NIGHT")
        return cleaned


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    username: str
    role: str


class TrainIsolationRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    rows: list[dict]


class AnomalyScoreRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    train_id: str = Field(min_length=1, max_length=120)
    features: dict
    all_trains: list[dict] | None = None

    @field_validator("train_id")
    @classmethod
    def _sanitize_train_id(cls, value: str) -> str:
        return sanitize_text(value)


class ForecastRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    series: list[float] = Field(min_length=8, max_length=10000)
    horizon: int = Field(ge=1, le=256)
    method: str = Field(pattern="^(prophet|lstm)$")


class ExplainRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    model_type: str = Field(min_length=2, max_length=80)
    feature_names: list[str] = Field(min_length=1, max_length=256)
    train_matrix: list[list[float]] = Field(min_length=2, max_length=5000)
    row: list[float]


class DriftObserveRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    features: dict[str, float]
    prediction: float
