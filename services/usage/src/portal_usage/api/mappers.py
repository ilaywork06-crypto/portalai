from portal_kit.auth import Principal
from portal_usage.api.schemas import (
    ChildRowOut,
    ConfigOut,
    DataRangeOut,
    LoadOut,
    MemberOut,
    MemberRefOut,
    ModelOut,
    ModelUsageOut,
    NodeOut,
    NodeRefOut,
    NodeReportOut,
    OrganizationOut,
    PersonalReportOut,
    PersonalStatsOut,
    SeriesOut,
    TierOut,
    ToolOut,
    TotalsOut,
    UserRowOut,
    WindowOut,
)
from portal_usage.application.service import NodeReport, PersonalReport, display_name
from portal_usage.domain.config import UsageConfig
from portal_usage.domain.metrics import Aggregate, MemberStats, UsageEngine
from portal_usage.domain.org import OrgNode, UsageDataset
from portal_usage.domain.window import Window


def window_out(dataset: UsageDataset, window: Window) -> WindowOut:
    first, last = window.bounds()
    days = range(first, last + 1)
    return WindowOut(
        start=dataset.dates[first],
        end=dataset.dates[last],
        start_hour=window.start_hour,
        end_hour=window.end_hour,
        days=window.length,
        dates=[dataset.dates[d] for d in days],
        weekdays=[dataset.weekdays[d] for d in days],
        is_latest=last == dataset.last_day,
    )


def totals_out(a: Aggregate) -> TotalsOut:
    return TotalsOut(
        users=a.users,
        requests=a.requests,
        tokens=a.tokens,
        cost=a.cost,
        quiet_requests=a.quiet_requests,
        quiet_cost=a.quiet_cost,
        quiet_share=a.quiet_share,
        peak_share=a.peak_share,
        strong_share=a.strong_share,
        installed=a.installed,
        first_request=a.first_request,
        weekly_active=a.weekly_active,
        daily_active=a.daily_active,
        smart=a.smart,
        active=a.active,
    )


def series_out(a: Aggregate) -> SeriesOut:
    return SeriesOut(
        requests=list(a.requests_series),
        tokens=list(a.tokens_series),
        cost=list(a.cost_series),
        quiet_requests=list(a.quiet_requests_series),
        quiet_tokens=list(a.quiet_tokens_series),
        quiet_cost=list(a.quiet_cost_series),
    )


def by_model_out(a: Aggregate) -> list[ModelUsageOut]:
    return [ModelUsageOut(model_id=m.model_id, requests=m.requests, tokens=m.tokens, cost=m.cost) for m in a.by_model]


def _stats_out(s: MemberStats) -> PersonalStatsOut:
    return PersonalStatsOut(
        active_days=s.active_days,
        eligible_days=s.eligible_days,
        workday_active=s.workday_active,
        workday_eligible=s.workday_eligible,
        daily=s.daily,
        strong_share=s.strong_share,
    )


def personal_report_out(report: PersonalReport, viewer: Principal) -> PersonalReportOut:
    engine, member = report.engine, report.member
    dataset, config = engine.dataset, engine.config
    return PersonalReportOut(
        window=window_out(dataset, report.window),
        member=MemberOut(
            id=member.id,
            name=display_name(member, viewer=viewer, show_names=config.show_names),
            role=member.role,
            team_id=member.team_id,
            unit_path=[node.name for node in dataset.path(member.team_id)[1:]],
            tools=list(member.tools),
            is_me=member.id == viewer.user_id,
        ),
        current=totals_out(report.current),
        previous=totals_out(report.previous),
        series=series_out(report.current),
        by_model=by_model_out(report.current),
        load=LoadOut(hourly=engine.hourly_load(report.current), weekday=engine.weekday_load(report.current)),
        stats=_stats_out(report.current.rows[0]),
        previous_stats=_stats_out(report.previous.rows[0]),
        organization=OrganizationOut(
            daily_active=report.organization.daily_active, hourly=engine.hourly_load(report.organization)
        ),
    )


def _ref(node: OrgNode) -> NodeRefOut:
    return NodeRefOut(id=node.id, name=node.name, level=node.level, level_name=node.level_name)


def _user_row(engine: UsageEngine, s: MemberStats, previous: MemberStats, viewer: Principal) -> UserRowOut:
    dataset, member = engine.dataset, s.member
    return UserRowOut(
        id=member.id,
        name=display_name(member, viewer=viewer, show_names=engine.config.show_names),
        role=member.role,
        team_id=member.team_id,
        team_name=dataset.nodes[member.team_id].name,
        section_name=dataset.section_of(member).name,
        is_me=member.id == viewer.user_id,
        tools=list(member.tools),
        active_days=s.active_days,
        eligible_days=s.eligible_days,
        requests=s.requests,
        tokens=s.tokens,
        cost=s.cost,
        quiet_requests=s.quiet_requests,
        strong_share=s.strong_share,
        daily_requests=list(s.daily_requests),
        previous_cost=previous.cost,
    )


def node_report_out(report: NodeReport, viewer: Principal) -> NodeReportOut:
    engine, node = report.engine, report.node
    dataset = engine.dataset
    members = [m for m in (dataset.member(i) for i in dataset.member_ids_under(node.id)) if m]
    return NodeReportOut(
        window=window_out(dataset, report.window),
        node=NodeOut(
            id=node.id,
            name=node.name,
            level=node.level,
            level_name=node.level_name,
            child_level_name=node.child_level_plural,
            path=[_ref(n) for n in report.path],
            children=[_ref(dataset.nodes[c]) for c in node.children],
            members=[
                MemberRefOut(id=m.id, name=display_name(m, viewer=viewer, show_names=engine.config.show_names))
                for m in members
            ],
        ),
        current=totals_out(report.current),
        previous=totals_out(report.previous),
        series=series_out(report.current),
        by_model=by_model_out(report.current),
        heatmap=engine.cost_heatmap(report.current),
        children=[
            ChildRowOut(
                id=child.node.id,
                name=child.node.name,
                users=child.current.users,
                installed=child.current.installed,
                daily_active=child.current.daily_active,
                active=child.current.active,
                cost=child.current.cost,
                tokens=child.current.tokens,
                quiet_share=child.current.quiet_share,
                cost_series=list(child.current.cost_series),
                previous_cost=child.previous.cost,
            )
            for child in report.children
        ],
        users=[_user_row(engine, s, p, viewer) for s, p in zip(report.current.rows, report.previous.rows, strict=True)],
    )


def config_out(config: UsageConfig, dataset: UsageDataset) -> ConfigOut:
    return ConfigOut(
        work_days=list(config.work_days),
        work_start=config.work_start,
        work_end=config.work_end,
        peaks=list(config.peaks),
        daily_pct=config.daily_pct,
        weekly_pct=config.weekly_pct,
        smart_quiet=config.smart_quiet,
        smart_strong=config.smart_strong,
        premium_warn=config.premium_warn,
        default_range=config.default_range,
        models=[
            ModelOut(
                id=m.id,
                name=m.name,
                provider=m.provider,
                tier=m.tier,
                input=m.input_per_m,
                output=m.output_per_m,
                blended=config.blended_rate(m),
                enabled=m.enabled,
            )
            for m in config.models
        ],
        tools=[ToolOut(id=t.id, name=t.name, icon=t.icon, enabled=t.enabled) for t in config.tools],
        tiers={str(k): TierOut(label=t.label, sign=t.sign, hint=t.hint) for k, t in config.tiers.items()},
        data=DataRangeOut(first=dataset.dates[0], last=dataset.dates[-1]),
    )
