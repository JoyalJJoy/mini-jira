"""
Comprehensive tests for sprint management endpoints.

Covers:
  - Create sprint
  - List sprints for a project
  - Update sprint (name, goal)
  - Start sprint (active status + start_date)
  - Complete sprint (completed status + end_date)
  - Add task to sprint
  - Remove task from sprint
  - Delete sprint (clears sprint_id on tasks)
  - Edge cases: non-member access, invalid status transitions, etc.
"""

import pytest
import pytest_asyncio
from httpx import AsyncClient, ASGITransport
from datetime import datetime, timezone
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession

# ── Force in-memory SQLite for tests BEFORE importing app modules ──
from app.config import settings
settings.database_url = "sqlite+aiosqlite://"

from app.main import app
from app.db import get_db
from app.deps import get_current_user
from app.models import Base, User, Project, ProjectMember, Task


# ── Fixtures ─────────────────────────────────────────────────────────

@pytest_asyncio.fixture
async def db_session():
    """Create a fresh in-memory database with seed data for each test."""
    engine = create_async_engine(settings.database_url)
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    session_factory = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
    async with session_factory() as session:
        # Seed: test user
        user = User(
            id="test-user-1",
            email="test@test.com",
            hashed_password="",
            display_name="Test User",
        )
        session.add(user)

        # Seed: test project (user is owner)
        project = Project(
            id="test-project-1",
            name="Test Project",
            owner_id="test-user-1",
        )
        session.add(project)
        pm = ProjectMember(project_id="test-project-1", user_id="test-user-1", role="owner")
        session.add(pm)

        # Seed: another project (user is NOT a member — for auth tests)
        project2 = Project(
            id="test-project-2",
            name="Other Project (no membership)",
            owner_id="other-user",
        )
        session.add(project2)

        # Seed: a task to use with add/remove-to-sprint tests
        task = Task(
            id="test-task-1",
            title="Test Task",
            status="todo",
            priority="p2",
            owner_id="test-user-1",
            project_id="test-project-1",
        )
        session.add(task)

        await session.commit()
        yield session

    await engine.dispose()


@pytest_asyncio.fixture
async def client(db_session):
    """HTTX async client with dependency overrides."""
    async def override_get_db():
        yield db_session

    async def override_get_current_user():
        return "test-user-1"

    app.dependency_overrides[get_db] = override_get_db
    app.dependency_overrides[get_current_user] = override_get_current_user

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac

    app.dependency_overrides.clear()


# ── Helper ──────────────────────────────────────────────────────────

async def create_sprint(client, name="Sprint 1", goal="Test goal", project_id="test-project-1"):
    """Helper to create a sprint and return it."""
    resp = await client.post("/api/v1/sprints/", json={
        "project_id": project_id,
        "name": name,
        "goal": goal,
    })
    assert resp.status_code == 200, f"Create sprint failed: {resp.text}"
    return resp.json()


# ── Tests ────────────────────────────────────────────────────────────

class TestCreateSprint:
    async def test_create_basic(self, client):
        """Create a sprint with name and goal."""
        data = await create_sprint(client)
        assert data["name"] == "Sprint 1"
        assert data["goal"] == "Test goal"
        assert data["status"] == "planned"
        assert data["project_id"] == "test-project-1"
        assert data["start_date"] is None
        assert data["end_date"] is None
        assert "id" in data
        assert "created_at" in data

    async def test_create_without_goal(self, client):
        """Create a sprint without an optional goal."""
        resp = await client.post("/api/v1/sprints/", json={
            "project_id": "test-project-1",
            "name": "Sprint No Goal",
        })
        assert resp.status_code == 200
        data = resp.json()
        assert data["name"] == "Sprint No Goal"
        assert data["goal"] is None

    async def test_create_non_member_forbidden(self, client):
        """Non-project-members cannot create sprints."""
        resp = await client.post("/api/v1/sprints/", json={
            "project_id": "test-project-2",  # user is not a member
            "name": "Sneaky Sprint",
        })
        assert resp.status_code == 403

    async def test_create_invalid_project(self, client):
        """Non-existent project returns 403 (treated same as non-member)."""
        resp = await client.post("/api/v1/sprints/", json={
            "project_id": "non-existent",
            "name": "Ghost Sprint",
        })
        assert resp.status_code == 403

    async def test_create_empty_name_fails(self, client):
        """Empty name should be rejected by Pydantic validation."""
        resp = await client.post("/api/v1/sprints/", json={
            "project_id": "test-project-1",
            "name": "",
        })
        assert resp.status_code == 422


