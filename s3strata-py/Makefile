.PHONY: help install install-dev lint format typecheck check test clean build

help:
	@echo "Available commands:"
	@echo "  make install       - Install package dependencies"
	@echo "  make install-dev   - Install package with dev dependencies"
	@echo "  make lint          - Run ruff linter"
	@echo "  make format        - Format code with black and ruff"
	@echo "  make typecheck     - Run mypy type checker"
	@echo "  make check         - Run all checks (lint + typecheck)"
	@echo "  make test          - Run tests"
	@echo "  make clean         - Clean build artifacts"
	@echo "  make build         - Build distribution packages"

install:
	pip install -e .

install-dev:
	pip install -e ".[dev]"

lint:
	ruff check s3strata examples

format:
	black s3strata examples
	ruff check --fix s3strata examples

typecheck:
	mypy s3strata

check: lint typecheck

test:
	pytest tests/ -v

clean:
	rm -rf build/ dist/ *.egg-info .mypy_cache .pytest_cache .ruff_cache
	find . -type d -name __pycache__ -exec rm -rf {} +
	find . -type f -name "*.pyc" -delete

build: clean
	python -m build
