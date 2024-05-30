import functools
from unittest.mock import patch

from django.core.management import (
    execute_from_command_line as django_execute_from_command_line,
)
from django.core.management import find_commands

from django_environs.template import EnvironsEngine


@functools.lru_cache(maxsize=None)
def get_commands():
    commands = {name: "django_environs" for name in find_commands(__path__[0])}
    return commands


@patch("django.core.management.get_commands", new=get_commands)
@patch("django.template.Engine", new=EnvironsEngine)
def execute_from_command_line(**kwargs):
    """Run a ManagementUtility."""
    django_execute_from_command_line(**kwargs)
