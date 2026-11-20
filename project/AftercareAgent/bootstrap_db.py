"""Provision this demo's database on the existing shared PostgreSQL container."""
import base64
import os
import secrets
import subprocess
from pathlib import Path
from urllib.parse import unquote, urlsplit

CONFIG = Path(__file__).with_name(".env")
ACCOUNT = "aftercare_agent"
QUEUE_DEFAULTS = {
    "AFTERCARE_MAX_RUNNING": 4,
    "AFTERCARE_WORKER_THREADS": 2,
    "AFTERCARE_QUEUE_LIMIT": 64,
    "AFTERCARE_SESSION_TURNS_PER_MINUTE": 12,
    "AFTERCARE_JOB_LEASE_SECONDS": 60,
    "AFTERCARE_JOB_MAX_ATTEMPTS": 2,
}


def main():
    if not CONFIG.exists():
        password = secrets.token_urlsafe(36)
        url = f"postgresql://{ACCOUNT}:{password}@shared-postgres:5432/{ACCOUNT}"
        fd = os.open(CONFIG, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
        with os.fdopen(fd, "w", encoding="utf-8") as env:
            env.write(f"AFTERCARE_DATABASE_URL={url}\n")
            env.write("AFTERCARE_LLM_BASE_URL=https://dashscope.aliyuncs.com/compatible-mode/v1\n"
                      "AFTERCARE_LLM_MODEL=qwen-plus\n"
                      "AFTERCARE_LLM_API_KEY=\n"
                      "AFTERCARE_LLM_DAILY_TURNS=100\n")

    values = dict(line.split("=", 1) for line in CONFIG.read_text(encoding="utf-8").splitlines()
                  if "=" in line and not line.lstrip().startswith("#"))
    missing = [f"{key}={default}" for key, default in QUEUE_DEFAULTS.items() if key not in values]
    if missing:
        with CONFIG.open("a", encoding="utf-8") as env:
            env.write("\n" + "\n".join(missing) + "\n")
    url = values.get("AFTERCARE_DATABASE_URL", "")
    parsed = urlsplit(url)
    if parsed.username != ACCOUNT or parsed.path != "/" + ACCOUNT or not parsed.password:
        raise SystemExit("Expected the aftercare_agent role and database in .env")
    # Only provision the local shared instance. Never rotate an existing role's password.
    if parsed.hostname != "shared-postgres" or parsed.port not in (None, 5432):
        raise SystemExit("Bootstrap only supports the shared-postgres container on port 5432")
    # Read the credential on stdin; keep it out of docker exec arguments and output.
    encoded = base64.b64encode(unquote(parsed.password).encode()).decode("ascii")
    sql = rf"""SELECT format('CREATE ROLE aftercare_agent LOGIN PASSWORD %L', convert_from(decode('{encoded}', 'base64'), 'UTF8'))
WHERE NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='aftercare_agent') \gexec
SELECT 'CREATE DATABASE aftercare_agent OWNER aftercare_agent'
WHERE NOT EXISTS (SELECT 1 FROM pg_database WHERE datname='aftercare_agent') \gexec
"""
    command = ["docker", "exec", "-i", "shared-postgres", "sh", "-ec",
               'exec psql -Xq -v ON_ERROR_STOP=1 -U "$POSTGRES_USER" -d postgres']
    subprocess.run(command, input=sql.encode(), check=True, stdout=subprocess.DEVNULL,
                   stderr=subprocess.DEVNULL)
    # Check both the existing credential and ownership before declaring success.
    verify = ["docker", "exec", "-i", "shared-postgres", "sh", "-ec",
              'IFS= read -r PGPASSWORD; export PGPASSWORD; exec psql -XAtw -h 127.0.0.1 '
              '-U aftercare_agent -d aftercare_agent -c "SELECT pg_get_userbyid(datdba) '
              'FROM pg_database WHERE datname=current_database()"']
    check = subprocess.run(verify, input=unquote(parsed.password) + "\n", universal_newlines=True,
                           stdout=subprocess.PIPE, stderr=subprocess.PIPE, check=False)
    if check.returncode or check.stdout.strip() != ACCOUNT:
        raise SystemExit("Check the existing aftercare_agent database ownership and its password in .env")
    print("Ready: shared-postgres / aftercare_agent")


if __name__ == "__main__":
    main()
