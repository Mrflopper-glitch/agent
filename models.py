import uuid
from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum

class TaskStatus(str, Enum):
    PENDING = "pending"
    IN_PROGRESS = "in_progress"
    COMPLETED = "completed"
    FAILED = "failed"

class CommandType(str, Enum):
    SHELL = "shell"
    APP = "app"
    FILE = "file"
    UNKNOWN = "unknown"

@dataclass
class Task:
    command_type: CommandType
    payload: str
    id: str = field(default_factory=lambda: str(uuid.uuid4()))
    status: TaskStatus = TaskStatus.PENDING
    created_at: datetime = field(default_factory=datetime.now)
    updated_at: datetime = field(default_factory=datetime.now)
    result: str = ""
    error: str = ""
