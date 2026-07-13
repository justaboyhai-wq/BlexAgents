# Open-source attribution

This offline template is a reviewed adaptation, not an unmodified upstream distribution. Source files are pinned and hashed below.

## Selected sources

1. ailabs-393/ai-labs-claude-skills at 1a12bc7aadcc7b211f77a7455db454b77a71f827
   - Repository: https://github.com/ailabs-393/ai-labs-claude-skills
   - Source: packages/skills/nutritional-specialist/SKILL.md
   - SHA-256: 101a337c8b3a01fb7745c7e55ba4b4e9c9eed82533049e8a3d262c4a3a4b20cd
   - License: MIT; bundled at licenses/ai-labs-claude-skills-MIT.txt
   - Adaptation: Retained preference, allergy, dietary restriction, dislike, cuisine, skill, time, and budget intake; removed disease management, calorie goals, database persistence, and Python.

2. natea/ExoMind at 8794d26d9a334ff386d0fe4b90b4919b95ac201a
   - Repository: https://github.com/natea/ExoMind
   - Source: skills/grocery-shopping/SKILL.md
   - SHA-256: 37b5588973093e47af418d38d595ecfb408c9896a186ced0889b57e41cda171f
   - License: MIT; bundled at licenses/exomind-MIT.txt
   - Adaptation: Retained inventory check, ingredient consolidation, purchasable quantities, leftovers, and aisle organization; removed Costco, Instacart, browser, cart, checkout, and vendor-specific guidance.

## Security and product changes

Only reviewed prose was retained. Python, JavaScript, databases, command-line steps, external MCP calls, bookings, payments, carts, active monitoring, and automatic notifications were excluded. The installed workspace contains only Markdown and YAML files.

Upstream projects and authors do not endorse BlexAgent. Their MIT notices are preserved in the bundled license files.
