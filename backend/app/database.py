import psycopg
from psycopg.rows import dict_row
from app.config import settings

def get_connection():
    """
    Returns a new PostgreSQL connection with dictionary rows enabled.
    Supports either DATABASE_URL or discrete host/port parameters.
    """
    conn_string = settings.DATABASE_URL or settings.POSTGRES_URL or settings.POSTGRES_URL_NON_POOLING
    if conn_string:
        return psycopg.connect(conn_string, row_factory=dict_row)
    return psycopg.connect(
        host=settings.DB_HOST,
        port=settings.DB_PORT,
        dbname=settings.DB_NAME,
        user=settings.DB_USER,
        password=settings.DB_PASSWORD,
        row_factory=dict_row
    )
