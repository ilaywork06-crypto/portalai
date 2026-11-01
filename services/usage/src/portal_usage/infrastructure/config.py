import json
from importlib.resources import files
from pathlib import Path
from typing import Any

from portal_usage.domain.config import CodingTool, ModelPricing, Tier, UsageConfig


def load_config(path: Path | None = None) -> UsageConfig:
    """The environment config lives with the deployment; the packaged file holds the Leg 1 defaults."""
    text = (
        path.read_text(encoding="utf-8")
        if path
        else files(__package__).joinpath("usage_config.json").read_text("utf-8")
    )
    raw: dict[str, Any] = json.loads(text)
    return UsageConfig(
        work_days=tuple(raw["workDays"]),
        work_start=raw["workStart"],
        work_end=raw["workEnd"],
        peaks=tuple((a, b) for a, b in raw["peaks"]),
        daily_pct=raw["dailyPct"],
        weekly_pct=raw["weeklyPct"],
        smart_quiet=raw["smartQuiet"],
        smart_strong=raw["smartStrong"],
        premium_warn=raw["premiumWarn"],
        input_share=raw["inputShare"],
        show_names=raw.get("showNames", True),
        default_range=raw.get("defaultRange", 30),
        retention_days=raw.get("retentionDays", 180),
        models=tuple(
            ModelPricing(m["id"], m["name"], m["provider"], m["tier"], m["in"], m["out"], m.get("enabled", True))
            for m in raw["models"]
        ),
        tools=tuple(CodingTool(t["id"], t["name"], t["icon"], t.get("enabled", True)) for t in raw["tools"]),
        tiers={int(k): Tier(v["label"], v["sign"], v["hint"]) for k, v in raw["tiers"].items()},
    )
