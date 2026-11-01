from dataclasses import asdict
from typing import Any

from portal_marketplace.domain.model import (
    AgentSpec,
    AppSpec,
    CodingTool,
    ItemSpec,
    ItemType,
    McpAuth,
    McpSpec,
    PluginParts,
    PluginSpec,
    SkillSpec,
)


def spec_to_document(spec: ItemSpec) -> dict[str, Any]:
    return asdict(spec)


def spec_from_document(item_type: ItemType, doc: dict[str, Any]) -> ItemSpec:
    match item_type:
        case ItemType.SKILL:
            return SkillSpec(content=doc["content"], repo=doc["repo"], md_name=doc.get("md_name") or "SKILL.md")
        case ItemType.AGENT:
            return AgentSpec(
                content=doc["content"],
                repo=doc["repo"],
                md_name=doc.get("md_name") or "README.md",
                audience=tuple(doc.get("audience", ())),
                required_tools=tuple(doc.get("required_tools", ())),
            )
        case ItemType.MCP:
            return McpSpec(
                server_url=doc["server_url"],
                auth=McpAuth(doc["auth"]),
                explanation=doc["explanation"],
                repo=doc.get("repo"),
            )
        case ItemType.PLUGIN:
            parts = doc.get("includes", {})
            return PluginSpec(
                repo=doc["repo"],
                version=doc.get("version") or "1.0.0",
                compat=tuple(CodingTool(tool) for tool in doc.get("compat", ())),
                includes=PluginParts(**{kind: tuple(parts.get(kind, ())) for kind in PluginParts.__dataclass_fields__}),
            )
        case ItemType.APP:
            return AppSpec(
                repo=doc["repo"],
                version=doc["version"],
                run_cmd=doc["run_cmd"],
                platforms=tuple(doc.get("platforms", ())),
                works_with=tuple(doc.get("works_with", ())),
                downloads=dict(doc.get("downloads", {})),
            )
