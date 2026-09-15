# Google OAuth AI/ML Limited Use response

Use this document to answer the Third Party Data Safety Team. Keep the response in
English and reply in the existing verification email thread.

## Audited architecture

- The in-product **MakersHub Assistant** does not use AI/ML. It is a deterministic
  rules engine executed locally in the user's browser. It makes no model or third-party
  network request.
- MakersHub offers an optional remote MCP server that users may connect to OpenAI
  ChatGPT or Anthropic Claude. MakersHub does not call a model API, select an upstream
  model or hold an OpenAI or Anthropic API key. The user's own client and account invoke
  MCP tools.
- Google Calendar linked events are excluded at the Postgres RPC boundary from every
  MCP read. MCP update and delete operations reject those event IDs. This applies to raw,
  aggregated, anonymized and derived Google data, and remains in force after disconnect
  because synchronization mappings are retained.
- The MCP Worker has no database service-role credential and cannot read the protected
  Google Calendar mapping table directly. It can call only the tenant-scoped `mcp_*`
  functions exposed through the Supabase publishable key.
- Google data is processed only by Google Calendar, Cloudflare Workers and Supabase to
  provide the user-requested calendar synchronization feature. It is never included in
  MCP payloads sent to an AI client.

## Third-party AI integrations

- **ChatGPT — OpenAI:** the user connects the MakersHub remote MCP server from their
  own ChatGPT account. MakersHub has no OpenAI account, subscription or API project for
  this integration. The user's eligible ChatGPT plan is external to MakersHub. MakersHub
  selects no upstream model and calls no OpenAI API endpoint.
- **Claude — Anthropic:** the user connects the MakersHub remote MCP server from their
  own Claude account or client. MakersHub has no Anthropic account, subscription or API
  project for this integration. The user's eligible Claude plan is external to MakersHub.
  MakersHub selects no upstream model and calls no Anthropic API endpoint.

There is no aggregator, gateway, model hub, self-hosted model, offline model, fine-tuning
endpoint or model-training pipeline in MakersHub.

## Reply draft

Hello Third Party Data Safety Team,

Thank you for the review. We completed a code and data-flow audit and implemented an
auditable isolation boundary for Google Workspace data.

MakersHub does not use any raw, aggregated, anonymized, or derived Google Workspace API
data to create, train, or improve generalized or foundational AI/ML models. We also do
not transfer Google Workspace API data to any third-party AI/ML service.

Our product contains a feature named “MakersHub Assistant.” Despite the name, this is
not an AI/ML model. It is a deterministic rules engine that runs locally in the user's
browser and makes no external model request.

MakersHub also provides an optional remote MCP server that users can connect from their
own AI client. The complete list of advertised AI clients is:

1. OpenAI — ChatGPT. The user connects through their own eligible ChatGPT account and
   plan. MakersHub has no OpenAI subscription or API project for this integration, holds
   no OpenAI API key, calls no OpenAI model endpoint, and selects no upstream model.
2. Anthropic — Claude. The user connects through their own eligible Claude account and
   plan. MakersHub has no Anthropic subscription or API project for this integration,
   holds no Anthropic API key, calls no Anthropic model endpoint, and selects no upstream
   model.

There are no aggregators, gateways, model hubs, downstream model providers, self-hosted
models, offline models, fine-tuning endpoints, or model-training pipelines in MakersHub.

To make the separation complete and auditable, events that are or have been linked to
Google Calendar are now excluded at the database RPC boundary from all MCP reads.
MCP update and delete operations also reject those event IDs. The MCP Worker cannot read
the protected Google Calendar mapping table directly. Consequently, Google Workspace
data and information derived from it are never included in payloads returned to ChatGPT,
Claude, or any other AI client.

We updated our public Privacy Policy at
https://makershub.app.br/privacidade with an affirmative Limited Use statement and an
explicit explanation of the technical separation. It states that our use of raw or
derived data received from Google Workspace APIs adheres to the Google User Data Policy,
including the Limited Use requirements.

The calendar synchronization remains a user-facing feature implemented only between
MakersHub, Google Calendar, Cloudflare Workers, and Supabase. Cloudflare and Supabase
process the data solely as infrastructure providers on our behalf.

Please continue the verification review. We can provide the relevant migration,
contract test, or a replacement demonstration video showing the separation if required.

Best regards,

MakersHub / Rastro Visual LTDA

## Provider policy references

- OpenAI business products and API data are excluded from model training by default:
  <https://openai.com/business-data/>
- Anthropic states that Claude for Work and API data are not used to train generative
  models: <https://support.anthropic.com/en/articles/9267385-does-anthropic-act-as-a-data-processor-or-controller>
- Google application use cases and AI/ML Limited Use guidance:
  <https://support.google.com/cloud/answer/13805798>
