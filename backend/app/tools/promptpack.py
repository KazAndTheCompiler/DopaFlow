"""Qwen Prompt Pack — DopaFlow CLI implementation.

This tool implements the prompt templates documented in CHANGELOG.md
for automated code audits, refactors, API sync, migrations, and test generation.

Usage:
    python -m app.tools.promptpack audit <domain>
    python -m app.tools.promptpack api-sync
    python -m app.tools.promptpack security-sweep <target_path> --concern <concern>
    python -m app.tools.promptpack migration <description>
    python -m app.tools.promptpack tests <domain>
"""

from __future__ import annotations

import argparse
import re
import sys
from dataclasses import dataclass
from datetime import datetime
from pathlib import Path
from typing import Any


# Base path for the DopaFlow backend
# This file is at: backend/app/tools/promptpack.py
# So we need to go up 3 levels to reach backend/
BACKEND_ROOT = Path(__file__).parent.parent.parent
DOMAINS_PATH = BACKEND_ROOT / "app" / "domains"
MIGRATIONS_PATH = BACKEND_ROOT / "migrations"
TESTS_PATH = BACKEND_ROOT / "tests"
API_REFERENCE_PATH = BACKEND_ROOT.parent / "docs" / "api-reference.md"


@dataclass
class AuditFinding:
    """Represents a finding from a domain audit."""

    category: str
    severity: str
    file_path: str
    line_number: int | None
    description: str
    suggestion: str


@dataclass
class DomainPattern:
    """Expected pattern for a domain module."""

    has_router: bool
    has_service: bool
    has_repository: bool
    has_schemas: bool
    router_prefix: str | None
    tags: list[str]


