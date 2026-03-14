"""Pagination utilities."""
from dataclasses import dataclass
from typing import Generic, TypeVar

from fastapi import Query

T = TypeVar("T")


@dataclass
class PaginationParams:
    page: int
    page_size: int

    @property
    def offset(self) -> int:
        return (self.page - 1) * self.page_size


def get_pagination(
    page: int = Query(default=1, ge=1, description="Page number"),
    page_size: int = Query(default=20, ge=1, le=100, description="Items per page"),
) -> PaginationParams:
    """FastAPI dependency for pagination params."""
    return PaginationParams(page=page, page_size=page_size)


def paginate_response(
    items: list,
    total: int,
    pagination: PaginationParams,
) -> dict:
    """Build a paginated response dict."""
    return {
        "items": items,
        "total": total,
        "page": pagination.page,
        "page_size": pagination.page_size,
        "has_next": (pagination.page * pagination.page_size) < total,
    }
