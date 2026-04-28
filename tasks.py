import os
from invoke import task

# Use a default name for the project
PROJECT_NAME = "nautobot-topology"

@task
def build(context):
    """Build the nautobot-topology docker image."""
    print("Building Nautobot Topology Docker image...")
    context.run("docker-compose build", pty=False, in_stream=False)

@task
def start(context):
    """Start the nautobot-topology docker containers."""
    print("Starting Nautobot Topology containers...")
    context.run("docker-compose up -d", pty=False, in_stream=False)

@task
def stop(context):
    """Stop the nautobot-topology docker containers."""
    print("Stopping Nautobot Topology containers...")
    context.run("docker-compose down", pty=False, in_stream=False)

@task
def unittest(context, test_runner="nautobot_topology.tests"):
    """Run Nautobot Topology unit tests."""
    print(f"Running tests for {test_runner}...")
    context.run(f"docker-compose exec -T nautobot nautobot-server test {test_runner} --noinput", pty=False, in_stream=False)

@task
def test(context, module=None, coverage=False):
    """Run Nautobot tests."""
    print("Running tests...")
    
    # Base command
    test_target = "nautobot_topology"
    if module:
        test_target = f"nautobot_topology.tests.{module}" if not module.startswith("nautobot_topology") else module

    if coverage:
        print("Running with coverage...")
        cmd = f"docker compose exec -T nautobot coverage run --source=nautobot_topology -m nautobot.core.cli test {test_target} --noinput"
        context.run("docker compose exec -T nautobot coverage erase", pty=False, in_stream=False)
    else:
        cmd = f"docker compose exec -T nautobot nautobot-server test {test_target} --noinput"

    result = context.run(cmd, pty=False, in_stream=False, warn=True)
    
    if coverage:
        context.run("docker compose exec -T nautobot coverage report -m", pty=False, in_stream=False)
        
    if result.exited != 0:
        print("\nTests FAILED!")
        raise SystemExit(result.exited)
    else:
        print("\nAll tests passed!")


@task
def build_ui(context):
    """Build the React frontend."""
    print("Building frontend...")
    context.run("cd frontend && npm install && npm run build", pty=False, in_stream=False)

@task
def lint(context):
    """Run linters."""
    print("Running linters...")
    context.run("docker-compose exec -T nautobot black --check nautobot_topology", pty=False, in_stream=False)
    context.run("docker-compose exec -T nautobot flake8 nautobot_topology", pty=False, in_stream=False)

@task
def format(context):
    """Run code formatters."""
    print("Formatting code...")
    context.run("docker-compose exec -T nautobot black nautobot_topology", pty=False, in_stream=False)

@task
def migrate(context):
    """Run Nautobot database migrations."""
    print("Applying database migrations...")
    context.run("docker-compose exec -T nautobot nautobot-server migrate", pty=False, in_stream=False)

@task
def post_upgrade(context):
    """Run Nautobot post_upgrade commands (migrations + collectstatic)."""
    print("Running post_upgrade...")
    context.run("docker-compose exec -T nautobot nautobot-server post_upgrade", pty=False, in_stream=False)

@task
def seed(context):
    """Seed the database with complex topology data."""
    print("Seeding database with complex topology data...")
    # We use nbshell to run the script within the Nautobot environment
    context.run(
        "docker compose exec -T nautobot nautobot-server shell --command \"import sys; sys.path.append('/opt/nautobot/scripts'); import generate_complex_site; generate_complex_site.run()\"",
        pty=False, in_stream=False
    )
    print("Seeding complete.")

@task
def seed_varied(context):
    """Seed the database with varied topology scenarios (Campus, DC, Hub)."""
    print("Seeding database with varied topology scenarios...")
    context.run(
        "docker compose exec -T nautobot nautobot-server shell --command \"import sys; sys.path.append('/opt/nautobot/scripts'); import generate_varied_sites; generate_varied_sites.run()\"",
        pty=False, in_stream=False
    )
    print("Seeding complete.")

@task
def db_export(context, filename="dev_data.json"):
    """Export the database to a JSON file."""
    print(f"Exporting database to {filename}...")
    context.run(
        f"docker compose exec -T nautobot nautobot-server dumpdata --indent 2 > {filename}",
        pty=False, in_stream=False
    )

@task
def db_import(context, filename="dev_data.json"):
    """Import the database from a JSON file."""
    print(f"Importing database from {filename}...")
    context.run(
        f"docker compose exec -T nautobot nautobot-server loaddata {filename}",
        pty=False, in_stream=False
    )

@task
def db_export_sql(context, filename="dev_snapshot.sql"):
    """Export the database to a PostgreSQL SQL dump."""
    print(f"Exporting database to {filename}...")
    context.run(
        f"docker compose exec -T db pg_dump -U nautobot nautobot > {filename}",
        pty=False, in_stream=False
    )

@task
def db_import_sql(context, filename="dev_snapshot.sql"):
    """Import the database from a PostgreSQL SQL dump."""
    print(f"Importing database from {filename}...")
    # Pipe the file into psql via docker exec -T
    context.run(
        f"docker compose exec -T db psql -U nautobot nautobot < {filename}",
        pty=False, in_stream=False
    )

@task
def setup_dev(context):
    """Fully initialize the development environment (migrate + import data)."""
    print("Setting up development environment...")
    migrate(context)
    db_import(context, filename="dev_data.json")
    # Clear cache to ensure data is visible
    context.run(
        "docker compose exec -T nautobot bash -c \"echo 'from django.core.cache import cache; cache.clear()' | nautobot-server shell\"",
        pty=False, in_stream=False
    )
    print("Development environment is ready!")