class DomainAuditor:
    """Audit a domain against the repo's domain pattern."""

    def __init__(self, domain: str):
        self.domain = domain
        self.domain_path = DOMAINS_PATH / domain
        self.findings: list[AuditFinding] = []

    def audit(self) -> dict[str, Any]:
        """Run the full audit and return results."""
        if not self.domain_path.exists():
            return {"error": f"Domain '{self.domain}' not found at {self.domain_path}"}

        # Read domain files
        router = self._read_file("router.py")
        service = self._read_file("service.py")
        repository = self._read_file("repository.py")
        schemas = self._read_file("schemas.py")

        # Analyze each component
        self._audit_router(router)
        self._audit_service(service, router)
        self._audit_repository(repository, router)
        self._audit_schemas(schemas)

        return {
            "domain": self.domain,
            "path": str(self.domain_path),
            "files_found": {
                "router.py": router is not None,
                "service.py": service is not None,
                "repository.py": repository is not None,
                "schemas.py": schemas is not None,
            },
            "findings": [
                {
                    "category": f.category,
                    "severity": f.severity,
                    "file": f.file_path,
                    "line": f.line_number,
                    "description": f.description,
                    "suggestion": f.suggestion,
                }
                for f in self.findings
            ],
        }

    def _read_file(self, filename: str) -> str | None:
        """Read a file from the domain directory."""
        filepath = self.domain_path / filename
        if filepath.exists():
            return filepath.read_text(encoding="utf-8")
        return None

    def _audit_router(self, router: str | None) -> None:
        """Audit router.py for business logic that should be extracted."""
        if router is None:
            self.findings.append(
                AuditFinding(
                    category="missing_file",
                    severity="medium",
                    file_path=str(self.domain_path / "router.py"),
                    line_number=None,
                    description="router.py is missing",
                    suggestion="Create router.py with FastAPI APIRouter",
                )
            )
            return

        # Check for business logic in router (functions with complex logic)
        lines = router.split("\n")
        for i, line in enumerate(lines, 1):
            # Look for complex logic in route handlers
            if "async def" in line or "def " in line:
                # Check next lines for business logic patterns
                block = "\n".join(lines[i : min(i + 30, len(lines))])
                if re.search(r"for\s+\w+\s+in\s+", block) and re.search(
                    r"if\s+.+:", block
                ):
                    # Has loops and conditionals - potential business logic
                    func_name = re.search(r"(?:async\s+)?def\s+(\w+)", line)
                    if func_name:
                        self.findings.append(
                            AuditFinding(
                                category="business_logic_in_router",
                                severity="medium",
                                file_path=str(self.domain_path / "router.py"),
                                line_number=i,
                                description=f"Function '{func_name.group(1)}' contains business logic",
                                suggestion="Move business logic to service.py, keep router thin",
                            )
                        )

        # Check for direct DB calls that should be in repository
        if "sqlite3.connect" in router or "get_db" in router:
            self.findings.append(
                AuditFinding(
                    category="direct_db_access",
                    severity="high",
                    file_path=str(self.domain_path / "router.py"),
                    line_number=None,
                    description="Router contains direct database access",
                    suggestion="Move DB calls to repository.py",
                )
            )

    def _audit_service(self, service: str | None, router: str | None) -> None:
        """Audit service.py existence and usage."""
        if service is None:
            # Check if router has business logic that needs a service
            if router and len(router) > 500:  # Large router likely has logic
                self.findings.append(
                    AuditFinding(
                        category="missing_service",
                        severity="low",
                        file_path=str(self.domain_path / "service.py"),
                        line_number=None,
                        description="No service.py but router appears to have business logic",
                        suggestion="Create service.py to extract business logic from router",
                    )
                )
            return

        # Service exists - check if it's being used
        if router and "service" not in router.lower():
            self.findings.append(
                AuditFinding(
                    category="unused_service",
                    severity="medium",
                    file_path=str(self.domain_path / "router.py"),
                    line_number=None,
                    description="service.py exists but router doesn't import it",
                    suggestion="Import and use service layer in router",
                )
            )

    def _audit_repository(self, repository: str | None, router: str | None) -> None:
        """Audit repository.py for proper data access patterns."""
        if repository is None:
            self.findings.append(
                AuditFinding(
                    category="missing_repository",
                    severity="medium",
                    file_path=str(self.domain_path / "repository.py"),
                    line_number=None,
                    description="repository.py is missing",
                    suggestion="Create repository.py for data access abstraction",
                )
            )
            return

        # Check for SQL injection risks
        if re.search(r'f["\'].*SELECT.*\{', repository, re.IGNORECASE) or re.search(
            r'f["\'].*INSERT.*\{', repository, re.IGNORECASE
        ):
            self.findings.append(
                AuditFinding(
                    category="sql_injection_risk",
                    severity="high",
                    file_path=str(self.domain_path / "repository.py"),
                    line_number=None,
                    description="Repository uses f-strings in SQL queries",
                    suggestion="Use parameterized queries with ? placeholders",
                )
            )

    def _audit_schemas(self, schemas: str | None) -> None:
        """Audit schemas.py for validation and typing."""
        if schemas is None:
            self.findings.append(
                AuditFinding(
                    category="missing_schemas",
                    severity="low",
                    file_path=str(self.domain_path / "schemas.py"),
                    line_number=None,
                    description="schemas.py is missing",
                    suggestion="Create schemas.py with Pydantic models for validation",
                )
            )
            return

        # Check for typing
        if "from pydantic" not in schemas and "from typing" not in schemas:
            self.findings.append(
                AuditFinding(
                    category="missing_typing",
                    severity="low",
                    file_path=str(self.domain_path / "schemas.py"),
                    line_number=None,
                    description="schemas.py lacks type annotations",
                    suggestion="Add Pydantic models or typing annotations",
                )
            )


