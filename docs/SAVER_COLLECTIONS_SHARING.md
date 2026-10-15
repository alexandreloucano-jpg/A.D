# Saver collections and iPhone capture

Collections are an additive sidecar to existing references. Authenticated collections use the existing private ad_records table under an owner-scoped namespace with revision compare-and-swap, ownership validation, CSRF, quota, audit and readback. Local collections stay under ad.saver.collections.v1 and are not silently uploaded. There are no schema migrations or changes to Sites.

A reference can belong to multiple manual groups. Grok proposals can be pasted as JSON, checked against accessible reference IDs, previewed, and explicitly approved. The copy action includes only displayed titles and IDs; it does not send anything automatically. No AI provider or live Grok connection is claimed. No tasks or confirmed preferences are created.

On iPhone, a user-created Shortcut accepts URLs/text from the share sheet, URL-encodes its input and opens:

`https://ad-saver-reader-beta-alexandreloucano-3399.vercel.app/#/saver?share=1&text=ENCODED_INPUT`

Saver opens a draft and requires Save. The fragment is not sent as an HTTP query. Oversized inputs, credential-bearing URLs and non-HTTP(S) URLs are rejected. Incoming drafts use a separate namespace from manual drafts. The in-app guide explains the Shortcut steps. This is not an installed native iOS share extension; an actual iPhone execution has not been verified.

A shared X/Instagram URL is a source pointer, not a fetched article or private-media import. Automatic access to private X bookmarks requires an authorized data connection that is not configured. The historical Grok Scout read gateway returned an internal error during verification.

Gloss was inspected at 54b13b8882d8a109132c5b2045acd6b45628563d. Its import code describes article/PDF/text import; no authenticated X bookmark importer was found in the inspected files. A license was not established at that commit; no Gloss code or assets were copied.
