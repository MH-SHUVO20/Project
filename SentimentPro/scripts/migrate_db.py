import sys
from pathlib import Path


ROOT_DIR = Path(__file__).resolve().parent.parent
if str(ROOT_DIR) not in sys.path:
    sys.path.insert(0, str(ROOT_DIR))

from app.database import Base, engine
from app.schema import ensure_schema


def main() -> None:
    Base.metadata.create_all(bind=engine)
    ensure_schema()
    print("database_schema_ready=true")


if __name__ == "__main__":
    main()
