"""
Invokes django-environs when the django_environs module is run as a script.
Example: python -m django_environs startproject
"""
from django_environs import management

if __name__ == "__main__":
    management.execute_from_command_line()
