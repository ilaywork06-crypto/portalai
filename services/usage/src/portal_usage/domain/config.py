from dataclasses import dataclass


@dataclass(frozen=True, slots=True)
class ModelPricing:
    id: str
    name: str
    provider: str
    tier: int
    input_per_m: float
    output_per_m: float
    enabled: bool = True


@dataclass(frozen=True, slots=True)
class CodingTool:
    id: str
    name: str
    icon: str
    enabled: bool = True


@dataclass(frozen=True, slots=True)
class Tier:
    label: str
    sign: str
    hint: str


@dataclass(frozen=True, slots=True)
class UsageConfig:
    work_days: tuple[int, ...]
    work_start: int
    work_end: int
    peaks: tuple[tuple[int, int], ...]
    daily_pct: int
    weekly_pct: int
    smart_quiet: int
    smart_strong: int
    premium_warn: int
    input_share: int
    models: tuple[ModelPricing, ...]
    tools: tuple[CodingTool, ...]
    tiers: dict[int, Tier]
    show_names: bool = True
    default_range: int = 30
    retention_days: int = 180

    def blended_rate(self, model: ModelPricing) -> float:
        """$ per 1M tokens for the typical coding-tool mix of input and output."""
        mix = self.input_share / 100
        return mix * model.input_per_m + (1 - mix) * model.output_per_m

    @property
    def strongest_model(self) -> ModelPricing:
        return max(self.models, key=lambda m: m.tier)
