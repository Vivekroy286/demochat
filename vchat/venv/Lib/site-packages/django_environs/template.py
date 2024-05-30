import re
from typing import Iterable, NamedTuple, Optional

from django.template import Engine
from redbaron import RedBaron

DJANGO_SETTINGS_FRAGMENT = "Django settings"


class Replacement(NamedTuple):
    name: str
    env_type: str
    default: Optional[str] = None
    value_template: str = "{value}"
    env_variable: Optional[str] = None


REPLACEMENTS = tuple(
    Replacement(*rep)
    for rep in (
        ("BASE_DIR", "path", "str(environs.Path(__file__).parents[1])"),
        ("SECRET_KEY", "str"),
        ("DEBUG", "bool"),
        ("ALLOWED_HOSTS", "list"),
        (
            "DATABASES",
            "dj_db_url",
            "'sqlite:///' + str(BASE_DIR / 'db.sqlite3')",
            "{{'default': {value}}}",
            "DATABASE_URL",
        ),
        ("LANGUAGE_CODE", "str"),
        ("TIME_ZONE", "str"),
        ("USE_I18N", "bool"),
        ("USE_L10N", "bool"),
        ("USE_TZ", "bool"),
        ("STATIC_URL", "str"),
    )
)


class RedBaronSettings(RedBaron):
    def fix(self, replacements: Iterable[Replacement]):
        self.add_env()
        self.replace_settings(replacements)
        self.replace_comment()

    def add_env(self):
        # replace os import with environs
        import_node = self.find("ImportNode")
        import_node.value = "environs"
        # initialize env
        start = import_node.index_on_parent + 1
        lines = (
            "\n",
            "# Read env variables",
            "# https://github.com/sloria/environs",
            "env = environs.Env()",
            "\n",
        )
        for idx, line in zip(range(start, start + len(lines)), lines):
            self.insert(idx, line)

    def replace_settings(self, replacements: Iterable[Replacement]):
        for rep in replacements:
            node = self.find("name", rep.name)

            if rep.default is None:
                # get default value from template
                default = node.parent.value.dumps()
            else:
                default = rep.default

            value = "env.{env_type}('{env_variable}', default={default})".format(
                env_type=rep.env_type,
                env_variable=rep.env_variable or rep.name,
                default=default,
            )
            node.parent.value = rep.value_template.format(value=value)

    def replace_comment(self):
        to_replace = "os.path.join(BASE_DIR, ...)"
        compiled = re.compile(".*{to_replace}".format(to_replace=re.escape(to_replace)))
        comment = self.find("CommentNode", value=compiled)
        comment.value = comment.value.replace(to_replace, "BASE_DIR / '...'")


class EnvironsEngine(Engine):
    def from_string(self, template_code):
        if DJANGO_SETTINGS_FRAGMENT in template_code:
            red = RedBaronSettings(template_code)
            red.fix(REPLACEMENTS)
            template_code = red.dumps()

        return super().from_string(template_code)
