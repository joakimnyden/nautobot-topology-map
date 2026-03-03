import os
from invoke import task

# Use a default name for the project
PROJECT_NAME = "nautobot-topology"

@task
def build(context):
    """Build the nautobot-topology docker image."""
    print("Building Nautobot Topology Docker image...")
    context.run("docker-compose build", pty=True)

@task
def start(context):
    """Start the nautobot-topology docker containers."""
    print("Starting Nautobot Topology containers...")
    context.run("docker-compose up -d", pty=True)

@task
def stop(context):
    """Stop the nautobot-topology docker containers."""
    print("Stopping Nautobot Topology containers...")
    context.run("docker-compose down", pty=True)

@task
def unittest(context, test_runner="nautobot_topology.tests"):
    """Run Nautobot Topology unit tests."""
    print(f"Running tests for {test_runner}...")
    context.run(f"docker-compose run --rm nautobot nautobot-server test {test_runner}", pty=True)

@task
def lint(context):
    """Run linters."""
    print("Running linters...")
    context.run("docker-compose run --rm nautobot black --check nautobot_topology", pty=True)
    context.run("docker-compose run --rm nautobot flake8 nautobot_topology", pty=True)

@task
def format(context):
    """Run code formatters."""
    print("Formatting code...")
    context.run("docker-compose run --rm nautobot black nautobot_topology", pty=True)