class TestListSprints:
    async def test_list_empty(self, client):
        """Project with no sprints returns empty list."""
        resp = await client.get("/api/v1/sprints/project/test-project-1")
        assert resp.status_code == 200
        assert resp.json() == []

    async def test_list_multiple(self, client):
        """Listing returns all sprints for the project."""
        s1 = await create_sprint(client, name="Sprint A")
        s2 = await create_sprint(client, name="Sprint B")
        resp = await client.get("/api/v1/sprints/project/test-project-1")
        assert resp.status_code == 200
        data = resp.json()
        assert len(data) == 2
        names = [s["name"] for s in data]
        assert "Sprint A" in names
        assert "Sprint B" in names

    async def test_list_non_member_forbidden(self, client):
        """Non-members cannot list sprints."""
        resp = await client.get("/api/v1/sprints/project/test-project-2")
        assert resp.status_code == 403

    async def test_list_ordering(self, client):
        """Sprints are returned newest-first (created_at DESC)."""
        s1 = await create_sprint(client, name="First")
        s2 = await create_sprint(client, name="Second")
        resp = await client.get("/api/v1/sprints/project/test-project-1")
        data = resp.json()
        # Second was created after First, so should appear first
        assert data[0]["name"] == "Second"
        assert data[1]["name"] == "First"


class TestUpdateSprint:
    async def test_update_name(self, client):
        """Update sprint name."""
        sprint = await create_sprint(client)
        resp = await client.patch(f"/api/v1/sprints/{sprint['id']}", json={
            "name": "Updated Sprint Name",
        })
        assert resp.status_code == 200
        assert resp.json()["name"] == "Updated Sprint Name"
        # Goal should remain unchanged
        assert resp.json()["goal"] == "Test goal"

    async def test_update_goal(self, client):
        """Update sprint goal."""
        sprint = await create_sprint(client)
        resp = await client.patch(f"/api/v1/sprints/{sprint['id']}", json={
            "goal": "New goal",
        })
        assert resp.status_code == 200
        assert resp.json()["goal"] == "New goal"
        assert resp.json()["name"] == "Sprint 1"

    async def test_update_nonexistent(self, client):
        """Updating a non-existent sprint returns 404."""
        resp = await client.patch("/api/v1/sprints/non-existent", json={"name": "Nope"})
        assert resp.status_code == 404

    async def test_update_empty_payload(self, client):
        """Empty update payload is a no-op (success)."""
        sprint = await create_sprint(client)
        resp = await client.patch(f"/api/v1/sprints/{sprint['id']}", json={})
        assert resp.status_code == 200
        assert resp.json()["name"] == sprint["name"]


class TestStartSprint:
    async def test_start_planned_sprint(self, client):
        """Starting a planned sprint sets status=active and start_date."""
        sprint = await create_sprint(client)
        assert sprint["status"] == "planned"

        resp = await client.post(f"/api/v1/sprints/{sprint['id']}/start")
        assert resp.status_code == 200
        data = resp.json()
        assert data["status"] == "active"
        assert data["start_date"] is not None  # date was set

    async def test_start_already_active_fails(self, client):
        """Starting an already active sprint returns 400."""
        sprint = await create_sprint(client)
        await client.post(f"/api/v1/sprints/{sprint['id']}/start")
        resp = await client.post(f"/api/v1/sprints/{sprint['id']}/start")
        assert resp.status_code == 400
        assert "planned" in resp.text.lower()

    async def test_start_completed_sprint_fails(self, client):
        """Starting a completed sprint returns 400."""
        sprint = await create_sprint(client)
        await client.post(f"/api/v1/sprints/{sprint['id']}/start")
        await client.post(f"/api/v1/sprints/{sprint['id']}/complete")
        resp = await client.post(f"/api/v1/sprints/{sprint['id']}/start")
        assert resp.status_code == 400

    async def test_start_nonexistent(self, client):
        """Starting a non-existent sprint returns 404."""
        resp = await client.post("/api/v1/sprints/non-existent/start")
        assert resp.status_code == 404


