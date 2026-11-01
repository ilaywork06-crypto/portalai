from datetime import datetime
from typing import Annotated, Literal

from pydantic import Field, StringConstraints

from portal_kit.schemas import ApiModel
from portal_marketplace.application.service import CatalogPage, ItemView
from portal_marketplace.domain.model import (
    AgentSpec,
    AppSpec,
    Category,
    CodingTool,
    InstallMethod,
    ItemDraft,
    ItemSpec,
    ItemType,
    McpAuth,
    McpSpec,
    PluginParts,
    PluginSpec,
    SkillSpec,
)

Text = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1)]
Tag = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=40)]
Names = Annotated[list[Tag], Field(default_factory=list, max_length=30)]


class _ItemFields(ApiModel):
    name: Annotated[Text, StringConstraints(max_length=120)]
    blurb: Annotated[Text, StringConstraints(max_length=300)]
    description: Annotated[Text, StringConstraints(max_length=10_000)]
    icon: Annotated[Text, StringConstraints(max_length=40)]
    category: Category
    tags: Names


class SkillInput(_ItemFields):
    type: Literal[ItemType.SKILL]
    content: Annotated[Text, StringConstraints(max_length=100_000)]
    repo: Text
    md_name: str | None = None

    def spec(self) -> SkillSpec:
        return SkillSpec(self.content, self.repo, self.md_name or "SKILL.md")


class AgentInput(_ItemFields):
    type: Literal[ItemType.AGENT]
    content: Annotated[Text, StringConstraints(max_length=100_000)]
    repo: Text
    md_name: str | None = None
    audience: Names
    required_tools: Names

    def spec(self) -> AgentSpec:
        return AgentSpec(
            self.content, self.repo, self.md_name or "README.md", tuple(self.audience), tuple(self.required_tools)
        )


class McpInput(_ItemFields):
    type: Literal[ItemType.MCP]
    server_url: Text
    auth: McpAuth
    explanation: Annotated[Text, StringConstraints(max_length=5_000)]
    repo: str | None = None
    publisher: str | None = None

    def spec(self) -> McpSpec:
        return McpSpec(self.server_url, self.auth, self.explanation, (self.repo or "").strip() or None)


class PluginPartsModel(ApiModel):
    skills: Names
    agents: Names
    commands: Names
    hooks: Names
    mcps: Names


class PluginInput(_ItemFields):
    type: Literal[ItemType.PLUGIN]
    repo: Text
    version: str = "1.0.0"
    compat: Annotated[list[CodingTool], Field(min_length=1)]
    includes: PluginPartsModel

    def spec(self) -> PluginSpec:
        parts = PluginParts(**{kind: tuple(names) for kind, names in self.includes.model_dump().items()})
        return PluginSpec(self.repo, tuple(self.compat), parts, self.version.strip() or "1.0.0")


ItemInput = Annotated[SkillInput | AgentInput | McpInput | PluginInput, Field(discriminator="type")]


def to_draft(body: SkillInput | AgentInput | McpInput | PluginInput) -> ItemDraft:
    return ItemDraft(
        type=body.type,
        name=body.name,
        blurb=body.blurb,
        description=body.description,
        icon=body.icon,
        category=body.category,
        tags=tuple(dict.fromkeys(body.tags)),
        spec=body.spec(),
        publisher=body.publisher if isinstance(body, McpInput) else None,
    )


class VisibilityAckInput(ApiModel):
    confirmed: bool
    text_version: str


class PublishRequest(ApiModel):
    item: ItemInput
    visibility_ack: VisibilityAckInput


class InstallRequest(ApiModel):
    method: InstallMethod


class StarOut(ApiModel):
    stars: int
    viewer_starred: bool


class InstallOut(ApiModel):
    installs: int
    viewer_installed: bool


class PluginPartsOut(ApiModel):
    skills: list[str]
    agents: list[str]
    commands: list[str]
    hooks: list[str]
    mcps: list[str]


class ItemCardOut(ApiModel):
    id: str
    type: ItemType
    name: str
    blurb: str
    icon: str
    category: Category
    tags: list[str]
    owner_name: str
    publisher: str
    verified_by: str | None
    installs: int
    stars: int
    mine: bool
    viewer_starred: bool
    includes: PluginPartsOut | None = None


class ItemOut(ItemCardOut):
    description: str
    published_at: datetime
    updated_at: datetime | None
    edited: bool
    viewer_installed: bool
    repo: str | None = None
    content: str | None = None
    md_name: str | None = None
    audience: list[str] | None = None
    required_tools: list[str] | None = None
    server_url: str | None = None
    auth: McpAuth | None = None
    explanation: str | None = None
    version: str | None = None
    compat: list[CodingTool] | None = None
    platforms: list[str] | None = None
    works_with: list[str] | None = None
    run_cmd: str | None = None
    downloads: dict[str, str] | None = None


class FacetsOut(ApiModel):
    categories: list[Category]
    tags: list[tuple[str, int]]


class CatalogOut(ApiModel):
    items: list[ItemCardOut]
    facets: FacetsOut
    mine_count: int


def _parts(spec: ItemSpec) -> PluginPartsOut | None:
    if not isinstance(spec, PluginSpec):
        return None
    p = spec.includes
    return PluginPartsOut(
        skills=[*p.skills], agents=[*p.agents], commands=[*p.commands], hooks=[*p.hooks], mcps=[*p.mcps]
    )


def _card_fields(view: ItemView) -> dict[str, object]:
    item = view.item
    return {
        "id": item.id,
        "type": item.type,
        "name": item.name,
        "blurb": item.blurb,
        "icon": item.icon,
        "category": item.category,
        "tags": list(item.tags),
        "owner_name": item.owner_name,
        "publisher": item.publisher,
        "verified_by": item.verified_by,
        "installs": item.installs,
        "stars": item.stars,
        "mine": view.mine,
        "viewer_starred": view.starred,
        "includes": _parts(item.spec),
    }


def _spec_fields(spec: ItemSpec) -> dict[str, object]:
    match spec:
        case SkillSpec():
            return {"content": spec.content, "repo": spec.repo, "md_name": spec.md_name}
        case AgentSpec():
            return {
                "content": spec.content,
                "repo": spec.repo,
                "md_name": spec.md_name,
                "audience": list(spec.audience),
                "required_tools": list(spec.required_tools),
            }
        case McpSpec():
            return {
                "server_url": spec.server_url,
                "auth": spec.auth,
                "explanation": spec.explanation,
                "repo": spec.repo,
            }
        case PluginSpec():
            return {"repo": spec.repo, "version": spec.version, "compat": list(spec.compat)}
        case AppSpec():
            return {
                "repo": spec.repo,
                "version": spec.version,
                "platforms": list(spec.platforms),
                "works_with": list(spec.works_with),
                "run_cmd": spec.run_cmd,
                "downloads": spec.downloads,
            }


def card_out(view: ItemView) -> ItemCardOut:
    return ItemCardOut.model_validate(_card_fields(view))


def item_out(view: ItemView) -> ItemOut:
    item = view.item
    return ItemOut.model_validate(
        _card_fields(view)
        | _spec_fields(item.spec)
        | {
            "description": item.description,
            "published_at": item.published_at,
            "updated_at": item.updated_at,
            "edited": item.edited,
            "viewer_installed": view.installed,
        }
    )


def catalog_out(page: CatalogPage) -> CatalogOut:
    return CatalogOut(
        items=[card_out(view) for view in page.items],
        facets=FacetsOut(categories=list(page.facets.categories), tags=list(page.facets.tags)),
        mine_count=page.mine_count,
    )
