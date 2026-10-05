class AppException(Exception):
    status_code = 500
    default_message = "Application error"

    def __init__(self, message: str | None = None):
        self.message = message or self.default_message
        super().__init__(self.message)


class NotFoundException(AppException):
    status_code = 404
    default_message = "Resource not found"


class ConflictException(AppException):
    status_code = 409
    default_message = "Resource conflict"


class ValidationException(AppException):
    status_code = 422
    default_message = "Validation failed"


class DatabaseException(AppException):
    status_code = 500
    default_message = "Database operation failed"