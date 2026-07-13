# Open-source attribution

This offline template is a reviewed adaptation, not an unmodified upstream distribution. Source files are pinned and hashed below.

## Selected sources

1. charlie947/social-media-skills at 94f72ea2ece388fa30ef49a26fb2e6fd2109e0b1
   - Repository: https://github.com/charlie947/social-media-skills
   - Source: skills/voice-builder/SKILL.md
   - SHA-256: 7f47bd4b5c131331be274abed100d21e4021aa7d90ac29802f18f39891de2b5a
   - License: MIT; bundled at licenses/social-media-skills-MIT.txt
   - Adaptation: Retained user interview, sample-based voice analysis, positive and negative voice signals, and confirmation; removed auto-start, fixed batch interaction, and platform-specific assumptions.

2. alirezarezvani/claude-skills at 0241f43765572f15146fcef692defbf96d473f37
   - Repository: https://github.com/alirezarezvani/claude-skills
   - Source: marketing-skill/skills/copy-editing/SKILL.md
   - SHA-256: ecdbe7a6ff18422470eb277f5e9a307e76601c2fb54d4b6bf7ba7cb76caabeb1
   - License: MIT; bundled at licenses/alirezarezvani-claude-skills-MIT.txt
   - Adaptation: Retained sequential editing passes for clarity, voice, meaning, evidence, specificity, emotional fit, and reader risk; removed Python scoring and AI-detection claims.

## Security and product changes

Only reviewed prose workflows were retained. Python, platform-specific interactive components, command-line steps, external services, analytics collection, automatic publishing, and autonomous actions were excluded. The installed workspace contains only Markdown and YAML files.

Upstream projects and authors do not endorse BlexAgent. Their MIT notices are preserved in the bundled license files.
