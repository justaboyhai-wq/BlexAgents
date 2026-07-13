# Open-source attribution

This offline template is a reviewed adaptation, not an unmodified upstream distribution. Source files are pinned and hashed below.

## Selected sources

1. natea/ExoMind at 8794d26d9a334ff386d0fe4b90b4919b95ac201a
   - Repository: https://github.com/natea/ExoMind
   - Source: skills/analyzing-schedule/SKILL.md
   - SHA-256: 9abbbe26104c4d36ff75deaeec63f753c8f564a2e7d27e575e83ff7e3ecf154e
   - License: MIT; bundled at licenses/exomind-MIT.txt
   - Adaptation: Retained time categorization, capacity, focus, buffers, priority alignment, and energy-fit analysis; removed MCP calendar retrieval, automatic metrics, and burnout diagnosis.

2. natea/ExoMind at 8794d26d9a334ff386d0fe4b90b4919b95ac201a
   - Repository: https://github.com/natea/ExoMind
   - Source: skills/scheduling-tasks/SKILL.md
   - SHA-256: 387c05e82084eb235717fe49ee4eb914f86616f581a6a6b85d40b2531f017af9
   - License: MIT; bundled at licenses/exomind-MIT.txt
   - Adaptation: Retained task sizing, priority order, time blocking, batching, capacity checks, buffers, and review; removed task/calendar writes and integrations.

## Security and product changes

Only prose workflows were retained. External MCP calls, command-line steps, scripts, automatic tracking, notifications, and vendor-specific integrations were removed. The installed workspace contains only Markdown and YAML files.

Upstream projects and authors do not endorse BlexAgent. Their MIT license notices are preserved in the bundled license files.
