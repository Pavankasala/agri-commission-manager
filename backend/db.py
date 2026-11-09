"""Database connection, schema setup, and explicit legacy-data migration helpers."""

from __future__ import annotations

import os
import sqlite3
from pathlib import Path

from dotenv import load_dotenv

load_dotenv()

DATABASE_URL = os.environ.get("DATABASE_URL")
DATABASE_PATH = os.environ.get("DATABASE_PATH") or str(Path(__file__).with_name("lemons.db"))

psycopg2 = None
psycopg2_extras = None
try:
    import psycopg2
    import psycopg2.extras as psycopg2_extras
except ImportError:
    pass


LEGACY_TABLES = (
    "inventory",
    "sold_data",
    "kisans",
    "expenditures",
    "cash_collection",
    "shops",
    "sms_logs",
    "bags_config",
)


def using_postgres() -> bool:
    return bool(DATABASE_URL)


def get_db():
    """Open a short-lived database connection for the current request."""
    if using_postgres():
        conn_str = DATABASE_URL
        if "sslmode" not in conn_str and "localhost" not in conn_str and "127.0.0.1" not in conn_str:
            conn_str += "?sslmode=require" if "?" not in conn_str else "&sslmode=require"

        if psycopg2 and psycopg2_extras:
            return psycopg2.connect(conn_str, cursor_factory=psycopg2_extras.RealDictCursor)

        import psycopg2 as pg_driver
        import psycopg2.extras as pg_extras

        return pg_driver.connect(conn_str, cursor_factory=pg_extras.RealDictCursor)

    db_path = Path(DATABASE_PATH).expanduser().resolve()
    db_path.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(str(db_path))
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    return conn


def ph() -> str:
    """Return the parameter placeholder for the active database driver."""
    return "%s" if using_postgres() else "?"


def user_table() -> str:
    return '"user"' if using_postgres() else "user"


def get_user_id(req):
    """Compatibility wrapper; identity comes only from a verified Bearer token."""
    from security import get_authenticated_user_id

    return get_authenticated_user_id(req)


def _sqlite_add_column(cursor, statement: str) -> None:
    try:
        cursor.execute(statement)
    except sqlite3.OperationalError as exc:
        if "duplicate column name" not in str(exc).lower():
            raise