class TestCompleteSprint:
    async def test_complete_active_sprint(self, client):
        """Completing an active sprint sets status=completed and end_date."""
        sprint = await create_sprint(client)
        await client.post(f"/api/v1/sprints/{sprint['id']}/start")
        resp = await client.post(f"/api/v1/sprints/{sprint['id']}/complete")
        assert resp.status_code == 200
        data = resp.json()
        assert data["status"] == "completed"
        assert data["end_date"] is not None

    async def test_complete_planned_sprint_fails(self, client):
        """Completing a planned sprint (not started) returns 400."""
        sprint = await create_sprint(client)
        resp = await client.post(f"/api/v1/sprints/{sprint['id']}/complete")
        assert resp.status_code == 400
        assert "active" in resp.text.lower()

    async def test_complete_already_completed_fails(self, client):
        """Completing an already completed sprint returns 400."""
        sprint = await create_sprint(client)
        await client.post(f"/api/v1/sprints/{sprint['id']}/start")
        await client.post(f"/api/v1/sprints/{sprint['id']}/complete")
        resp = await client.post(f"/api/v1/sprints/{sprint['id']}/complete")
        assert resp.status_code == 400

    async def test_complete_nonexistent(self, client):
        """Completing a non-existent sprint returns 404."""
        resp = await client.post("/api/v1/sprints/non-existent/complete")
        assert resp.status_code == 404


class TestAddTaskToSprint:
    async def test_add_task(self, client):
        """Add a task to a sprint sets task.sprint_id."""
        sprint = await create_sprint(client)
        resp = await client.post(f"/api/v1/sprints/{sprint['id']}/tasks/test-task-1")
        assert resp.status_code == 200
        assert resp.json()["ok"] is True

        # Verify the task's sprint_id was set
        from app.models import Task
        from sqlalchemy import select
        async for session in app.dependency_overrides[get_db]():
            result = await session.execute(select(Task).where(Task.id == "test-task-1"))
            task = result.scalar_one_or_none()
            assert task is not None
            assert task.sprint_id == sprint["id"]

    async def test_add_to_nonexistent_sprint(self, client):
        """Adding a task to a non-existent sprint returns 404."""
        resp = await client.post("/api/v1/sprints/non-existent/tasks/test-task-1")
        assert resp.status_code == 404

    async def test_add_nonexistent_task(self, client):
        """Adding a non-existent task returns 404."""
        sprint = await create_sprint(client)
        resp = await client.post(f"/api/v1/sprints/{sprint['id']}/tasks/non-existent")
        assert resp.status_code == 404

    async def test_add_task_twice(self, client):
        """Adding a task twice is idempotent (sprint_id stays set)."""
        sprint = await create_sprint(client)
        resp1 = await client.post(f"/api/v1/sprints/{sprint['id']}/tasks/test-task-1")
        assert resp1.status_code == 200
        resp2 = await client.post(f"/api/v1/sprints/{sprint['id']}/tasks/test-task-1")
        assert resp2.status_code == 200

        from app.models import Task
        from sqlalchemy import select
        async for session in app.dependency_overrides[get_db]():
            result = await session.execute(select(Task).where(Task.id == "test-task-1"))
            task = result.scalar_one_or_none()
            assert task.sprint_id == sprint["id"]


