#!/usr/bin/env python3
"""Setup DRISHTI project structure"""

import os
from pathlib import Path

BASE = Path(r"c:\Users\aashu\Downloads\drishti")
BASE.mkdir(parents=True, exist_ok=True)

# Create directories
dirs = [
    "backend/data",
    "backend/features",
    "backend/ml",
    "backend/inference",
    "backend/alerts",
    "backend/api",
    "backend/monitoring",
    "backend/config",
    "deployment/kubernetes",
    "deployment/helm/drishti-chart",
    "tests",
    "notebooks",
    "docs",
]

for d in dirs:
    (BASE / d).mkdir(parents=True, exist_ok=True)

# Helper to write files
def write_file(path, content):
    file_path = BASE / path
    file_path.parent.mkdir(parents=True, exist_ok=True)
    file_path.write_text(content)
    print(f"✓ Created: {path}")

# Create __init__.py files
init_files = [
    "backend/__init__.py",
    "backend/data/__init__.py",
    "backend/features/__init__.py",
    "backend/ml/__init__.py",
    "backend/inference/__init__.py",
    "backend/alerts/__init__.py",
    "backend/api/__init__.py",
    "backend/monitoring/__init__.py",
    "tests/__init__.py",
]

for f in init_files:
    write_file(f, "# DRISHTI Railway Safety System\n")

print("\n✅ PROJECT STRUCTURE CREATED")