def _create_postgres_schema(cursor) -> None:
    cursor.execute(
        '''
        CREATE TABLE IF NOT EXISTS "user" (
            user_id SERIAL PRIMARY KEY,
            user_name VARCHAR(100) UNIQUE NOT NULL,
            email VARCHAR(255) UNIQUE NOT NULL,
            password VARCHAR(255),
            user_type VARCHAR(20) NOT NULL DEFAULT 'OPE',
            name VARCHAR(100),
            company_name VARCHAR(200),
            company_full_name VARCHAR(250),
            mobile VARCHAR(50),
            address TEXT,
            commission REAL DEFAULT 5.0,
            less_for_damages REAL DEFAULT 0.0,
            icf REAL DEFAULT 1.0,
            default_hamali REAL DEFAULT 10.0,
            license_expires_on VARCHAR(50),
            auth_provider VARCHAR(50) NOT NULL DEFAULT 'LOCAL',
            status VARCHAR(20) NOT NULL DEFAULT 'PENDING',
            is_approved BOOLEAN NOT NULL DEFAULT FALSE,
            role VARCHAR(20) NOT NULL DEFAULT 'USER',
            created_at VARCHAR(50)
        );
        '''
    )
    cursor.execute(
        '''
        CREATE TABLE IF NOT EXISTS inventory (
            id SERIAL PRIMARY KEY,
            user_id INT NOT NULL REFERENCES "user"(user_id) ON DELETE CASCADE,
            bill_group_id VARCHAR(64),
            name VARCHAR(100),
            source_kisan_name VARCHAR(100),
            mobile VARCHAR(50),
            village VARCHAR(100),
            payment_mode VARCHAR(30),
            no_of_bags INT DEFAULT 0,
            date VARCHAR(50),
            time VARCHAR(50),
            type VARCHAR(50),
            price REAL DEFAULT 0.0,
            transportation_charges REAL DEFAULT 0.0,
            lorry_no VARCHAR(50),
            tons VARCHAR(50),
            enam REAL DEFAULT 0.0,
            lorry_advance REAL DEFAULT 0.0,
            sold_to VARCHAR(100),
            hamali REAL DEFAULT 0.0,
            remote_commission REAL DEFAULT 0.0,
            advance REAL DEFAULT 0.0,
            paid VARCHAR(10) DEFAULT 'NO',
            confirmed BOOLEAN DEFAULT FALSE,
            paid_date VARCHAR(50),
            paid_amount REAL DEFAULT 0.0
        );
        '''
    )
    cursor.execute(
        '''
        CREATE TABLE IF NOT EXISTS sold_data (
            id SERIAL PRIMARY KEY,
            user_id INT NOT NULL REFERENCES "user"(user_id) ON DELETE CASCADE,
            date VARCHAR(50),
            name VARCHAR(100),
            sold_to VARCHAR(100),
            no_of_bags INT DEFAULT 0,
            hamali_per_bag REAL DEFAULT 0.0,
            party_commission VARCHAR(50),
            lorry_no VARCHAR(50),
            lorry_charges REAL DEFAULT 0.0,
            tons REAL DEFAULT 0.0,
            enam VARCHAR(100),
            lorry_advance REAL DEFAULT 0.0,
            village_ref VARCHAR(150)
        );
        '''
    )
    cursor.execute(
        '''
        CREATE TABLE IF NOT EXISTS kisans (
            id SERIAL PRIMARY KEY,
            user_id INT NOT NULL REFERENCES "user"(user_id) ON DELETE CASCADE,
            name VARCHAR(100) NOT NULL,
            mobile VARCHAR(50)
        );
        '''
    )
    cursor.execute(
        '''
        CREATE TABLE IF NOT EXISTS expenditures (
            id SERIAL PRIMARY KEY,
            user_id INT NOT NULL REFERENCES "user"(user_id) ON DELETE CASCADE,
            date VARCHAR(50),
            description TEXT,
            amount REAL DEFAULT 0.0
        );
        '''
    )
    cursor.execute(
        '''
        CREATE TABLE IF NOT EXISTS cash_collection (
            id SERIAL PRIMARY KEY,
            user_id INT NOT NULL REFERENCES "user"(user_id) ON DELETE CASCADE,
            date VARCHAR(50),
            amount REAL DEFAULT 0.0,
            given_by VARCHAR(100)
        );
        '''
    )
    cursor.execute(
        '''
        CREATE TABLE IF NOT EXISTS shops (
            id SERIAL PRIMARY KEY,
            user_id INT NOT NULL REFERENCES "user"(user_id) ON DELETE CASCADE,
            name VARCHAR(100) NOT NULL,
            city VARCHAR(100),
            mobile VARCHAR(50)
        );
        '''
    )
    cursor.execute(
        '''
        CREATE TABLE IF NOT EXISTS sms_logs (
            id SERIAL PRIMARY KEY,
            user_id INT NOT NULL REFERENCES "user"(user_id) ON DELETE CASCADE,
            date VARCHAR(50),
            mobile VARCHAR(50),
            message TEXT,
            status VARCHAR(50) DEFAULT 'QUEUED'
        );
        '''
    )
    cursor.execute(
        '''
        CREATE TABLE IF NOT EXISTS bags_config (
            id SERIAL PRIMARY KEY,
            user_id INT NOT NULL REFERENCES "user"(user_id) ON DELETE CASCADE,
            bag_type VARCHAR(100),
            capacity VARCHAR(50)
        );
        '''
    )