class TestRemoveTaskFromSprint:
    async def test_remove_task(self, client):
        """Remove a task from a sprint clears sprint_id."""
        sprint = await create_sprint(client)
        await client.post(f"/api/v1/sprints/{sprint['id']}/tasks/test-task-1")

        resp = await client.delete(f"/api/v1/sprints/{sprint['id']}/tasks/test-task-1")
        assert resp.status_code == 200
        assert resp.json()["ok"] is True

        from app.models import Task
        from sqlalchemy import select
        async for session in app.dependency_overrides[get_db]():
            result = await session.execute(select(Task).where(Task.id == "test-task-1"))
            task = result.scalar_one_or_none()
            assert task.sprint_id is None

    async def test_remove_not_in_sprint(self, client):
        """Removing a task that is not in the sprint returns 404."""
        sprint = await create_sprint(client)
        resp = await client.delete(f"/api/v1/sprints/{sprint['id']}/tasks/test-task-1")
        assert resp.status_code == 404
        assert "not found in this sprint" in resp.text.lower()

    async def test_remove_from_nonexistent_sprint(self, client):
        """Removing from a non-existent sprint returns 404."""
        resp = await client.delete("/api/v1/sprints/non-existent/tasks/test-task-1")
        assert resp.status_code == 404


class TestDeleteSprint:
    async def test_delete_planned_sprint(self, client):
        """Delete a planned sprint."""
        sprint = await create_sprint(client)
        resp = await client.delete(f"/api/v1/sprints/{sprint['id']}")
        assert resp.status_code == 200
        assert resp.json()["ok"] is True

        # Verify it's gone
        resp2 = await client.get("/api/v1/sprints/project/test-project-1")
        assert len(resp2.json()) == 0

    async def test_delete_active_sprint(self, client):
        """Delete an active sprint."""
        sprint = await create_sprint(client)
        await client.post(f"/api/v1/sprints/{sprint['id']}/start")
        resp = await client.delete(f"/api/v1/sprints/{sprint['id']}")
        assert resp.status_code == 200

    async def test_delete_completed_sprint(self, client):
        """Delete a completed sprint."""
        sprint = await create_sprint(client)
        await client.post(f"/api/v1/sprints/{sprint['id']}/start")
        await client.post(f"/api/v1/sprints/{sprint['id']}/complete")
        resp = await client.delete(f"/api/v1/sprints/{sprint['id']}")
        assert resp.status_code == 200

    async def test_delete_clears_task_sprint_id(self, client):
        """Deleting a sprint clears sprint_id on all associated tasks."""
        sprint = await create_sprint(client)
        await client.post(f"/api/v1/sprints/{sprint['id']}/tasks/test-task-1")

        # Verify task is assigned
        from app.models import Task
        from sqlalchemy import select
        async for session in app.dependency_overrides[get_db]():
            result = await session.execute(select(Task).where(Task.id == "test-task-1"))
            assert result.scalar_one_or_none().sprint_id == sprint["id"]

        # Delete sprint
        await client.delete(f"/api/v1/sprints/{sprint['id']}")

        # Verify task sprint_id was cleared
        async for session in app.dependency_overrides[get_db]():
            result = await session.execute(select(Task).where(Task.id == "test-task-1"))
            assert result.scalar_one_or_none().sprint_id is None

    async def test_delete_nonexistent(self, client):
        """Delete a non-existent sprint returns 404."""
        resp = await client.delete("/api/v1/sprints/non-existent")
        assert resp.status_code == 404


