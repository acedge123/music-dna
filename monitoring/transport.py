"""Bounded TLS operator transport; no redirects or response-body error logging."""
import json
import ssl
from urllib import error, request


class Unavailable(Exception):
    """Stable sanitized code only, never response bodies or credentials."""


class NoRedirect(request.HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        return None


class Http:
    def __init__(self):
        self.opener = request.build_opener(NoRedirect(), request.HTTPSHandler(context=ssl.create_default_context()))

    def json(self, url, token=None, payload=None, extra_headers=None):
        headers = {"Accept": "application/json"}
        if token: headers["Authorization"] = "Bearer " + token
        if extra_headers:
            if set(extra_headers) - {'apikey', 'X-Tenant-Id'}:
                raise ValueError('unexpected_operator_header')
            headers.update(extra_headers)
        body = None
        if payload is not None:
            body = json.dumps(payload).encode()
            headers['Content-Type'] = 'application/json'
        try:
            with self.opener.open(request.Request(url, data=body, headers=headers), timeout=25) as response:
                data = response.read(2_000_001)
                if len(data) > 2_000_000: raise Unavailable('response_too_large')
                return json.loads(data)
        except error.HTTPError as exc:
            raise Unavailable('http_'+str(exc.code)) from None
        except (error.URLError, TimeoutError, OSError):
            raise Unavailable('network_or_tls_failure') from None
        except (ValueError, UnicodeError):
            raise Unavailable('invalid_json') from None
