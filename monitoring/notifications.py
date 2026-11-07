"""Owner-only Slack delivery through the existing Repo C operator integration."""
import os
import re

from .core import RECIPIENT
from .transport import Http, Unavailable

REPO_C_URL = 'https://rrzewykkwjdkkccwrjyf.supabase.co'
TENANT_ID = '1c625b8e-ad69-4209-aa1c-e4f0745efdbe'


class RepoCSlack:
    def __init__(self, http=None, settings=None):
        self.http = http or Http()
        self.settings = os.environ if settings is None else settings

    def recipient(self):
        # Immutable owner ID was explicitly supplied and verified by the operator.
        # Slack's documented user-ID target opens only that user's 1:1 DM. No
        # workspace member lists, message history, or arbitrary channels are read.
        self.credentials()
        return RECIPIENT

    def credentials(self):
        values = {k: str(self.settings.get(k, '')).strip() for k in ('CIA_URL', 'CIA_ANON_KEY', 'EXECUTOR_SECRET')}
        if not all(values.values()): raise Unavailable('repo_c_credential_not_configured')
        if values['CIA_URL'].rstrip('/') != REPO_C_URL:
            raise Unavailable('repo_c_endpoint_mismatch')
        if any('\r' in v or '\n' in v for v in values.values()):
            raise Unavailable('repo_c_credential_format_invalid')
        return values

    def send(self, channel, text, identifier):
        if channel != RECIPIENT:
            raise Unavailable('slack_recipient_mismatch')
        values = self.credentials()
        response = self.http.json(
            REPO_C_URL+'/functions/v1/internal-execute', values['EXECUTOR_SECRET'],
            {'service': 'slack', 'action': 'chat.postMessage', 'params': {
                'channel': RECIPIENT, 'text': text, 'unfurl_links': False, 'unfurl_media': False,
            }}, extra_headers={'apikey': values['CIA_ANON_KEY'], 'X-Tenant-Id': TENANT_ID},
        )
        if not isinstance(response, dict) or response.get('ok') is not True or response.get('status') != 'success':
            raise Unavailable('repo_c_execution_rejected')
        data = response.get('data')
        if not isinstance(data, dict): raise Unavailable('slack_ambiguous_receipt')
        dm, ts = data.get('channel'), data.get('ts')
        if not isinstance(dm, str) or not re.fullmatch(r'D[A-Z0-9]+', dm) or not isinstance(ts, str) or not re.fullmatch(r'\d+\.\d+', ts):
            raise Unavailable('slack_ambiguous_receipt')
        return {'confirmed': True, 'user_id': RECIPIENT, 'channel_id': dm,
                'message_ts': ts, 'alert_batch': identifier, 'transport': 'repo_c',
                'url': 'https://thegigagency.slack.com/archives/'+dm+'/p'+ts.replace('.', '')}
