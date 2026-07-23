# Import all models so SQLAlchemy discovers them for create_all
from app.models.task import Task  # noqa: F401
from app.models.project import Project  # noqa: F401
from app.models.comment import Comment  # noqa: F401
