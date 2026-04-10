"""Domain errors with stable codes for API responses."""

from fastapi import HTTPException, status


class AppError(HTTPException):
    """Raised when business rules fail; maps to JSON `detail` with `code` and `message`."""

    def __init__(
        self,
        code: str,
        message: str = "",
        *,
        status_code: int = status.HTTP_400_BAD_REQUEST,
    ) -> None:
        super().__init__(
            status_code=status_code,
            detail={"code": code, "message": message or code},
        )
