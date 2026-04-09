"""Business logic layer — called from routers; owns transactions and domain rules.

Routers stay thin; services use `AsyncSession` and raise `AppError` / HTTPException as needed.
"""