def _create_sqlite_schema(cursor) -> None:
    cursor.execute(
        '''
        CREATE TABLE IF NOT EXISTS user (
            user_id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_name TEXT UNIQUE NOT NULL,
            email TEXT UNIQUE NOT NULL,
            password TEXT,
            user_type TEXT NOT NULL DEFAULT 'OPE',
            name TEXT,
            company_name TEXT,
            company_full_name TEXT,
            mobile TEXT,
            address TEXT,
            commission REAL DEFAULT 5.0,
            less_for_damages REAL DEFAULT 0.0,
            icf REAL DEFAULT 1.0,
            default_hamali REAL DEFAULT 10.0,
            license_expires_on TEXT,
            auth_provider TEXT NOT NULL DEFAULT 'LOCAL',
            status TEXT NOT NULL DEFAULT 'PENDING',
            is_approved INTEGER NOT NULL DEFAULT 0,
            role TEXT NOT NULL DEFAULT 'USER',
            created_at TEXT
        )
        '''
    )
    cursor.execute(
        '''
        CREATE TABLE IF NOT EXISTS inventory (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL REFERENCES user(user_id) ON DELETE CASCADE,
            bill_group_id TEXT,
            name TEXT,
            source_kisan_name TEXT,
            mobile TEXT,
            village TEXT,
            payment_mode TEXT,
            no_of_bags INTEGER DEFAULT 0,
            date TEXT,
            time TEXT,
            type TEXT,
            price REAL DEFAULT 0.0,
            transportation_charges REAL DEFAULT 0.0,
            lorry_no TEXT,
            tons TEXT,
            enam REAL DEFAULT 0.0,
            lorry_advance REAL DEFAULT 0.0,
            sold_to TEXT,
            hamali REAL DEFAULT 0.0,
            remote_commission REAL DEFAULT 0.0,
            advance REAL DEFAULT 0.0,
            paid TEXT DEFAULT 'NO',
            confirmed INTEGER DEFAULT 0,
            paid_date TEXT,
            paid_amount REAL DEFAULT 0.0
        )
        '''
    )
    cursor.execute(
        '''
        CREATE TABLE IF NOT EXISTS sold_data (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL REFERENCES user(user_id) ON DELETE CASCADE,
            date TEXT,
            name TEXT,
            sold_to TEXT,
            no_of_bags INTEGER DEFAULT 0,
            hamali_per_bag REAL DEFAULT 0.0,
            party_commission TEXT,
            lorry_no TEXT,
            lorry_charges REAL DEFAULT 0.0,
            tons REAL DEFAULT 0.0,
            enam TEXT,
            lorry_advance REAL DEFAULT 0.0,
            village_ref TEXT
        )
        '''
    )
    cursor.execute(
        '''
        CREATE TABLE IF NOT EXISTS kisans (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL REFERENCES user(user_id) ON DELETE CASCADE,
            name TEXT NOT NULL,
            mobile TEXT
        )
        '''
    )
    cursor.execute(
        '''
        CREATE TABLE IF NOT EXISTS expenditures (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL REFERENCES user(user_id) ON DELETE CASCADE,
            date TEXT,
            description TEXT,
            amount REAL DEFAULT 0.0
        )
        '''
    )
    cursor.execute(
        '''
        CREATE TABLE IF NOT EXISTS cash_collection (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL REFERENCES user(user_id) ON DELETE CASCADE,
            date TEXT,
            amount REAL DEFAULT 0.0,
            given_by TEXT
        )
        '''
    )
    cursor.execute(
        '''
        CREATE TABLE IF NOT EXISTS shops (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL REFERENCES user(user_id) ON DELETE CASCADE,
            name TEXT NOT NULL,
            city TEXT,
            mobile TEXT
        )
        '''
    )
    cursor.execute(
        '''
        CREATE TABLE IF NOT EXISTS sms_logs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL REFERENCES user(user_id) ON DELETE CASCADE,
            date TEXT,
            mobile TEXT,
            message TEXT,
            status TEXT DEFAULT 'QUEUED'
        )
        '''
    )
    cursor.execute(
        '''
        CREATE TABLE IF NOT EXISTS bags_config (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL REFERENCES user(user_id) ON DELETE CASCADE,
            bag_type TEXT,
            capacity TEXT
        )
        '''
    )


