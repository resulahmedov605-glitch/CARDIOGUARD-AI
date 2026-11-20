from typing import Annotated, Literal
from pydantic import BaseModel, Field
from app.schemas import StrictParameters

Number = Annotated[int, Field(strict=True, ge=-999, le=999)]
Name = Annotated[str, Field(pattern=r'^[A-Za-z0-9_-]{1,12}$')]
AlgorithmId = Literal['array', 'linked-list', 'stack', 'queue', 'circular-queue', 'hash-table',
                      'binary-tree', 'graph', 'priority-queue', 'bubble-sort', 'merge-sort',
                      'binary-search', 'bfs', 'dfs', 'dijkstra', 'sliding-window']


class Edge(StrictParameters):
    source: Name
    target: Name
    weight: float = Field(default=1, ge=-999, le=999)


class Operation(StrictParameters):
    action: str = Field(min_length=1, max_length=20)
    value: Number | None = None
    index: int | None = Field(default=None, ge=0, le=48, strict=True)
    key: str | None = Field(default=None, min_length=1, max_length=20)
    priority: float | None = Field(default=None, ge=-999, le=999)
    node: Name | None = None
    source: Name | None = None
    target: Name | None = None
    weight: float = Field(default=1, ge=-999, le=999)


class LabRequest(StrictParameters):
    algorithm: AlgorithmId
    values: list[Number] = Field(default_factory=list, max_length=24)
    target: Number | None = None
    window_size: int = Field(default=3, ge=1, le=24, strict=True)
    nodes: list[Name] = Field(default_factory=list, max_length=12)
    edges: list[Edge] = Field(default_factory=list, max_length=32)
    start_node: Name | None = None
    directed: bool = Field(default=False, strict=True)
    capacity: int = Field(default=8, ge=1, le=16, strict=True)
    operations: list[Operation] = Field(default_factory=list, max_length=24)
    compare: bool = Field(default=False, strict=True)


class VisualNode(BaseModel):
    id: str
    label: str
    x: float | None = None
    depth: int | None = None


class VisualEdge(BaseModel):
    source: str
    target: str
    weight: float | None = None


class Entry(BaseModel):
    key: str
    value: int


class State(BaseModel):
    values: list[int] = Field(default_factory=list)
    nodes: list[VisualNode] = Field(default_factory=list)
    edges: list[VisualEdge] = Field(default_factory=list)
    directed: bool = False
    slots: list[int | None] = Field(default_factory=list)
    head: int | None = None
    tail: int | None = None
    buckets: list[list[Entry]] = Field(default_factory=list)
    priorities: list[float] = Field(default_factory=list)


class Step(BaseModel):
    line: int
    message: str
    state: State
    active: list[int] = Field(default_factory=list)
    completed: list[int] = Field(default_factory=list)
    range: list[int] | None = None
    current: str | None = None
    visited: list[str] = Field(default_factory=list)
    frontier: list[str] = Field(default_factory=list)
    distances: dict[str, float | None] = Field(default_factory=dict)
    path_edges: list[VisualEdge] = Field(default_factory=list)
    error: bool = False


class Run(BaseModel):
    algorithm: AlgorithmId
    steps: list[Step]
    result: dict
    metrics: dict[str, int]


class Execution(BaseModel):
    runs: list[Run]
    step_count: int


class OperationInfo(BaseModel):
    action: str
    fields: list[str]
    time: str


class AlgorithmInfo(BaseModel):
    id: AlgorithmId
    name: str
    category: Literal['Data structures', 'Sorting', 'Searching', 'Graphs', 'Window algorithms']
    visual: str
    description: str
    how: str
    input: str
    output: str
    time: str
    space: str
    advantages: str
    limitations: str
    use_case: str
    pseudocode: list[str]
    operations: list[OperationInfo]
    example: LabRequest
