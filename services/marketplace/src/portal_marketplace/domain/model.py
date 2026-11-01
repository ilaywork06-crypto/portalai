from dataclasses import dataclass, field
from datetime import datetime
from enum import StrEnum
from typing import Self

from portal_kit.auth import Principal
from portal_kit.errors import Forbidden, InvalidInput
from portal_kit.visibility import VisibilityAck


class ItemType(StrEnum):
    SKILL = "Skill"
    MCP = "MCP"
    AGENT = "Agent"
    PLUGIN = "Plugin"
    APP = "App"

    @property
    def publishable(self) -> bool:
        return self is not ItemType.APP


class Category(StrEnum):
    ENTERPRISE = "מערכות ארגוניות"
    OPERATIONAL = "מערכות מבצעיות"
    SOFTWARE = "תוכנה"
    MECHANICS = "מכניקה"
    HARDWARE = "חומרה"


class McpAuth(StrEnum):
    SSO = "SSO (מחובר מראש)"
    API_KEY = "נדרש מפתח API"
    NONE = "אין צורך באימות"


class CodingTool(StrEnum):
    CLAUDE_CODE = "Claude Code"
    OPENCODE = "OpenCode"
    ROO_CODE = "Roo Code"


class InstallMethod(StrEnum):
    CLI_GLOBAL = "cli-global"
    CLI_PROJECT = "cli-project"
    ZIP = "zip"
    CLAUDE_CODE = "claude-code"
    DESKTOP = "desktop"
    NPX = "npx"


def _require(**fields: object) -> None:
    missing = [name for name, value in fields.items() if not value or (isinstance(value, str) and not value.strip())]
    if missing:
        raise InvalidInput(f"Missing required fields: {', '.join(missing)}.", code="missing_fields")


@dataclass(frozen=True, slots=True)
class SkillSpec:
    content: str
    repo: str
    md_name: str = "SKILL.md"

    def validate(self) -> None:
        _require(content=self.content, repo=self.repo)


@dataclass(frozen=True, slots=True)
class AgentSpec:
    content: str
    repo: str
    md_name: str = "README.md"
    audience: tuple[str, ...] = ()
    required_tools: tuple[str, ...] = ()

    def validate(self) -> None:
        _require(content=self.content, repo=self.repo)


@dataclass(frozen=True, slots=True)
class McpSpec:
    server_url: str
    auth: McpAuth
    explanation: str
    repo: str | None = None

    def validate(self) -> None:
        _require(server_url=self.server_url, explanation=self.explanation)


@dataclass(frozen=True, slots=True)
class PluginParts:
    skills: tuple[str, ...] = ()
    agents: tuple[str, ...] = ()
    commands: tuple[str, ...] = ()
    hooks: tuple[str, ...] = ()
    mcps: tuple[str, ...] = ()

    @property
    def total(self) -> int:
        return sum(map(len, (self.skills, self.agents, self.commands, self.hooks, self.mcps)))


@dataclass(frozen=True, slots=True)
class PluginSpec:
    repo: str
    compat: tuple[CodingTool, ...]
    includes: PluginParts
    version: str = "1.0.0"

    def validate(self) -> None:
        _require(repo=self.repo, compat=self.compat, includes=self.includes.total)


@dataclass(frozen=True, slots=True)
class AppSpec:
    repo: str
    version: str
    run_cmd: str
    platforms: tuple[str, ...] = ()
    works_with: tuple[str, ...] = ()
    downloads: dict[str, str] = field(default_factory=dict)

    def validate(self) -> None:
        _require(repo=self.repo, run_cmd=self.run_cmd)


type ItemSpec = SkillSpec | AgentSpec | McpSpec | PluginSpec | AppSpec

SPEC_TYPES: dict[ItemType, type] = {
    ItemType.SKILL: SkillSpec,
    ItemType.AGENT: AgentSpec,
    ItemType.MCP: McpSpec,
    ItemType.PLUGIN: PluginSpec,
    ItemType.APP: AppSpec,
}


@dataclass(frozen=True, slots=True)
class ItemDraft:
    type: ItemType
    name: str
    blurb: str
    description: str
    icon: str
    category: Category
    spec: ItemSpec
    tags: tuple[str, ...] = ()
    publisher: str | None = None

    def validated(self) -> Self:
        _require(name=self.name, blurb=self.blurb, description=self.description, icon=self.icon)
        if not isinstance(self.spec, SPEC_TYPES[self.type]):
            raise InvalidInput(f"The details do not match the item type {self.type}.", code="spec_mismatch")
        self.spec.validate()
        return self


@dataclass(slots=True)
class MarketItem:
    id: str
    type: ItemType
    name: str
    blurb: str
    description: str
    icon: str
    category: Category
    tags: tuple[str, ...]
    owner_id: str
    owner_name: str
    publisher: str
    spec: ItemSpec
    published_at: datetime
    listed_at: datetime
    verified_by: str | None = None
    updated_at: datetime | None = None
    edited: bool = False
    installs: int = 0
    stars: int = 0
    visibility_ack: VisibilityAck | None = None

    @classmethod
    def publish(cls, draft: ItemDraft, *, item_id: str, owner: Principal, ack: VisibilityAck, now: datetime) -> Self:
        _ensure_publishable(draft)
        return cls(
            id=item_id,
            type=draft.type,
            name=draft.name.strip(),
            blurb=draft.blurb.strip(),
            description=draft.description.strip(),
            icon=draft.icon,
            category=draft.category,
            tags=draft.tags,
            owner_id=owner.user_id,
            owner_name=owner.display_name,
            publisher=(draft.publisher or "").strip() or owner.display_name,
            spec=draft.spec,
            published_at=now,
            listed_at=now,
            visibility_ack=ack,
        )

    def revise(self, draft: ItemDraft, *, by: Principal, now: datetime) -> None:
        self.ensure_owned_by(by)
        _ensure_publishable(draft)
        self.type = draft.type
        self.name = draft.name.strip()
        self.blurb = draft.blurb.strip()
        self.description = draft.description.strip()
        self.icon = draft.icon
        self.category = draft.category
        self.tags = draft.tags
        self.spec = draft.spec
        self.publisher = (draft.publisher or "").strip() or self.owner_name
        self.updated_at = now
        self.edited = True

    def ensure_owned_by(self, principal: Principal) -> None:
        try:
            principal.require_owner_or_admin(self.owner_id)
        except Forbidden as exc:
            raise Forbidden("Only the publisher can change this item.") from exc

    def is_owned_by(self, principal: Principal) -> bool:
        return self.owner_id == principal.user_id

    def searchable_text(self) -> str:
        return " ".join(
            (self.name, self.blurb, self.description, self.owner_name, self.publisher, self.type, *self.tags)
        ).lower()


def _ensure_publishable(draft: ItemDraft) -> None:
    if not draft.type.publishable:
        raise InvalidInput(f"{draft.type} items cannot be published from the portal yet.", code="type_not_publishable")
    draft.validated()
