import os
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent
DATA_DIR = BASE_DIR / "data"
LOG_DIR = BASE_DIR / "logs"

DATA_DIR.mkdir(parents=True, exist_ok=True)
LOG_DIR.mkdir(parents=True, exist_ok=True)

QUEUE_FILE = DATA_DIR / "queue.json"
MEMORY_FILE = DATA_DIR / "memory.json"
HEARTBEAT_FILE = DATA_DIR / "heartbeat.json"
SEEN_MESSAGES_FILE = DATA_DIR / "seen_messages.json"

POLL_INTERVAL = 2
WORKER_INTERVAL = 1

YOUR_NUMBER = os.getenv("YOUR_NUMBER", "")
YOUR_NAME = os.getenv("YOUR_NAME", "Suhaan")
SELF_CHAT_NAME = "You"
BROWSER_PROFILE_DIR = DATA_DIR / "browser_profile"

ALLOWED_APPS = {
    "safari": "Safari",
    "chrome": "Google Chrome",
    "terminal": "Terminal",
    "finder": "Finder",
    "spotify": "Spotify",
}

SAFE_SHELL_COMMANDS = {
    "pwd", "ls", "whoami", "date", "echo"
}
