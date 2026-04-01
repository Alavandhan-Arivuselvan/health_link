import os
os.environ['OAUTHLIB_INSECURE_TRANSPORT'] = '1'  # Keep this for localhost http

from requests_oauthlib import OAuth2Session
from oauthlib.oauth2 import MobileApplicationClient
import webbrowser
import urllib.parse

# === YOUR VALUES ===
CLIENT_ID = "23V5R5"  # Your Client ID
REDIRECT_URI = "http://127.0.0.1:8080/"  # Exact match from your app settings

SCOPE = ["activity", "heartrate", "sleep", "profile"]

# Use MobileApplicationClient for Fitbit Personal / Implicit-like flow
client = MobileApplicationClient(client_id=CLIENT_ID)
fitbit = OAuth2Session(client=client, scope=SCOPE, redirect_uri=REDIRECT_URI)

authorization_url, state = fitbit.authorization_url("https://www.fitbit.com/oauth2/authorize")

print("Opening browser for authorization...")
print("Authorize the app, then copy the FULL URL from the browser address bar")
print("(It will look like: http://127.0.0.1:8080/#access_token=...&expires_in=... )")
webbrowser.open(authorization_url)

# After approval → browser redirects with token in FRAGMENT (#...)
redirect_response = input("\nPaste the full redirect URL here: ")

# Parse the fragment manually (this is the key for Implicit flow)
parsed = urllib.parse.urlparse(redirect_response)
fragment_params = urllib.parse.parse_qs(parsed.fragment)

token = {
    'access_token': fragment_params.get('access_token', [None])[0],
    'token_type': fragment_params.get('token_type', [None])[0],
    'expires_in': fragment_params.get('expires_in', [None])[0],
    'scope': fragment_params.get('scope', [None])[0],
    'user_id': fragment_params.get('user_id', [None])[0],
}

print("\n=== SUCCESS! Copy and save these ===\n")
print("Access Token:", token['access_token'])
print("Expires in (seconds):", token['expires_in'])
print("Scope:", token['scope'])
print("User ID:", token['user_id'])
print("\nFull parsed token:", token)

# Note: Personal apps often do NOT return refresh_token in Implicit flow.
# If you need long-lived access, you may need to re-authorize periodically (every ~8 hours),
# or switch to code flow with PKCE (more complex).