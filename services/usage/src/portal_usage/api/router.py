from datetime import datetime
from typing import Annotated

from fastapi import APIRouter, Depends, Query, Request

from portal_kit.auth import CurrentPrincipal
from portal_usage.api.mappers import config_out, node_report_out, personal_report_out
from portal_usage.api.schemas import ConfigOut, NodeReportOut, OrgTreeOut, PersonalReportOut, ScopeOut
from portal_usage.application.service import PeriodRequest, UsageService
from portal_usage.domain.window import DaysFilter, Filters, HoursFilter

router = APIRouter(tags=["usage"])


def usage(request: Request) -> UsageService:
    return UsageService(request.app.state.engines)


def period(
    days: Annotated[int | None, Query(alias="range")] = None,
    start: Annotated[datetime | None, Query(alias="from")] = None,
    end: Annotated[datetime | None, Query(alias="to")] = None,
    hours: HoursFilter = HoursFilter.ALL,
    days_filter: Annotated[DaysFilter, Query(alias="days")] = DaysFilter.ALL,
) -> PeriodRequest:
    return PeriodRequest(days=days, start=start, end=end, filters=Filters(hours=hours, days=days_filter))


Service = Annotated[UsageService, Depends(usage)]
Period = Annotated[PeriodRequest, Depends(period)]


@router.get("/usage/config", response_model=ConfigOut)
async def get_config(_: CurrentPrincipal, service: Service) -> ConfigOut:
    config, dataset = await service.config()
    return config_out(config, dataset)


@router.get("/org/tree", response_model=OrgTreeOut)
async def org_tree(viewer: CurrentPrincipal, service: Service) -> OrgTreeOut:
    scopes = await service.scopes(viewer)
    return OrgTreeOut(
        scopes=[
            ScopeOut(id=s.node.id, name=s.node.name, level=s.node.level, level_name=s.node.level_name, users=s.users)
            for s in scopes
        ]
    )


@router.get("/usage/me", response_model=PersonalReportOut)
async def my_usage(viewer: CurrentPrincipal, service: Service, when: Period) -> PersonalReportOut:
    return personal_report_out(await service.my_usage(viewer, when), viewer)


@router.get("/usage/users/{member_id}", response_model=PersonalReportOut)
async def member_usage(member_id: str, viewer: CurrentPrincipal, service: Service, when: Period) -> PersonalReportOut:
    return personal_report_out(await service.member_usage(viewer, member_id, when), viewer)


@router.get("/usage/nodes/{node_id}", response_model=NodeReportOut)
async def node_usage(node_id: str, viewer: CurrentPrincipal, service: Service, when: Period) -> NodeReportOut:
    return node_report_out(await service.node_usage(viewer, node_id, when), viewer)
