import copy
import unittest
from urllib import error

from monitoring.core import RECIPIENT
from monitoring.notifications import RepoCSlack, REPO_C_URL, TENANT_ID
from monitoring.transport import Http, NoRedirect, Unavailable

SETTINGS = {'CIA_URL': REPO_C_URL, 'CIA_ANON_KEY': 'fake-anon', 'EXECUTOR_SECRET': 'fake-operator'}


class FakeHttp:
    def __init__(self, response=None):
        self.calls = []
        self.response = response if response is not None else {'ok': True, 'status': 'success', 'data': {'channel': 'D123', 'ts': '1794034615.123456'}}

    def json(self, url, token=None, payload=None, extra_headers=None):
        self.calls.append((url, token, payload, extra_headers))
        return self.response


class RepoCNotificationTests(unittest.TestCase):
    def test_fixed_operator_tenant_action_recipient_and_confirmed_receipt(self):
        http = FakeHttp(); sender = RepoCSlack(http, SETTINGS)
        self.assertEqual(sender.recipient(), RECIPIENT)
        receipt = sender.send(RECIPIENT, 'numeric evidence', 'batch')
        self.assertTrue(receipt['confirmed'])
        self.assertEqual(receipt['transport'], 'repo_c')
        self.assertEqual(receipt['user_id'], RECIPIENT)
        url, secret, body, headers = http.calls[0]
        self.assertEqual(url, REPO_C_URL+'/functions/v1/internal-execute')
        self.assertEqual(secret, 'fake-operator')
        self.assertEqual(headers, {'apikey': 'fake-anon', 'X-Tenant-Id': TENANT_ID})
        self.assertEqual(body, {'service':'slack','action':'chat.postMessage','params':{'channel':RECIPIENT,'text':'numeric evidence','unfurl_links':False,'unfurl_media':False}})
        self.assertNotIn('fake-operator', str(receipt))
        self.assertNotIn('fake-anon', str(receipt))

    def test_no_arbitrary_users_or_channel_destinations(self):
        http = FakeHttp(); sender = RepoCSlack(http, SETTINGS)
        for wrong in ('UOTHER', 'C123', 'G123', 'D123'):
            with self.assertRaisesRegex(Unavailable, 'slack_recipient_mismatch'):
                sender.send(wrong, 'message', 'batch')
        self.assertFalse(http.calls)

    def test_missing_credentials_and_unapproved_endpoint_fail_before_sending(self):
        for key in SETTINGS:
            settings = dict(SETTINGS); settings[key] = ''
            with self.assertRaisesRegex(Unavailable, 'repo_c_credential_not_configured'):
                RepoCSlack(FakeHttp(), settings).recipient()
        settings = dict(SETTINGS, CIA_URL='https://elsewhere.example')
        with self.assertRaisesRegex(Unavailable, 'repo_c_endpoint_mismatch'):
            RepoCSlack(FakeHttp(), settings).recipient()

    def test_outer_whitespace_normalized_but_embedded_newline_rejected(self):
        sender = RepoCSlack(FakeHttp(), {k:' '+v+'\n' for k,v in SETTINGS.items()})
        self.assertEqual(sender.recipient(), RECIPIENT)
        settings = dict(SETTINGS, EXECUTOR_SECRET='part\npart')
        with self.assertRaisesRegex(Unavailable, 'repo_c_credential_format_invalid'):
            RepoCSlack(FakeHttp(), settings).recipient()

    def test_unconfirmed_or_public_receipts_rejected(self):
        valid = FakeHttp().response
        for data in ({'channel':'C123','ts':'1.2'}, {'channel':'D123'}, {'channel':'D123','ts':'bad'}, None):
            response = copy.deepcopy(valid); response['data'] = data
            with self.assertRaisesRegex(Unavailable, 'slack_ambiguous_receipt'):
                RepoCSlack(FakeHttp(response), SETTINGS).send(RECIPIENT, 'message', 'batch')
        for response in ({'ok':False,'error_message_redacted':'sensitive provider body'}, {'ok':True,'status':'error'}, []):
            with self.assertRaisesRegex(Unavailable, '^repo_c_execution_rejected$'):
                RepoCSlack(FakeHttp(response), SETTINGS).send(RECIPIENT, 'message', 'batch')

    def test_transport_rejects_redirect_and_header_override(self):
        self.assertIsNone(NoRedirect().redirect_request(None,None,302,'',None,'https://elsewhere.example'))
        with self.assertRaisesRegex(ValueError, 'unexpected_operator_header'):
            Http().json(REPO_C_URL, 'secret', {}, {'Authorization':'override'})

    def test_transport_http_error_never_contains_body_or_credentials(self):
        class Opener:
            def open(self, *args, **kwargs):
                raise error.HTTPError('https://example.test', 500, 'sensitive body', {}, None)
        http = Http(); http.opener = Opener()
        with self.assertRaisesRegex(Unavailable, '^http_500$'):
            http.json(REPO_C_URL, 'secret')


if __name__ == '__main__': unittest.main()
