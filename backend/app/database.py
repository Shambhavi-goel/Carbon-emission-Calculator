import psycopg
from psycopg.rows import dict_row
from app.config import settings

def get_connection():
    """
    Returns a new PostgreSQL connection with dictionary rows enabled.
    Supports either DATABASE_URL or discrete host/port parameters.
    """
    if settings.DATABASE_URL:
        return psycopg.connect(settings.DATABASE_URL, row_factory=dict_row)
    return psycopg.connect(
        host=settings.DB_HOST,
        port=settings.DB_PORT,
        dbname=settings.DB_NAME,
        user=settings.DB_USER,
        password=settings.DB_PASSWORD,
        row_factory=dict_row
    )
