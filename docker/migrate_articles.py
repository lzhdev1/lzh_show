"""Install this portfolio's versioned article data in the shared PostgreSQL container."""
import hashlib
import json
import os
import re
import secrets
import subprocess
import tempfile
from pathlib import Path
from urllib.parse import unquote, urlsplit

DATA = Path(__file__).resolve().parents[1] / "blog_front" / "db" / "articles"
ENV_FILE = DATA / ".env"
CONTAINER = os.environ.get("ARTICLES_POSTGRES_CONTAINER", "shared-postgres")
DATABASE = "lzh_show_articles"
READER = "lzh_show_articles_reader"


def valid_table(table):
    if not isinstance(table, dict):
        return False
    columns, rows = table.get("columns"), table.get("rows")
    if not isinstance(columns, list) or not columns or not isinstance(rows, list) or not rows:
        return False
    for row in [columns, *rows]:
        if not isinstance(row, list) or len(row) != len(columns):
            return False
        if not all(isinstance(cell, str) and cell.strip() for cell in row):
            return False
    return True


def read_migrations():
    files = sorted(DATA.glob("[0-9][0-9][0-9]-*.json"))
    if not files:
        raise SystemExit(f"No article migrations found in {DATA}")
    migrations = []
    for file in files:
        if not re.fullmatch(r"[0-9]{3}-[a-z0-9-]+\.json", file.name):
            raise ValueError(f"Invalid migration filename: {file.name}")
        entries = json.loads(file.read_text(encoding="utf-8"))
        if not isinstance(entries, list) or not entries:
            raise ValueError(f"{file.name} must contain a nonempty article array")
        for entry in entries:
            for language in ["zh", "en"]:
                edition = entry[language]
                if not edition["title"].strip() or not edition["summary"].strip() or not edition["sections"]:
                    raise ValueError(f"Incomplete {language} article in {file.name}: {entry['slug']}")
                for section in edition["sections"]:
                    paragraphs = section["paragraphs"]
                    if (not section["heading"].strip() or not isinstance(paragraphs, list)
                            or not paragraphs or not all(p.strip() for p in paragraphs)):
                        raise ValueError(f"Incomplete {language} section in {file.name}: {entry['slug']}")
                    if "table" in section and not valid_table(section["table"]):
                        raise ValueError(f"Invalid {language} table in {file.name}: {entry['slug']}")
        # Canonical JSON keeps the digest identical across Windows/Linux and formatting changes.
        payload = json.dumps(entries, sort_keys=True, separators=(",", ":"))
        digest = hashlib.sha256(payload.encode()).hexdigest()
        migrations.append((file.name, digest, payload))
    return migrations


