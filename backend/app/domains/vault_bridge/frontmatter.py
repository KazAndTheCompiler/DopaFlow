"""Pure Python YAML frontmatter serializer and deserializer for Obsidian vault files.

No framework dependencies or PyYAML required - implements a minimal line-by-line
parser for the simple frontmatter subset we emit.
"""

from __future__ import annotations


def serialize_frontmatter(fields: dict) -> str:
    """Serialize a flat dict to a YAML frontmatter block with --- delimiters.

    Args:
        fields: A flat dictionary of frontmatter fields.

    Returns:
        A string containing the YAML frontmatter block including --- delimiters.
        Fields with None values are skipped.
        List values are written as YAML sequence lines (one "  - item" per line).
        String values are written as "key: value" (no quotes unless value contains ":").

    Example:
        >>> serialize_frontmatter({"date": "2026-04-05", "tags": ["work", "deep"]})
        '---\\ndate: 2026-04-05\\ntags:\\n  - work\\n  - deep\\n---'
    """
    lines = ["---"]

    for key, value in fields.items():
        # Skip None values
        if value is None:
            continue

        # Handle list values
        if isinstance(value, list):
            lines.append(f"{key}:")
            for item in value:
                lines.append(f"  - {item}")
        else:
            # Handle string and other scalar values
            value_str = str(value)
            # Add quotes if value contains colons
            if ":" in value_str:
                value_str = f'"{value_str}"'
            lines.append(f"{key}: {value_str}")

    lines.append("---")
    return "\n".join(lines)


def deserialize_frontmatter(text: str) -> tuple[dict, str]:
    """Parse YAML frontmatter from a markdown string.

    Args:
        text: A raw markdown string, may or may not have frontmatter.

    Returns:
        A tuple of (fields: dict, body: str) where:
        - fields: Parsed frontmatter as a dict, or empty dict if no frontmatter found.
        - body: Everything after the closing ---, or original text if no frontmatter.
        List values are parsed back to Python lists.
        Bare strings are parsed to str type.

    Example:
        >>> text = '---\\ndate: 2026-04-05\\ntags:\\n  - work\\n---\\nContent here'
        >>> fields, body = deserialize_frontmatter(text)
        >>> fields
        {'date': '2026-04-05', 'tags': ['work']}
        >>> body
        'Content here'
    """
    lines = text.split("\n")

    # Check if the text starts with a frontmatter block
    if not lines or lines[0] != "---":
        return {}, text

    # Find the closing --- delimiter
    closing_index = None
    for i in range(1, len(lines)):
        if lines[i] == "---":
            closing_index = i
            break

    if closing_index is None:
        # No closing delimiter found, treat as no frontmatter
        return {}, text

    # Parse the frontmatter section
    frontmatter_lines = lines[1:closing_index]
    fields = {}
    current_key = None
    current_list = None

    for line in frontmatter_lines:
        # Check if this is a list item line
        if line.startswith("  - "):
            # This is a list item continuation
            if current_list is not None:
                item = line[4:]  # Remove "  - " prefix
                current_list.append(item)
            continue

        # Check if this line starts a new key-value pair
        if line and not line.startswith(" "):
            # Save previous list if any
            if current_list is not None:
                fields[current_key] = current_list
                current_list = None

            # Parse the key-value pair
            if ":" in line:
                key, value = line.split(":", 1)
                key = key.strip()
                value = value.strip()

                if not value:
                    # This might be a list key with items on next lines
                    current_key = key
                    current_list = []
                else:
                    # Remove quotes if present
                    if value.startswith('"') and value.endswith('"'):
                        value = value[1:-1]
                    fields[key] = value
                    current_key = None

    # Don't forget the last list if any
    if current_list is not None:
        fields[current_key] = current_list

    # Extract the body (everything after the closing ---)
    body_lines = lines[closing_index + 1 :]
    body = "\n".join(body_lines)

    return fields, body
