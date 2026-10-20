from typing import Annotated, Literal

from pydantic import AfterValidator, BaseModel, StringConstraints

def _capitalize(text: str) -> str:
    return text[:1].upper() + text[1:]


# Titles, steps and results are stored starting with a capital letter.
NonEmptyText = Annotated[
    str,
    StringConstraints(strip_whitespace=True, min_length=1, max_length=500),
    AfterValidator(_capitalize),
]

Status = Literal["todo", "in_progress", "done"]


class TaskCreate(BaseModel):
    title: NonEmptyText


class StepCreate(BaseModel):
    text: NonEmptyText


class ResultCreate(BaseModel):
    text: NonEmptyText


class StepOrder(BaseModel):
    step_ids: list[int]


class StepUpdate(BaseModel):
    done: bool


class Step(BaseModel):
    id: int
    task_id: int
    text: str
    position: int
    done: bool


class Result(BaseModel):
    id: int
    task_id: int
    text: str
    position: int


class Task(BaseModel):
    id: int
    title: str
    status: Status
    created_at: str
    completed_at: str | None = None
    steps: list[Step]
    results: list[Result] = []