def reader_password():
    if not ENV_FILE.exists():
        password = secrets.token_urlsafe(36)
        dsn = f"postgresql://{READER}:{password}@{CONTAINER}:5432/{DATABASE}"
        # Publish the complete file once, even when two first-time runs overlap.
        with tempfile.TemporaryDirectory(dir=DATA) as temp:
            draft = Path(temp) / ".env"
            fd = os.open(draft, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
            with os.fdopen(fd, "w", encoding="utf-8") as out:
                out.write(f"ARTICLES_DATABASE_URL={dsn}\n")
            try:
                os.link(draft, ENV_FILE)
            except FileExistsError:
                pass
    settings = dict(line.split("=", 1) for line in ENV_FILE.read_text(encoding="utf-8").splitlines()
                    if "=" in line and not line.lstrip().startswith("#"))
    dsn = urlsplit(settings.get("ARTICLES_DATABASE_URL", ""))
    if (dsn.scheme not in ("postgres", "postgresql") or dsn.hostname != CONTAINER
            or dsn.port not in (None, 5432) or dsn.username != READER
            or dsn.path != "/" + DATABASE or not dsn.password):
        raise SystemExit(f"Expected the {READER} connection for {CONTAINER}/{DATABASE} in {ENV_FILE}")
    password = unquote(dsn.password)
    if "\n" in password or "\r" in password:
        raise SystemExit("The article reader password must fit on one line")
    return password


def run_psql(database, sql, password=None, as_reader=False):
    # Pass credentials through stdin. Shell arguments and deployment logs contain no secret.
    shell = ""
    if password is not None:
        shell = "IFS= read -r PGPASSWORD; export PGPASSWORD; "
        sql = password + "\n" + sql
    login = f"-h 127.0.0.1 -U {READER}" if as_reader else '-U "$POSTGRES_USER"'
    if password is not None and not as_reader:
        shell += "export ARTICLE_READER_PASSWORD=\"$PGPASSWORD\"; unset PGPASSWORD; "
    shell += f'exec psql -XqAtw -v ON_ERROR_STOP=1 {login} -d "$1"'
    result = subprocess.run(["docker", "exec", "-i", CONTAINER, "sh", "-ec", shell, "sh", database],
                            input=sql.encode(), stdout=subprocess.PIPE, stderr=subprocess.PIPE)
    if result.returncode:
        if password is None:
            raise SystemExit(result.stderr.decode(errors="replace").strip())
        raise SystemExit(f"Article database provisioning or reader login failed. Check {CONTAINER} "
                         f"and the existing credential in {ENV_FILE}.")
    return result.stdout.decode().strip()


def migrate():
    migrations = read_migrations()
    password = reader_password()
    run_psql("postgres", rf"""
\getenv reader_password ARTICLE_READER_PASSWORD
SELECT pg_advisory_lock(hashtextextended('lzh_show.articles.provision', 0));
SELECT format('CREATE ROLE {READER} LOGIN PASSWORD %L', :'reader_password')
WHERE NOT EXISTS (SELECT FROM pg_roles WHERE rolname='{READER}') \gexec
SELECT 'CREATE DATABASE {DATABASE}'
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname='{DATABASE}') \gexec
GRANT CONNECT ON DATABASE {DATABASE} TO {READER};
""", password)
    # An existing role may have a different credential. Verify before applying any data changes.
    run_psql(DATABASE, "SELECT current_database()", password, as_reader=True)
    sql = [rf"""
BEGIN;
SET LOCAL standard_conforming_strings = on;
SELECT pg_advisory_xact_lock(hashtextextended('lzh_show.articles.migrate', 0));
CREATE TABLE IF NOT EXISTS public.article_migrations (
    name text PRIMARY KEY, checksum text NOT NULL, applied_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.articles (
    slug text PRIMARY KEY CHECK (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
    project_slug text NOT NULL CHECK (project_slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
    published_on date NOT NULL, tags text[] NOT NULL, zh jsonb NOT NULL, en jsonb NOT NULL
);
GRANT USAGE ON SCHEMA public TO {READER};
GRANT SELECT ON public.articles TO {READER};
"""]
    for name, checksum, payload in migrations:
        quoted_json = payload.replace("'", "''")
        sql.append(rf"""
DO $$ BEGIN
  IF EXISTS (SELECT FROM public.article_migrations WHERE name='{name}' AND checksum<>'{checksum}') THEN
    RAISE EXCEPTION 'Applied migration {name} changed. Keep it intact and add a new numbered JSON file.';
  END IF;
END $$;
SELECT NOT EXISTS (SELECT FROM public.article_migrations WHERE name='{name}') AS pending \gset
\if :pending
INSERT INTO public.articles (slug, project_slug, published_on, tags, zh, en)
SELECT slug, "projectSlug", "publishedAt", tags, zh, en FROM jsonb_to_recordset('{quoted_json}'::jsonb)
  AS entry(slug text, "projectSlug" text, "publishedAt" date, tags text[], zh jsonb, en jsonb)
ON CONFLICT (slug) DO UPDATE SET project_slug=EXCLUDED.project_slug, published_on=EXCLUDED.published_on,
  tags=EXCLUDED.tags, zh=EXCLUDED.zh, en=EXCLUDED.en;
INSERT INTO public.article_migrations (name, checksum) VALUES ('{name}', '{checksum}');
\endif
""")
    sql.append("COMMIT;")
    run_psql(DATABASE, "\n".join(sql))
    count = run_psql(DATABASE, "SELECT count(*) FROM public.articles", password, as_reader=True)
    print(f"Article migrations verified on {CONTAINER}/{DATABASE} ({count} articles).")


if __name__ == "__main__":
    migrate()
