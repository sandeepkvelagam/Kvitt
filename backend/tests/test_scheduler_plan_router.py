"""Router registration tests for scheduler plan API."""

import sys
import os
import ast

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))


class TestSchedulerPlanRouter:
    def test_router_import(self):
        from routers.scheduler_plan import router

        assert router is not None

    def test_scheduler_plan_path(self):
        from routers.scheduler_plan import router

        paths = [r.path for r in router.routes]
        assert "/api/scheduler/plan" in paths

    def test_syntax(self):
        path = os.path.join(os.path.dirname(__file__), "..", "routers", "scheduler_plan.py")
        with open(path, encoding="utf-8") as f:
            ast.parse(f.read())

    def test_planner_module_syntax(self):
        path = os.path.join(os.path.dirname(__file__), "..", "scheduling_planner.py")
        with open(path, encoding="utf-8") as f:
            ast.parse(f.read())
