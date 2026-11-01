from dataclasses import dataclass
from datetime import datetime

from portal_kit.auth import Principal
from portal_kit.errors import Conflict, InvalidInput

# Bump when the confirmation copy in the UI changes; publishes acknowledged against older copy are rejected.
CURRENT_TEXT_VERSION = "org-wide-v1"


class VisibilityNotAcknowledged(InvalidInput):
    code = "visibility_ack_required"
    default_message = "Publishing requires confirming that the content is visible to the whole organization."


class StaleVisibilityText(Conflict):
    code = "visibility_text_outdated"
    default_message = "The visibility confirmation is out of date. Reload and confirm again."


@dataclass(frozen=True, slots=True)
class VisibilityAck:
    at: datetime
    user_id: str
    text_version: str

    @classmethod
    def confirm(cls, *, confirmed: bool, text_version: str, by: Principal, at: datetime) -> "VisibilityAck":
        if not confirmed:
            raise VisibilityNotAcknowledged()
        if text_version != CURRENT_TEXT_VERSION:
            raise StaleVisibilityText()
        return cls(at=at, user_id=by.user_id, text_version=text_version)

    def to_document(self) -> dict[str, str]:
        return {"at": self.at.isoformat(), "userId": self.user_id, "textVersion": self.text_version}

    @classmethod
    def from_document(cls, document: dict[str, str]) -> "VisibilityAck":
        return cls(datetime.fromisoformat(document["at"]), document["userId"], document["textVersion"])
