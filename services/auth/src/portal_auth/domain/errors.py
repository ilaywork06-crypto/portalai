from portal_kit.errors import InvalidInput, NotFound, Unauthorized


class InvalidCredentials(Unauthorized):
    code = "invalid_credentials"
    default_message = "The username or password is incorrect."


class SsoFailed(Unauthorized):
    code = "sso_failed"
    default_message = "Single sign-on could not be completed."


class SsoUnavailable(NotFound):
    code = "sso_unavailable"
    default_message = "Single sign-on is turned off; sign in with a username and password."


class UnsafeRedirect(InvalidInput):
    code = "unsafe_redirect"
    default_message = "The redirect target is not allowed."