class APISync:
    """Sync API reference documentation to live routers."""

    def __init__(self):
        self.mismatches: list[dict[str, Any]] = []

    def sync(self) -> dict[str, Any]:
        """Sync API reference to actual routers."""
        if not API_REFERENCE_PATH.exists():
            return {"error": f"API reference not found at {API_REFERENCE_PATH}"}

        # Read current API reference
        api_ref = API_REFERENCE_PATH.read_text(encoding="utf-8")

        # Discover all domain routers
        routers = self._discover_routers()

        # Parse API reference to extract documented endpoints
        documented = self._parse_api_reference(api_ref)

        # Compare and find mismatches
        for router_path, endpoints in routers.items():
            domain = router_path.parent.name
            for endpoint in endpoints:
                method = endpoint["method"]
                path = endpoint["path"]

                # Check if documented
                found = self._find_in_docs(method, path, documented, domain)
                if not found:
                    self.mismatches.append(
                        {
                            "type": "missing",
                            "domain": domain,
                            "method": method,
                            "path": path,
                            "router": str(router_path),
                        }
                    )

        return {
            "routers_scanned": len(routers),
            "endpoints_found": sum(len(eps) for eps in routers.values()),
            "mismatches": self.mismatches,
        }

    def _discover_routers(self) -> dict[Path, list[dict[str, str]]]:
        """Discover all router files and extract endpoints."""
        routers: dict[Path, list[dict[str, str]]] = {}

        for domain_dir in DOMAINS_PATH.iterdir():
            if not domain_dir.is_dir() or domain_dir.name.startswith("__"):
                continue

            router_file = domain_dir / "router.py"
            if router_file.exists():
                endpoints = self._extract_endpoints(router_file)
                if endpoints:
                    routers[router_file] = endpoints

        return routers

    def _extract_endpoints(self, router_path: Path) -> list[dict[str, str]]:
        """Extract endpoint definitions from a router file."""
        endpoints = []
        content = router_path.read_text(encoding="utf-8")

        # Look for @router.get, @router.post, etc.
        patterns = [
            (r'@router\.get\(["\']([^"\']+)["\']', "GET"),
            (r'@router\.post\(["\']([^"\']+)["\']', "POST"),
            (r'@router\.patch\(["\']([^"\']+)["\']', "PATCH"),
            (r'@router\.delete\(["\']([^"\']+)["\']', "DELETE"),
            (r'@router\.put\(["\']([^"\']+)["\']', "PUT"),
        ]

        for pattern, method in patterns:
            for match in re.finditer(pattern, content):
                path = match.group(1)
                endpoints.append({"method": method, "path": path})

        return endpoints

    def _parse_api_reference(self, content: str) -> dict[str, list[dict[str, str]]]:
        """Parse API reference markdown to extract documented endpoints."""
        documented: dict[str, list[dict[str, str]]] = {}
        current_section = None

        for line in content.split("\n"):
            # Section headers like ## Tasks
            if line.startswith("## "):
                current_section = line[3:].strip().lower()
                if current_section not in documented:
                    documented[current_section] = []

            # Table rows with endpoint info
            if current_section and "|" in line:
                parts = [p.strip() for p in line.split("|")]
                if len(parts) >= 3:
                    method = parts[1].strip()
                    path = parts[2].strip()
                    if method in ("GET", "POST", "PATCH", "DELETE", "PUT"):
                        documented[current_section].append(
                            {"method": method, "path": path}
                        )

        return documented

    def _find_in_docs(
        self,
        method: str,
        path: str,
        documented: dict[str, list[dict[str, str]]],
        domain: str,
    ) -> bool:
        """Check if an endpoint is documented."""
        # Try exact domain match
        if domain in documented:
            for doc in documented[domain]:
                if doc["method"] == method and doc["path"] == path:
                    return True

        # Try fuzzy match (e.g., "calendar_sharing" -> "calendar")
        for section, endpoints in documented.items():
            if section in domain or domain in section:
                for doc in endpoints:
                    if doc["method"] == method and doc["path"] == path:
                        return True

        return False


