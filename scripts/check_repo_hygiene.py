#!/usr/bin/env python3
"""Repo hygiene checks for DopaFlow."""

import os
import re
import subprocess
import sys
from pathlib import Path


def check_no_secrets_in_code():
    """Check for potential secrets in code."""
    issues = []
    secret_patterns = [
        (r'password\s*=\s*["\'][^"\']+["\']', 'Hardcoded password'),
        (r'api[_-]?key\s*=\s*["\'][^"\']+["\']', 'Hardcoded API key'),
        (r'secret\s*=\s*["\'][^"\']+["\']', 'Hardcoded secret'),
        (r'token\s*=\s*["\'][^"\']{20,}["\']', 'Potential token'),
        (r'sk-[a-zA-Z0-9]{20,}', 'OpenAI API key'),
        (r'ghp_[a-zA-Z0-9]{36}', 'GitHub personal token'),
    ]
    
    exclude_dirs = {'.git', 'node_modules', '.venv', '__pycache__', '.pytest_cache'}
    
    for root, dirs, files in os.walk('.'):
        dirs[:] = [d for d in dirs if d not in exclude_dirs]
        for file in files:
            if file.endswith(('.py', '.ts', '.tsx', '.js', '.jsx', '.yml', '.yaml', '.json')):
                filepath = Path(root) / file
                try:
                    content = filepath.read_text(encoding='utf-8', errors='ignore')
                    for pattern, desc in secret_patterns:
                        if re.search(pattern, content, re.IGNORECASE):
                            issues.append(f"{filepath}: Potential {desc}")
                except Exception:
                    pass
    
    return issues


def check_backend_imports():
    """Check backend imports are valid."""
    issues = []
    backend_dir = Path('backend')
    if not backend_dir.exists():
        return issues
    
    for pyfile in backend_dir.rglob('*.py'):
        if 'venv' in str(pyfile):
            continue
        try:
            content = pyfile.read_text(encoding='utf-8')
            # Check for relative imports that might break
            if re.search(r'^from \.', content, re.MULTILINE):
                if not re.search(r'^from app\.', content, re.MULTILINE):
                    issues.append(f"{pyfile}: Suspicious relative import")
        except Exception:
            pass
    
    return issues


def check_frontend_types():
    """Check frontend has type definitions."""
    issues = []
    frontend_dir = Path('frontend/src')
    if not frontend_dir.exists():
        return issues
    
    # Check if shared types exist
    shared_types = Path('shared/types.ts')
    if not shared_types.exists():
        issues.append("Missing shared/types.ts for frontend/backend type sharing")
    
    return issues


def main():
    """Run all hygiene checks."""
    print("🔍 Running repo hygiene checks...\n")
    
    all_issues = []
    
    checks = [
        ("Secrets check", check_no_secrets_in_code),
        ("Backend imports", check_backend_imports),
        ("Frontend types", check_frontend_types),
    ]
    
    for name, check_func in checks:
        print(f"Running {name}...")
        issues = check_func()
        if issues:
            all_issues.extend(issues)
            print(f"  ❌ Found {len(issues)} issues")
        else:
            print(f"  ✅ Passed")
    
    print()
    if all_issues:
        print("⚠️  Issues found:")
        for issue in all_issues:
            print(f"  - {issue}")
        sys.exit(1)
    else:
        print("✅ All hygiene checks passed!")
        sys.exit(0)


if __name__ == '__main__':
    main()
