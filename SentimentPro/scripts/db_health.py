import sys
from pathlib import Path


ROOT_DIR = Path(__file__).resolve().parent.parent
if str(ROOT_DIR) not in sys.path:
    sys.path.insert(0, str(ROOT_DIR))

from app.database import Base, SessionLocal, engine
from app.models import BatchJob, Feedback, Prediction, User
from app.schema import ensure_schema


def main() -> None:
    Base.metadata.create_all(bind=engine)
    ensure_schema()

    with SessionLocal() as db:
        users = db.query(User).count()
        predictions = db.query(Prediction).count()
        batch_jobs = db.query(BatchJob).count()
        feedback = db.query(Feedback).count()
        bad_hashes = (
            db.query(User)
            .filter(~User.password_hash.startswith("$2"))
            .count()
        )

    print("database_connected=true")
    print(f"users={users}")
    print(f"predictions={predictions}")
    print(f"batch_jobs={batch_jobs}")
    print(f"feedback={feedback}")
    print(f"password_hashes_valid={bad_hashes == 0}")


if __name__ == "__main__":
    main()