class SecuritySweeper:
    """Perform security and quality sweeps."""

    CONCERNS = {
        "auth_gaps": ["auth", "AuthMiddleware", "require_scope", "authentication"],
        "scope_coverage": ["SCOPES", "scope", "permission"],
        "upload_validation": ["validate_upload", "content_type", "max_bytes", "suffix"],
        "exception_logging": ["except", "Exception", "logger", "logging"],
        "raw_sql_interpolation": ["execute", "SELECT", "INSERT", "UPDATE", "DELETE"],
        "ssrf_handling": ["http", "requests", "urllib", "fetch", "url"],
    }

    def __init__(self, target_path: str, concern: str):
        self.target_path = Path(target_path)
        self.concern = concern
        self.findings: list[dict[str, Any]] = []

    def sweep(self) -> dict[str, Any]:
        """Run the security/quality sweep."""
        if not self.target_path.exists():
            return {"error": f"Target path not found: {self.target_path}"}

        if self.concern not in self.CONCERNS:
            return {
                "error": f"Unknown concern: {self.concern}. Valid: {list(self.CONCERNS.keys())}"
            }

        keywords = self.CONCERNS[self.concern]

        # Scan Python files
        for py_file in self.target_path.rglob("*.py"):
            if "__pycache__" in str(py_file):
                continue
            self._scan_file(py_file, keywords)

        return {
            "target": str(self.target_path),
            "concern": self.concern,
            "keywords_searched": keywords,
            "findings": self.findings,
        }

    def _scan_file(self, filepath: Path, keywords: list[str]) -> None:
        """Scan a file for security concerns."""
        content = filepath.read_text(encoding="utf-8")
        lines = content.split("\n")

        for i, line in enumerate(lines, 1):
            # Skip comments
            stripped = line.strip()
            if stripped.startswith("#"):
                continue

            for keyword in keywords:
                if keyword.lower() in line.lower():
                    finding = self._analyze_line(filepath, i, line, keyword)
                    if finding:
                        self.findings.append(finding)
                    break

    def _analyze_line(
        self, filepath: Path, line_num: int, line: str, keyword: str
    ) -> dict[str, Any] | None:
        """Analyze a line for potential issues."""
        concern = self.concern

        # Specific checks based on concern type
        if concern == "raw_sql_interpolation":
            if re.search(
                r'f["\'].*(?:SELECT|INSERT|UPDATE|DELETE).*\{', line, re.IGNORECASE
            ):
                return {
                    "type": "risk",
                    "file": str(filepath),
                    "line": line_num,
                    "issue": "Potential SQL interpolation in f-string",
                    "code": line.strip(),
                    "recommendation": "Use parameterized queries with ? placeholders",
                }

        if concern == "upload_validation":
            if "upload" in line.lower() and "validate" not in line.lower():
                return {
                    "type": "info",
                    "file": str(filepath),
                    "line": line_num,
                    "issue": "Upload handling without explicit validation",
                    "code": line.strip(),
                    "recommendation": "Ensure validate_upload() is called",
                }

        if concern == "exception_logging":
            if "except" in line.lower() and "logger" not in content.lower():
                return {
                    "type": "info",
                    "file": str(filepath),
                    "line": line_num,
                    "issue": "Exception handler without logging",
                    "code": line.strip(),
                    "recommendation": "Add logging for exception tracking",
                }

        return None


class MigrationGenerator:
    """Generate SQLite migrations."""

    def __init__(self, description: str):
        self.description = description
        self.migrations_path = MIGRATIONS_PATH

    def generate(self) -> dict[str, Any]:
        """Generate the next migration."""
        if not self.migrations_path.exists():
            return {"error": f"Migrations path not found: {self.migrations_path}"}

        # Find next migration number
        existing = sorted(self.migrations_path.glob("*.sql"))
        next_num = len(existing) + 1

        # Generate filename
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        filename = f"{next_num:04d}_{timestamp}_{self._slugify(self.description)}.sql"
        filepath = self.migrations_path / filename

        # Generate migration content
        content = self._generate_content(next_num)

        # Write migration
        filepath.write_text(content, encoding="utf-8")

        return {
            "migration_number": next_num,
            "filename": filename,
            "path": str(filepath),
            "description": self.description,
            "status": "created",
        }

    def _slugify(self, text: str) -> str:
        """Convert text to URL-friendly slug."""
        text = text.lower().strip()
        text = re.sub(r"[^\w\s-]", "", text)
        text = re.sub(r"[-\s]+", "_", text)
        return text[:50]

    def _generate_content(self, number: int) -> str:
        """Generate migration SQL content."""
        return f"""-- Migration {number:04d}: {self.description}
-- Generated: {datetime.now().isoformat()}

-- TODO: Add your schema changes here
-- Example:
-- CREATE TABLE IF NOT EXISTS example_table (
--     id TEXT PRIMARY KEY,
--     created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
--     updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
-- );

-- Remember:
-- - Keep SQLite compatibility in mind
-- - Include indexes where needed
-- - Do not rely on unsupported ALTER patterns
"""


