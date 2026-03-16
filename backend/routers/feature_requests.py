from fastapi import APIRouter, HTTPException, Depends, Query
from pydantic import BaseModel
from typing import Optional
from dependencies import User, get_current_user
from db.pg import get_pool

router = APIRouter(prefix="/api", tags=["feature_requests"])


class FeatureRequestCreate(BaseModel):
    title: str
    description: str = ""


@router.get("/feature-requests")
async def list_feature_requests(
    sort: str = Query("votes", regex="^(votes|newest)$"),
    search: str = Query("", max_length=200),
    offset: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=50),
    current_user: User = Depends(get_current_user),
):
    """List feature requests with sorting, search, and vote status."""
    pool = get_pool()
    order = "fr.vote_count DESC, fr.created_at DESC" if sort == "votes" else "fr.created_at DESC"
    search_term = search.strip()

    query = f"""
        SELECT fr.*,
               (EXISTS (
                   SELECT 1 FROM feature_request_votes v
                   WHERE v.feature_request_id = fr.id AND v.user_id = $1
               )) as user_voted
        FROM feature_requests fr
        WHERE ($2 = '' OR fr.title ILIKE '%' || $2 || '%' OR fr.description ILIKE '%' || $2 || '%')
        ORDER BY {order}
        LIMIT $3 OFFSET $4
    """
    count_query = """
        SELECT COUNT(*) as total FROM feature_requests fr
        WHERE ($1 = '' OR fr.title ILIKE '%' || $1 || '%' OR fr.description ILIKE '%' || $1 || '%')
    """

    async with pool.acquire() as conn:
        rows = await conn.fetch(query, current_user.user_id, search_term, limit, offset)
        count_row = await conn.fetchval(count_query, search_term)

    items = [dict(r) for r in rows]
    return {"items": items, "total": count_row or 0}


@router.post("/feature-requests")
async def create_feature_request(
    body: FeatureRequestCreate,
    current_user: User = Depends(get_current_user),
):
    """Create a new feature request."""
    title = body.title.strip()
    description = body.description.strip()

    if not title or len(title) > 120:
        raise HTTPException(status_code=400, detail="Title must be 1-120 characters.")
    if len(description) > 2000:
        raise HTTPException(status_code=400, detail="Description must be at most 2000 characters.")

    pool = get_pool()
    async with pool.acquire() as conn:
        row = await conn.fetchrow(
            """
            INSERT INTO feature_requests (user_id, title, description)
            VALUES ($1, $2, $3)
            RETURNING id, user_id, title, description, status, vote_count, comment_count, created_at
            """,
            current_user.user_id,
            title,
            description,
        )
    return dict(row)


@router.post("/feature-requests/{request_id}/vote")
async def toggle_vote(
    request_id: str,
    current_user: User = Depends(get_current_user),
):
    """Toggle upvote on a feature request. Returns new vote state."""
    pool = get_pool()
    async with pool.acquire() as conn:
        async with conn.transaction():
            # Check the feature request exists
            fr = await conn.fetchrow(
                "SELECT id FROM feature_requests WHERE id = $1", request_id
            )
            if not fr:
                raise HTTPException(status_code=404, detail="Feature request not found.")

            # Try to remove existing vote
            deleted = await conn.execute(
                "DELETE FROM feature_request_votes WHERE feature_request_id = $1 AND user_id = $2",
                request_id,
                current_user.user_id,
            )
            if deleted == "DELETE 1":
                # Vote was removed — decrement
                await conn.execute(
                    "UPDATE feature_requests SET vote_count = GREATEST(vote_count - 1, 0), updated_at = now() WHERE id = $1",
                    request_id,
                )
                voted = False
            else:
                # No existing vote — add one
                await conn.execute(
                    "INSERT INTO feature_request_votes (feature_request_id, user_id) VALUES ($1, $2)",
                    request_id,
                    current_user.user_id,
                )
                await conn.execute(
                    "UPDATE feature_requests SET vote_count = vote_count + 1, updated_at = now() WHERE id = $1",
                    request_id,
                )
                voted = True

            row = await conn.fetchrow(
                "SELECT vote_count FROM feature_requests WHERE id = $1", request_id
            )

    return {"voted": voted, "vote_count": row["vote_count"] if row else 0}