class TestWorkflowIntegration:
    """End-to-end sprint lifecycle test."""

    async def test_full_sprint_lifecycle(self, client):
        """Create → start → complete → delete."""
        # Create
        sprint = await create_sprint(client, name="Sprint X")
        sprint_id = sprint["id"]
        assert sprint["status"] == "planned"

        # Add task
        resp = await client.post(f"/api/v1/sprints/{sprint_id}/tasks/test-task-1")
        assert resp.status_code == 200

        # Start
        resp = await client.post(f"/api/v1/sprints/{sprint_id}/start")
        assert resp.status_code == 200
        assert resp.json()["status"] == "active"

        # A second sprint cannot be started while another is active
        # (the API does NOT enforce this — check if that's intended)

        # Complete
        resp = await client.post(f"/api/v1/sprints/{sprint_id}/complete")
        assert resp.status_code == 200
        assert resp.json()["status"] == "completed"

        # Remove task
        resp = await client.delete(f"/api/v1/sprints/{sprint_id}/tasks/test-task-1")
        assert resp.status_code == 200

        # Delete
        resp = await client.delete(f"/api/v1/sprints/{sprint_id}")
        assert resp.status_code == 200

    async def test_multiple_active_sprints_allowed(self, client):
        """The API currently allows multiple active sprints (no constraint)."""
        s1 = await create_sprint(client, name="Sprint A")
        s2 = await create_sprint(client, name="Sprint B")

        await client.post(f"/api/v1/sprints/{s1['id']}/start")
        resp = await client.post(f"/api/v1/sprints/{s2['id']}/start")
        assert resp.status_code == 200  # allowed — no unique constraint on active

        resp = await client.get("/api/v1/sprints/project/test-project-1")
        active = [s for s in resp.json() if s["status"] == "active"]
        assert len(active) == 2

    async def test_sprint_scoped_to_project(self, client):
        """Sprints from one project do not appear in another."""
        # Create a second project where user IS a member
        from app.models import Project, ProjectMember
        from sqlalchemy import select
        async for session in app.dependency_overrides[get_db]():
            p3 = Project(id="test-project-3", name="Project Three", owner_id="test-user-1")
            session.add(p3)
            pm3 = ProjectMember(project_id="test-project-3", user_id="test-user-1", role="owner")
            session.add(pm3)
            await session.commit()

        s1 = await create_sprint(client, name="P1 Sprint", project_id="test-project-1")
        s2 = await create_sprint(client, name="P3 Sprint", project_id="test-project-3")

        resp1 = await client.get("/api/v1/sprints/project/test-project-1")
        assert len(resp1.json()) == 1
        assert resp1.json()[0]["name"] == "P1 Sprint"

        resp2 = await client.get("/api/v1/sprints/project/test-project-3")
        assert len(resp2.json()) == 1
        assert resp2.json()[0]["name"] == "P3 Sprint"


class TestAuthorization:
    """Ensure non-members cannot access sprint endpoints."""

    async def test_non_member_all_endpoints(self, client, db_session):
        """Test all endpoints return 403 for non-members."""
        # Override user to be a non-member
        async def override_other_user():
            return "some-other-user"

        app.dependency_overrides[get_current_user] = override_other_user

        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as ac:
            # List
            resp = await ac.get("/api/v1/sprints/project/test-project-1")
            assert resp.status_code == 403

            # Create
            resp = await ac.post("/api/v1/sprints/", json={
                "project_id": "test-project-1",
                "name": "Nope",
            })
            assert resp.status_code == 403

            # A sprint must exist to test update/start/complete/delete/add/remove
            # Create one with the valid user first, then try operations as other user
        app.dependency_overrides[get_current_user] = lambda: "test-user-1"
        async with AsyncClient(transport=transport, base_url="http://test") as ac:
            sprint = (await ac.post("/api/v1/sprints/", json={
                "project_id": "test-project-1",
                "name": "Test Sprint",
            })).json()

        app.dependency_overrides[get_current_user] = override_other_user
        async with AsyncClient(transport=transport, base_url="http://test") as ac:
            # Update
            resp = await ac.patch(f"/api/v1/sprints/{sprint['id']}", json={"name": "Hacked"})
            assert resp.status_code == 404  # _get_sprint returns None

            # Start
            resp = await ac.post(f"/api/v1/sprints/{sprint['id']}/start")
            assert resp.status_code == 404

            # Complete
            resp = await ac.post(f"/api/v1/sprints/{sprint['id']}/complete")
            assert resp.status_code == 404

            # Delete
            resp = await ac.delete(f"/api/v1/sprints/{sprint['id']}")
            assert resp.status_code == 404

            # Add task
            resp = await ac.post(f"/api/v1/sprints/{sprint['id']}/tasks/test-task-1")
            assert resp.status_code == 404

            # Remove task
            resp = await ac.delete(f"/api/v1/sprints/{sprint['id']}/tasks/test-task-1")
            assert resp.status_code == 404

        # Cleanup
        app.dependency_overrides[get_current_user] = lambda: "test-user-1"
