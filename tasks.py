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
def test(context):
    """Run tests with coverage."""
    print("Running tests with coverage...")
    context.run("docker compose exec -T nautobot bash -c 'python -m coverage run --source=nautobot_topology -m nautobot.core.cli test nautobot_topology.tests --noinput --keepdb && python -m coverage report -m --fail-under=80'", pty=False, in_stream=False)

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
