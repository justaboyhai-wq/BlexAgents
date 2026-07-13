# BlexAgent Privacy Notice

Effective date: 2026-07-13

This notice explains the data flows of the BlexAgent desktop application. It is
written for the default official build; a distributor that changes build-time
configuration or connects another service must publish its own accurate notice.

## 1. Local data

BlexAgent is local-first. It stores application configuration, workspace
references, conversations, task state, logs, cached resources, and credentials
needed by enabled integrations on your device, primarily under the BlexAgent
application-data directory (including `~/.blexagent/`). Workspace files remain
where you place them unless a feature or an instruction sends them elsewhere.

Protect your operating-system account and disk. Removing the application may
not automatically remove user-created workspaces or all application data.

## 2. Data sent when you use AI and integrations

When you submit a request, BlexAgent sends the prompt and the context required
for that request to the model provider you selected. Context can include files,
images, tool results, conversation history, and system instructions. Provider
API keys or subscription credentials are sent only as required to authenticate
that provider.

If you enable a Channel, plugin, MCP server, browser action, download, update,
or other integration, the necessary messages and metadata are exchanged with
that third party. Examples include Feishu or DingTalk bots, model providers,
websites, and tool services. Their privacy terms apply independently.

## 3. Product analytics

Analytics is disabled by default. It operates only when an official build sets
all three build-time values: `VITE_ANALYTICS_ENABLED=true`, a non-empty analytics
API key, and an HTTPS analytics endpoint. When enabled, BlexAgent may send
product-event names, coarse platform/app/runtime dimensions, pseudonymous local
identifiers, feature entry points, outcomes, duration, and token/usage totals.

The analytics implementation is not intended to send prompt text, conversation
content, file content, API keys, or integration secrets. A release must not
enable analytics until its event registry and receiving service have completed
privacy review. The official release workflow currently forces analytics off.

## 4. Updates and downloads

The application can contact `download.blexagent.com` to check for updates and to
download signed application or managed-runtime packages. Normal network metadata
such as IP address, user agent, requested file, time, and status may be processed
by the hosting and CDN providers.

## 5. Retention and deletion

Local data remains until you remove it, clear the relevant feature, or uninstall
and delete the application-data directory. Third-party providers retain data
under their own policies. If an official BlexAgent online service is introduced,
its service-specific retention and deletion controls must be documented before
launch.

## 6. Security

BlexAgent uses local process boundaries, restricted management APIs, and signed
release/update mechanisms, but no system is perfectly secure. Keep the app and
operating system updated, use trusted workspaces and tools, and revoke exposed
credentials immediately.

## 7. Children and sensitive uses

BlexAgent is a general-purpose productivity tool and is not designed to collect
children's personal data. Education, health, financial, legal, or other sensitive
uses require appropriate adult or professional review and must follow applicable
law and provider terms. AI output is not professional advice.

## 8. Contact and changes

Questions or privacy requests: team@blexagent.com

Material changes to this notice should be dated and shipped with the applicable
release. Mandatory rights under applicable privacy law are not limited by this
notice.

> Release gate: before enabling any first-party online account, analytics, or
> cloud-sync service, add the controller's registered legal name, address,
> supported request process, retention periods, subprocessors, and regional
> transfer terms approved by counsel.
