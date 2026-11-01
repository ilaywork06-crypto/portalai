from typing import Annotated
from urllib.parse import quote

from fastapi import APIRouter, Depends, Query, Request, Response, UploadFile, status
from fastapi.responses import FileResponse

from portal_community.api.schemas import (
    AttachmentModel,
    FeedOut,
    HelpfulOut,
    PostInput,
    PostOut,
    PublishPostRequest,
    ReplyInput,
    RepostInput,
    feed_out,
    post_out,
)
from portal_community.application.service import CommunityService
from portal_community.domain.feed import FeedOrder, FeedQuery
from portal_community.domain.model import Category
from portal_community.infrastructure.persistence import CommunityUnitOfWork
from portal_community.settings import CommunitySettings
from portal_kit.auth import CurrentPrincipal
from portal_kit.ids import utc_now
from portal_kit.visibility import VisibilityAck

posts = APIRouter(prefix="/posts", tags=["posts"])
uploads = APIRouter(prefix="/uploads", tags=["uploads"])


def community(request: Request) -> CommunityService:
    settings: CommunitySettings = request.app.state.settings
    return CommunityService(
        CommunityUnitOfWork(request.app.state.db.sessions),
        request.app.state.files,
        uploads_url=f"{settings.api_prefix}/uploads/",
        max_upload_bytes=settings.max_upload_bytes,
    )


Service = Annotated[CommunityService, Depends(community)]


@posts.get("", response_model=FeedOut)
async def feed(
    viewer: CurrentPrincipal,
    service: Service,
    category: Category | None = None,
    tag: Annotated[list[str] | None, Query()] = None,
    q: Annotated[str, Query(max_length=200)] = "",
    sort: FeedOrder = FeedOrder.NEWEST,
) -> FeedOut:
    query = FeedQuery(category=category, tags=tuple(tag or ()), text=q, order=sort)
    return feed_out(await service.feed(viewer, query), viewer)


@posts.post("", response_model=PostOut, status_code=status.HTTP_201_CREATED)
async def publish(body: PublishPostRequest, viewer: CurrentPrincipal, service: Service) -> PostOut:
    ack = VisibilityAck.confirm(
        confirmed=body.visibility_ack.confirmed, text_version=body.visibility_ack.text_version, by=viewer, at=utc_now()
    )
    return post_out(await service.publish(viewer, body.post.to_draft(), ack), viewer)


@posts.get("/{post_id}", response_model=PostOut)
async def get_post(post_id: str, viewer: CurrentPrincipal, service: Service) -> PostOut:
    return post_out(await service.get(viewer, post_id), viewer)


@posts.patch("/{post_id}", response_model=PostOut)
async def revise(post_id: str, body: PostInput, viewer: CurrentPrincipal, service: Service) -> PostOut:
    return post_out(await service.revise(viewer, post_id, body.to_draft()), viewer)


@posts.delete("/{post_id}", status_code=status.HTTP_204_NO_CONTENT)
async def remove(post_id: str, viewer: CurrentPrincipal, service: Service) -> Response:
    await service.remove(viewer, post_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@posts.put("/{post_id}/helpful", response_model=HelpfulOut)
async def mark_helpful(post_id: str, viewer: CurrentPrincipal, service: Service) -> HelpfulOut:
    state = await service.mark_helpful(viewer, post_id)
    return HelpfulOut(helpful_count=state.count, viewer_helpful=state.helpful)


@posts.delete("/{post_id}/helpful", response_model=HelpfulOut)
async def unmark_helpful(post_id: str, viewer: CurrentPrincipal, service: Service) -> HelpfulOut:
    state = await service.unmark_helpful(viewer, post_id)
    return HelpfulOut(helpful_count=state.count, viewer_helpful=state.helpful)


@posts.post("/{post_id}/replies", response_model=PostOut, status_code=status.HTTP_201_CREATED)
async def reply(post_id: str, body: ReplyInput, viewer: CurrentPrincipal, service: Service) -> PostOut:
    return post_out(await service.reply(viewer, post_id, body.body), viewer)


@posts.patch("/{post_id}/replies/{reply_id}", response_model=PostOut)
async def edit_reply(
    post_id: str, reply_id: str, body: ReplyInput, viewer: CurrentPrincipal, service: Service
) -> PostOut:
    return post_out(await service.edit_reply(viewer, post_id, reply_id, body.body), viewer)


@posts.delete("/{post_id}/replies/{reply_id}", response_model=PostOut)
async def remove_reply(post_id: str, reply_id: str, viewer: CurrentPrincipal, service: Service) -> PostOut:
    return post_out(await service.remove_reply(viewer, post_id, reply_id), viewer)


@posts.post("/{post_id}/repost", response_model=PostOut, status_code=status.HTTP_201_CREATED)
async def repost(post_id: str, body: RepostInput, viewer: CurrentPrincipal, service: Service) -> PostOut:
    return post_out(await service.repost(viewer, post_id, body.comment), viewer)


@uploads.post("", response_model=AttachmentModel, status_code=status.HTTP_201_CREATED)
async def upload(file: UploadFile, viewer: CurrentPrincipal, service: Service) -> AttachmentModel:
    data = await file.read()
    attachment = await service.upload(
        viewer, name=file.filename or "file", content_type=file.content_type or "", data=data
    )
    return AttachmentModel(kind=attachment.kind, url=attachment.url, name=attachment.name, size=attachment.size)


@uploads.get("/{file_id}", response_class=FileResponse)
async def download(file_id: str, _: CurrentPrincipal, service: Service) -> FileResponse:
    stored, path = await service.download(file_id)
    disposition = "inline" if stored.content_type.startswith("image/") else "attachment"
    return FileResponse(
        path,
        media_type=stored.content_type,
        headers={
            "Content-Disposition": f"{disposition}; filename*=UTF-8''{quote(stored.name)}",
            "Cache-Control": "private, max-age=86400, immutable",
            "X-Content-Type-Options": "nosniff",
        },
    )