def _apply_postgres_migrations(cursor) -> None:
    statements = [
        'ALTER TABLE "user" ADD COLUMN IF NOT EXISTS email VARCHAR(255)',
        'ALTER TABLE "user" ADD COLUMN IF NOT EXISTS address TEXT',
        'ALTER TABLE "user" ADD COLUMN IF NOT EXISTS auth_provider VARCHAR(50) DEFAULT \'LOCAL\'',
        'ALTER TABLE "user" ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT \'PENDING\'',
        'ALTER TABLE "user" ADD COLUMN IF NOT EXISTS is_approved BOOLEAN DEFAULT FALSE',
        'ALTER TABLE "user" ADD COLUMN IF NOT EXISTS role VARCHAR(20) DEFAULT \'USER\'',
        'ALTER TABLE "user" ADD COLUMN IF NOT EXISTS created_at VARCHAR(50)',
        "ALTER TABLE inventory ADD COLUMN IF NOT EXISTS user_id INT",
        "ALTER TABLE inventory ADD COLUMN IF NOT EXISTS bill_group_id VARCHAR(64)",
        "ALTER TABLE inventory ADD COLUMN IF NOT EXISTS source_kisan_name VARCHAR(100)",
        "ALTER TABLE inventory ADD COLUMN IF NOT EXISTS mobile VARCHAR(50)",
        "ALTER TABLE inventory ADD COLUMN IF NOT EXISTS payment_mode VARCHAR(30)",
        "ALTER TABLE inventory ADD COLUMN IF NOT EXISTS time VARCHAR(50)",
        "ALTER TABLE inventory ADD COLUMN IF NOT EXISTS confirmed BOOLEAN DEFAULT FALSE",
        "ALTER TABLE inventory ADD COLUMN IF NOT EXISTS paid_date VARCHAR(50)",
        "ALTER TABLE inventory ADD COLUMN IF NOT EXISTS paid_amount REAL DEFAULT 0.0",
        "ALTER TABLE sold_data ADD COLUMN IF NOT EXISTS user_id INT",
        "ALTER TABLE expenditures ADD COLUMN IF NOT EXISTS user_id INT",
        "ALTER TABLE cash_collection ADD COLUMN IF NOT EXISTS user_id INT",
        "ALTER TABLE kisans ADD COLUMN IF NOT EXISTS user_id INT",
        "ALTER TABLE shops ADD COLUMN IF NOT EXISTS user_id INT",
        "ALTER TABLE sms_logs ADD COLUMN IF NOT EXISTS user_id INT",
        "ALTER TABLE bags_config ADD COLUMN IF NOT EXISTS user_id INT",
    ]
    for statement in statements:
        cursor.execute(statement)

    try:
        cursor.execute("SAVEPOINT user_migration_sp")
        cursor.execute('UPDATE "user" SET status = \'APPROVED\', is_approved = TRUE, role = \'ADMIN\', user_type = \'ADMIN\' WHERE user_id = 1')
        cursor.execute('UPDATE "user" SET status = \'APPROVED\', is_approved = TRUE WHERE status IS NULL')
        cursor.execute("RELEASE SAVEPOINT user_migration_sp")
    except Exception:
        try:
            cursor.execute("ROLLBACK TO SAVEPOINT user_migration_sp")
        except Exception:
            pass

    for statement in [
        "CREATE INDEX IF NOT EXISTS idx_inventory_user_date_type ON inventory (user_id, date, type)",
        "CREATE INDEX IF NOT EXISTS idx_inventory_group ON inventory (user_id, bill_group_id)",
        "CREATE INDEX IF NOT EXISTS idx_sold_data_user_date ON sold_data (user_id, date)",
        "CREATE INDEX IF NOT EXISTS idx_expenditures_user_date ON expenditures (user_id, date)",
        "CREATE INDEX IF NOT EXISTS idx_cash_collection_user_date ON cash_collection (user_id, date)",
        "CREATE INDEX IF NOT EXISTS idx_sms_logs_user_date ON sms_logs (user_id, date)",
    ]:
        cursor.execute(statement)


