import os
import sys

# Ensure backend directory is on sys.path so 'app' and 'models' can be imported
current_dir = os.path.dirname(os.path.abspath(__file__))
project_root = os.path.dirname(current_dir)
backend_dir = os.path.join(project_root, "backend")

if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)

# Suppress static language server warning; backend is added to sys.path above
from app.main import app  # type: ignore[import-not-found]
