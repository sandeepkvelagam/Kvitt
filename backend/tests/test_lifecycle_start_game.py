"""Unit tests for start_game initial buy-in credits (scheduled → active)."""

import asyncio
import os
import sys
from unittest.mock import AsyncMock, patch

import pytest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

# noqa: E402 — path must be set before imports
from dependencies import User  # type: ignore


@pytest.fixture
def host_user():
    return User(
        user_id="host_u1",
        email="h@example.com",
        name="Host",
    )


def test_start_game_credits_all_rsvp_yes_with_zero_balances(host_user):
    """Starting a scheduled game credits each seated player with one buy-in and chips."""
    game_id = "game_test_01"
    game_row = {
        "game_id": game_id,
        "group_id": "grp_1",
        "host_id": host_user.user_id,
        "status": "scheduled",
        "buy_in_amount": 20.0,
        "chips_per_buy_in": 20,
        "chip_value": 1.0,
    }
    players_yes = [
        {"user_id": "host_u1", "total_chips": 0, "total_buy_in": 0},
        {"user_id": "p2", "total_chips": 0, "total_buy_in": 0},
    ]

    increment_calls = []
    txn_rows = []
    chip_dist = []

    async def fake_get_game_night(gid):
        assert gid == game_id
        return dict(game_row)

    async def fake_update_game_night(gid, data, conn=None):
        assert gid == game_id
        assert data.get("status") == "active"

    async def fake_count_rsvp(gid, status):
        assert gid == game_id and status == "yes"
        return 2

    async def fake_find_rsvp(gid, status, limit=100):
        assert gid == game_id and status == "yes"
        return list(players_yes)

    async def fake_increment_fields(gid, uid, inc):
        increment_calls.append((gid, uid, dict(inc)))
        return 1

    async def fake_insert_transaction(data, conn=None):
        txn_rows.append(dict(data))

    async def fake_increment_game_field(gid, field, amount, conn=None):
        chip_dist.append((gid, field, amount))

    async def fake_thread_broadcast(gid, msg):
        pass

    async def _run():
        from routers.games import lifecycle as lc

        with patch.object(lc.queries, "get_game_night", side_effect=fake_get_game_night):
            with patch.object(lc.queries, "update_game_night", side_effect=fake_update_game_night):
                with patch.object(lc.queries, "count_players_by_game_rsvp", side_effect=fake_count_rsvp):
                    with patch.object(lc.queries, "find_players_by_game_rsvp", side_effect=fake_find_rsvp):
                        with patch.object(lc.queries, "increment_player_fields", side_effect=fake_increment_fields):
                            with patch.object(lc.queries, "insert_transaction", side_effect=fake_insert_transaction):
                                with patch.object(lc.queries, "increment_game_night_field", side_effect=fake_increment_game_field):
                                    with patch(
                                        "routers.games.lifecycle.send_push_to_users",
                                        new=AsyncMock(),
                                    ):
                                        with patch(
                                            "routers.games.thread_utils.insert_game_thread_and_broadcast",
                                            new=AsyncMock(side_effect=fake_thread_broadcast),
                                        ):
                                            await lc.start_game(game_id, host_user)

    asyncio.run(_run())

    assert len(increment_calls) == 2
    for uid in ("host_u1", "p2"):
        match = [c for c in increment_calls if c[1] == uid]
        assert len(match) == 1
        assert match[0][2]["total_buy_in"] == pytest.approx(20.0)
        assert match[0][2]["total_chips"] == 20
        assert match[0][2]["buy_in_count"] == 1

    assert len(txn_rows) == 2
    assert all(t["type"] == "buy_in" for t in txn_rows)
    assert all(t.get("notes") == "Initial buy-in (game start)" for t in txn_rows)
    assert {t["user_id"] for t in txn_rows} == {"host_u1", "p2"}

    assert len(chip_dist) == 2
    assert all(f == "total_chips_distributed" and a == 20 for _, f, a in chip_dist)


def test_start_game_skips_players_already_credited(host_user):
    """Players with non-zero chips or buy-in are not double-credited."""
    game_id = "game_test_02"
    game_row = {
        "game_id": game_id,
        "group_id": "grp_1",
        "host_id": host_user.user_id,
        "status": "scheduled",
        "buy_in_amount": 20.0,
        "chips_per_buy_in": 20,
        "chip_value": 1.0,
    }
    players_yes = [
        {"user_id": "host_u1", "total_chips": 0, "total_buy_in": 0},
        {"user_id": "p2", "total_chips": 20, "total_buy_in": 20.0},
    ]

    increment_calls = []

    async def fake_get_game_night(gid):
        return dict(game_row)

    async def fake_update_game_night(gid, data, conn=None):
        pass

    async def fake_count_rsvp(gid, status):
        return 2

    async def fake_find_rsvp(gid, status, limit=100):
        return list(players_yes)

    async def fake_increment_fields(gid, uid, inc):
        increment_calls.append((gid, uid, inc))
        return 1

    async def _run():
        from routers.games import lifecycle as lc

        with patch.object(lc.queries, "get_game_night", side_effect=fake_get_game_night):
            with patch.object(lc.queries, "update_game_night", side_effect=fake_update_game_night):
                with patch.object(lc.queries, "count_players_by_game_rsvp", side_effect=fake_count_rsvp):
                    with patch.object(lc.queries, "find_players_by_game_rsvp", side_effect=fake_find_rsvp):
                        with patch.object(lc.queries, "increment_player_fields", side_effect=fake_increment_fields):
                            with patch.object(lc.queries, "insert_transaction", new=AsyncMock()):
                                with patch.object(lc.queries, "increment_game_night_field", new=AsyncMock()):
                                    with patch("routers.games.lifecycle.send_push_to_users", new=AsyncMock()):
                                        with patch(
                                            "routers.games.thread_utils.insert_game_thread_and_broadcast",
                                            new=AsyncMock(),
                                        ):
                                            await lc.start_game(game_id, host_user)

    asyncio.run(_run())
    assert len(increment_calls) == 1
    assert increment_calls[0][1] == "host_u1"
