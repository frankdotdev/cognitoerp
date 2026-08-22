# 018 — Testing

## The non-negotiable test: tenant isolation
Every module that introduces a new tenant-scoped table ships with at least
one test in this shape before it can merge:

```python
async def test_school_a_cannot_see_school_b_students(db, school_a, school_b):
    student_a = await create_student(db, school_id=school_a.id, name="Amaka")
    set_current_tenant(school_b.id)
    result = await StudentRepository(db).paginate(page=1, page_size=25)
    assert student_a not in result.rows
```

This isn't optional coverage — it's the test suite's proof that the
architectural claim in 004 actually holds, not just in code review but in
an automated, repeatable check that runs on every PR.

## Test pyramid
- **Unit tests:** service-layer logic (permission resolution, identity code
  sequencing, fee calculation) — fast, no DB.
- **Integration tests:** repository + real Postgres (via a test database,
  reset per test via transaction rollback) — covers the tenant guard,
  optimistic locking, soft delete.
- **API tests:** FastAPI's TestClient against real routes, including auth —
  every endpoint has at minimum a "happy path" and a "wrong tenant/wrong
  permission returns 403/404, not data" test.
- **Frontend:** component tests (Vitest + React Testing Library) for shared
  components (DataTable, forms); Playwright for critical E2E flows (login →
  mark attendance → log out; parent views a child's results).

## Coverage bar
Not a percentage target — a rule: no module is considered "built" until its
tenant-isolation test, its permission-boundary tests, and its idempotency
test (where applicable — payments, imports, notifications) all exist and pass.

## Status
A real test suite exists: `tests/conftest.py` (Postgres fixtures with
transactional rollback per test), `tests/test_tenant_isolation.py` (the
tests that prove doc 004's core claim, including a test that a query with
no tenant context set fails loudly rather than returning unfiltered data),
`tests/test_permissions.py` (including a named regression test for the
exact Super Admin wildcard bug caught and fixed earlier, so that class of
bug can't silently return), and `tests/test_idempotency.py`. Writing the
idempotency tests directly caught two real transaction-safety bugs in the
Payments and Notifications services (a bare `db.rollback()` on a
duplicate-key conflict was rolling back the entire session transaction,
not just the failed insert — fixed with a SAVEPOINT via `begin_nested()`).

**These tests have never been executed.** No Postgres access has existed
in any session's build environment. Running them for the first time
against a real database (see doc 016's go-live runbook) is the single
highest-priority action before trusting this system with real school data
— higher priority than any remaining feature work.