def _apply_sqlite_migrations(cursor) -> None:
    statements = [
        "ALTER TABLE user ADD COLUMN email TEXT",
        "ALTER TABLE user ADD COLUMN address TEXT",
        "ALTER TABLE user ADD COLUMN auth_provider TEXT DEFAULT 'LOCAL'",
        "ALTER TABLE user ADD COLUMN status TEXT DEFAULT 'PENDING'",
        "ALTER TABLE user ADD COLUMN is_approved INTEGER DEFAULT 0",
        "ALTER TABLE user ADD COLUMN role TEXT DEFAULT 'USER'",
        "ALTER TABLE user ADD COLUMN created_at TEXT",
        "ALTER TABLE inventory ADD COLUMN user_id INTEGER",
        "ALTER TABLE inventory ADD COLUMN bill_group_id TEXT",
        "ALTER TABLE inventory ADD COLUMN source_kisan_name TEXT",
        "ALTER TABLE inventory ADD COLUMN mobile TEXT",
        "ALTER TABLE inventory ADD COLUMN payment_mode TEXT",
        "ALTER TABLE inventory ADD COLUMN time TEXT",
        "ALTER TABLE inventory ADD COLUMN confirmed INTEGER DEFAULT 0",
        "ALTER TABLE inventory ADD COLUMN paid_date TEXT",
        "ALTER TABLE inventory ADD COLUMN paid_amount REAL DEFAULT 0.0",
        "ALTER TABLE sold_data ADD COLUMN user_id INTEGER",
        "ALTER TABLE expenditures ADD COLUMN user_id INTEGER",
        "ALTER TABLE cash_collection ADD COLUMN user_id INTEGER",
        "ALTER TABLE kisans ADD COLUMN user_id INTEGER",
        "ALTER TABLE shops ADD COLUMN user_id INTEGER",
        "ALTER TABLE sms_logs ADD COLUMN user_id INTEGER",
        "ALTER TABLE bags_config ADD COLUMN user_id INTEGER",
    ]
    for statement in statements:
        _sqlite_add_column(cursor, statement)

    try:
        cursor.execute("UPDATE user SET status = 'APPROVED', is_approved = 1, role = 'ADMIN', user_type = 'ADMIN' WHERE user_id = 1")
        cursor.execute("UPDATE user SET status = 'APPROVED', is_approved = 1 WHERE status IS NULL")
    except Exception:
        pass

    for statement in [
        "CREATE INDEX IF NOT EXISTS idx_inventory_user_date_type ON inventory (user_id, date, type)",
        "CREATE INDEX IF NOT EXISTS idx_inventory_group ON inventory (user_id, bill_group_id)",
        "CREATE INDEX IF NOT EXISTS idx_sold_data_user_date ON sold_data (user_id, date)",
        "CREATE INDEX IF NOT EXISTS idx_expenditures_user_date ON expenditures (user_id, date)",
        "CREATE INDEX IF NOT EXISTS idx_cash_collection_user_date ON cash_collection (user_id, date)",
        "CREATE INDEX IF NOT EXISTS idx_sms_logs_user_date ON sms_logs (user_id, date)",
    ]:
        cursor.execute(statement)


def init_db() -> None:
    """Create/upgrade schema without assigning legacy unowned rows automatically."""
    conn = get_db()
    try:
        cursor = conn.cursor()
        if using_postgres():
            _create_postgres_schema(cursor)
            _apply_postgres_migrations(cursor)
        else:
            _create_sqlite_schema(cursor)
            _apply_sqlite_migrations(cursor)

        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()



def legacy_record_counts() -> dict[str, int]:
    """Return the number of pre-tenancy records awaiting explicit assignment."""
    conn = get_db()
    try:
        cursor = conn.cursor()
        counts: dict[str, int] = {}
        for table in LEGACY_TABLES:
            cursor.execute(f"SELECT COUNT(*) AS count FROM {table} WHERE user_id IS NULL")
            row = cursor.fetchone()
            row_dict = dict(row) if row else {}
            counts[table] = int(row_dict.get("count", 0))
        return counts
    finally:
        conn.close()


def assign_legacy_records(owner_user_id: int) -> dict[str, int]:
    """Explicitly assign every NULL-owner legacy record to one chosen account.

    This function is deliberately never called at startup. Use the companion
    migration script only after confirming the intended data owner.
    """
    owner_user_id = int(owner_user_id)
    conn = get_db()
    try:
        cursor = conn.cursor()
        p = ph()
        cursor.execute(f"SELECT user_id FROM {user_table()} WHERE user_id = {p}", (owner_user_id,))
        if not cursor.fetchone():
            raise ValueError(f"User id {owner_user_id} does not exist")

        changed: dict[str, int] = {}
        for table in LEGACY_TABLES:
            cursor.execute(f"UPDATE {table} SET user_id = {p} WHERE user_id IS NULL", (owner_user_id,))
            changed[table] = max(cursor.rowcount or 0, 0)
        conn.commit()
        return changed
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()


if __name__ == "__main__":
    init_db()
    print("Database schema initialized successfully")
