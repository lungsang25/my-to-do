from typing import Annotated, Literal

from pydantic import AfterValidator, BaseModel, StringConstraints

def _capitalize(text: str) -> str:
    return text[:1].upper() + text[1:]


# Titles, steps and results are stored starting with a capital letter.
NonEmptyText = Annotated[
    str,
    StringConstraints(strip_whitespace=True, min_length=1, max_length=2000),
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
    done: bool | None = None
    text: NonEmptyText | None = None


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


# "<n><unit>": 1-999 days (d), weeks (w), months (m) or years (y), e.g. "1d", "2w", "1m".
DurationKey = Annotated[str, StringConstraints(pattern=r"^[1-9][0-9]{0,2}[dwmy]$")]
LocalDate = Annotated[str, StringConstraints(pattern=r"^[0-9]{4}-[0-9]{2}-[0-9]{2}$")]


class DurationSet(BaseModel):
    key: DurationKey
    anchor: LocalDate  # the user's local date today; only used the first time this key is chosen


class DurationInfo(BaseModel):
    key: str
    anchor: str


class DurationState(BaseModel):
    active: str
    durations: list[DurationInfo]


class Task(BaseModel):
    id: int
    title: str
    status: Status
    created_at: str
    completed_at: str | None = None
    duration: str = "1d"
    steps: list[Step]
    results: list[Result] = []