class TestGenerator:
    """Generate tests for a domain."""

    def __init__(self, domain: str):
        self.domain = domain
        self.domain_path = DOMAINS_PATH / domain
        self.test_path = TESTS_PATH

    def generate(self) -> dict[str, Any]:
        """Generate tests for the domain."""
        if not self.domain_path.exists():
            return {"error": f"Domain '{self.domain}' not found at {self.domain_path}"}

        # Read domain files
        router = self._read_file("router.py")
        repository = self._read_file("repository.py")

        if router is None:
            return {"error": f"No router.py found in domain '{self.domain}'"}

        # Extract endpoints from router
        endpoints = self._extract_endpoints(router)

        # Generate test file
        test_content = self._generate_test_content(endpoints, router, repository)

        # Write test file
        test_file = self.test_path / f"test_{self.domain}.py"
        test_file.write_text(test_content, encoding="utf-8")

        return {
            "domain": self.domain,
            "test_file": str(test_file),
            "endpoints_covered": len(endpoints),
            "status": "created",
        }

    def _read_file(self, filename: str) -> str | None:
        """Read a file from the domain directory."""
        filepath = self.domain_path / filename
        if filepath.exists():
            return filepath.read_text(encoding="utf-8")
        return None

    def _extract_endpoints(self, router: str) -> list[dict[str, str]]:
        """Extract endpoint definitions from router content."""
        endpoints = []

        patterns = [
            (r'@router\.get\(["\']([^"\']+)["\']', "GET"),
            (r'@router\.post\(["\']([^"\']+)["\']', "POST"),
            (r'@router\.patch\(["\']([^"\']+)["\']', "PATCH"),
            (r'@router\.delete\(["\']([^"\']+)["\']', "DELETE"),
        ]

        for pattern, method in patterns:
            for match in re.finditer(pattern, router):
                path = match.group(1)
                # Extract function name
                func_match = re.search(
                    r"async def (\w+)", router[match.end() : match.end() + 100]
                )
                func_name = func_match.group(1) if func_match else "handler"
                endpoints.append(
                    {"method": method, "path": path, "function": func_name}
                )

        return endpoints

    def _generate_test_content(
        self, endpoints: list[dict[str, str]], router: str, repository: str | None
    ) -> str:
        """Generate pytest content."""
        test_class = f"Test{self.domain.title().replace('_', '')}"

        tests = []
        for endpoint in endpoints:
            method = endpoint["method"].lower()
            path = endpoint["path"]
            func_name = endpoint["function"]

            # Generate test name
            raw_test_name = f"test_{method}_{path.replace('/', '_').replace('{', '').replace('}', '')}"
            test_name = self._sanitize_test_name(raw_test_name)

            # Generate test code
            test_code = f'''
    def {test_name}(self, client, db_path):
        """Test {endpoint["method"]} {path}."""
        # TODO: Implement test for {func_name}
        # Example:
        # response = client.request("{endpoint["method"]}", "/api/v2{path}")
        # assert response.status_code == 200
        # data = response.json()
        # assert "id" in data
        pass
'''
            tests.append(test_code)

        content = f'''"""Tests for the {self.domain} domain."""

from __future__ import annotations

import pytest


@pytest.mark.skip(reason="Generated placeholder tests require implementation")
class {test_class}:
    """Test suite for {self.domain} domain endpoints."""

    def test_setup(self, client, db_path):
        """Verify test infrastructure is working."""
        # Basic smoke test
        pass
{"".join(tests)}
'''
        return content

    def _sanitize_test_name(self, name: str) -> str:
        """Convert an arbitrary route-derived name into a valid Python identifier."""
        sanitized = re.sub(r"\W+", "_", name).strip("_")
        sanitized = re.sub(r"_+", "_", sanitized)
        if not sanitized:
            return "test_generated_endpoint"
        if sanitized[0].isdigit():
            sanitized = f"test_{sanitized}"
        return sanitized


def cmd_audit(args: argparse.Namespace) -> int:
    """Run domain audit command."""
    auditor = DomainAuditor(args.domain)
    result = auditor.audit()

    if "error" in result:
        print(f"Error: {result['error']}")
        return 1

    print(f"\n=== Domain Audit: {args.domain} ===")
    print(f"Path: {result['path']}")
    print(f"\nFiles found:")
    for file, found in result["files_found"].items():
        status = "✓" if found else "✗"
        print(f"  {status} {file}")

    print(f"\nFindings ({len(result['findings'])}):")
    for finding in result["findings"]:
        severity = finding["severity"].upper()
        print(f"  [{severity}] {finding['category']}: {finding['description']}")
        print(f"         → {finding['suggestion']}")

    return 0


def cmd_api_sync(args: argparse.Namespace) -> int:
    """Run API sync command."""
    sync = APISync()
    result = sync.sync()

    if "error" in result:
        print(f"Error: {result['error']}")
        return 1

    print(f"\n=== API Reference Sync ===")
    print(f"Routers scanned: {result['routers_scanned']}")
    print(f"Endpoints found: {result['endpoints_found']}")
    print(f"Mismatches: {len(result['mismatches'])}")

    if result["mismatches"]:
        print("\nMissing from documentation:")
        for mismatch in result["mismatches"][:20]:  # Limit output
            print(
                f"  {mismatch['method']:6} {mismatch['path']:30} ({mismatch['domain']})"
            )

    return 0


