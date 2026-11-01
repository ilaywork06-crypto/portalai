from typing import Annotated

from fastapi import APIRouter, Body, Depends, Query, Request, Response, status

from portal_kit.auth import CurrentPrincipal
from portal_kit.ids import utc_now
from portal_kit.visibility import VisibilityAck
from portal_marketplace.api.schemas import (
    CatalogOut,
    InstallOut,
    InstallRequest,
    ItemInput,
    ItemOut,
    PublishRequest,
    StarOut,
    catalog_out,
    item_out,
    to_draft,
)
from portal_marketplace.application.service import MarketplaceService
from portal_marketplace.domain.catalog import CatalogQuery, SortOrder
from portal_marketplace.domain.model import Category, ItemType
from portal_marketplace.infrastructure.persistence import MarketplaceUnitOfWork

router = APIRouter(prefix="/market", tags=["marketplace"])


def marketplace(request: Request) -> MarketplaceService:
    return MarketplaceService(MarketplaceUnitOfWork(request.app.state.db.sessions))


Service = Annotated[MarketplaceService, Depends(marketplace)]


@router.get("", response_model=CatalogOut)
async def browse(
    viewer: CurrentPrincipal,
    service: Service,
    item_type: Annotated[ItemType | None, Query(alias="type")] = None,
    category: Annotated[list[Category] | None, Query()] = None,
    tag: Annotated[list[str] | None, Query()] = None,
    q: Annotated[str, Query(max_length=200)] = "",
    sort: SortOrder = SortOrder.NEWEST,
    mine: bool = False,
) -> CatalogOut:
    if mine:
        return catalog_out(await service.uploads(viewer))
    query = CatalogQuery(type=item_type, categories=frozenset(category or ()), tags=tuple(tag or ()), text=q, sort=sort)
    return catalog_out(await service.catalog(viewer, query))


@router.post("", response_model=ItemOut, status_code=status.HTTP_201_CREATED)
async def publish(body: PublishRequest, viewer: CurrentPrincipal, service: Service) -> ItemOut:
    ack = VisibilityAck.confirm(
        confirmed=body.visibility_ack.confirmed, text_version=body.visibility_ack.text_version, by=viewer, at=utc_now()
    )
    return item_out(await service.publish(viewer, to_draft(body.item), ack))


@router.get("/{item_id}", response_model=ItemOut)
async def get_item(item_id: str, viewer: CurrentPrincipal, service: Service) -> ItemOut:
    return item_out(await service.get(viewer, item_id))


@router.patch("/{item_id}", response_model=ItemOut)
async def revise(
    item_id: str, body: Annotated[ItemInput, Body()], viewer: CurrentPrincipal, service: Service
) -> ItemOut:
    return item_out(await service.revise(viewer, item_id, to_draft(body)))


@router.delete("/{item_id}", status_code=status.HTTP_204_NO_CONTENT)
async def remove(item_id: str, viewer: CurrentPrincipal, service: Service) -> Response:
    await service.remove(viewer, item_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.put("/{item_id}/star", response_model=StarOut)
async def star(item_id: str, viewer: CurrentPrincipal, service: Service) -> StarOut:
    state = await service.star(viewer, item_id)
    return StarOut(stars=state.stars, viewer_starred=state.starred)


@router.delete("/{item_id}/star", response_model=StarOut)
async def unstar(item_id: str, viewer: CurrentPrincipal, service: Service) -> StarOut:
    state = await service.unstar(viewer, item_id)
    return StarOut(stars=state.stars, viewer_starred=state.starred)


@router.post("/{item_id}/install", response_model=InstallOut)
async def install(item_id: str, body: InstallRequest, viewer: CurrentPrincipal, service: Service) -> InstallOut:
    state = await service.record_install(viewer, item_id, body.method)
    return InstallOut(installs=state.installs, viewer_installed=state.installed)


@router.get("/{item_id}/zip", response_class=Response)
async def download_zip(item_id: str, viewer: CurrentPrincipal, service: Service) -> Response:
    archive = await service.archive(viewer, item_id)
    return Response(
        archive.content,
        media_type="application/zip",
        headers={"Content-Disposition": f'attachment; filename="{archive.filename}"'},
    )