def cmd_security_sweep(args: argparse.Namespace) -> int:
    """Run security sweep command."""
    sweeper = SecuritySweeper(args.target_path, args.concern)
    result = sweeper.sweep()

    if "error" in result:
        print(f"Error: {result['error']}")
        return 1

    print(f"\n=== Security Sweep: {args.concern} ===")
    print(f"Target: {result['target']}")
    print(f"Keywords: {', '.join(result['keywords_searched'])}")
    print(f"Findings: {len(result['findings'])}")

    if result["findings"]:
        print("\nIssues found:")
        for finding in result["findings"][:20]:  # Limit output
            print(f"  Line {finding['line']}: {finding['issue']}")
            print(f"    {finding['code'][:80]}...")
            print(f"    → {finding['recommendation']}")

    return 0


def cmd_migration(args: argparse.Namespace) -> int:
    """Run migration generation command."""
    generator = MigrationGenerator(args.description)
    result = generator.generate()

    if "error" in result:
        print(f"Error: {result['error']}")
        return 1

    print(f"\n=== Migration Generated ===")
    print(f"Number: {result['migration_number']}")
    print(f"File: {result['filename']}")
    print(f"Path: {result['path']}")
    print(f"\nEdit the file to add your schema changes.")

    return 0


def cmd_tests(args: argparse.Namespace) -> int:
    """Run test generation command."""
    generator = TestGenerator(args.domain)
    result = generator.generate()

    if "error" in result:
        print(f"Error: {result['error']}")
        return 1

    print(f"\n=== Tests Generated ===")
    print(f"Domain: {result['domain']}")
    print(f"File: {result['test_file']}")
    print(f"Endpoints covered: {result['endpoints_covered']}")
    print(f"\nEdit the file to implement test cases.")

    return 0


def main() -> int:
    """Main entry point."""
    parser = argparse.ArgumentParser(
        prog="promptpack",
        description="Qwen Prompt Pack CLI for DopaFlow",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  python -m app.tools.promptpack audit tasks
  python -m app.tools.promptpack api-sync
  python -m app.tools.promptpack security-sweep backend/app --concern raw_sql_interpolation
  python -m app.tools.promptpack migration "add user preferences table"
  python -m app.tools.promptpack tests review
        """,
    )

    subparsers = parser.add_subparsers(dest="command", help="Available commands")

    # Audit command
    audit_parser = subparsers.add_parser(
        "audit", help="Audit a domain for pattern drift"
    )
    audit_parser.add_argument(
        "domain", help="Domain name to audit (e.g., tasks, review)"
    )
    audit_parser.set_defaults(func=cmd_audit)

    # API sync command
    api_parser = subparsers.add_parser(
        "api-sync", help="Sync API reference to live routers"
    )
    api_parser.set_defaults(func=cmd_api_sync)

    # Security sweep command
    security_parser = subparsers.add_parser(
        "security-sweep", help="Security/quality sweep"
    )
    security_parser.add_argument("target_path", help="Path to scan (e.g., backend/app)")
    security_parser.add_argument(
        "--concern",
        required=True,
        choices=[
            "auth_gaps",
            "scope_coverage",
            "upload_validation",
            "exception_logging",
            "raw_sql_interpolation",
            "ssrf_handling",
        ],
        help="Security concern to audit",
    )
    security_parser.set_defaults(func=cmd_security_sweep)

    # Migration command
    migration_parser = subparsers.add_parser(
        "migration", help="Generate a new migration"
    )
    migration_parser.add_argument(
        "description", help="Description of the schema change"
    )
    migration_parser.set_defaults(func=cmd_migration)

    # Tests command
    tests_parser = subparsers.add_parser("tests", help="Generate tests for a domain")
    tests_parser.add_argument(
        "domain", help="Domain name to test (e.g., tasks, review)"
    )
    tests_parser.set_defaults(func=cmd_tests)

    args = parser.parse_args()

    if not args.command:
        parser.print_help()
        return 0

    return args.func(args)


if __name__ == "__main__":
    sys.exit(main())
