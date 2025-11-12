"""Setup configuration for s3strata-py"""

from setuptools import find_packages, setup

with open("README.md", "r", encoding="utf-8") as fh:
    long_description = fh.read()

setup(
    name="s3strata",
    version="1.5.0",
    author="Siwat Sirichai",
    description="Object storage abstraction layer with dual-bucket tiered storage and visibility control for Python",
    long_description=long_description,
    long_description_content_type="text/markdown",
    url="https://github.com/SiwatINC/s3strata",
    packages=find_packages(),
    classifiers=[
        "Development Status :: 4 - Beta",
        "Intended Audience :: Developers",
        "License :: OSI Approved :: MIT License",
        "Operating System :: OS Independent",
        "Programming Language :: Python :: 3",
        "Programming Language :: Python :: 3.8",
        "Programming Language :: Python :: 3.9",
        "Programming Language :: Python :: 3.10",
        "Programming Language :: Python :: 3.11",
        "Programming Language :: Python :: 3.12",
        "Topic :: Software Development :: Libraries :: Python Modules",
        "Topic :: System :: Filesystems",
    ],
    python_requires=">=3.8",
    install_requires=[
        "boto3>=1.26.0",
        "botocore>=1.29.0",
    ],
    extras_require={
        "dev": [
            "pytest>=7.0.0",
            "pytest-asyncio>=0.21.0",
            "black>=23.0.0",
            "mypy>=1.0.0",
            "ruff>=0.1.0",
        ],
        "sqlalchemy": [
            "sqlalchemy>=2.0.0",
            "aiosqlite>=0.19.0",
        ],
    },
    keywords=[
        "s3",
        "object-storage",
        "storage",
        "tiered-storage",
        "hot-cold-storage",
        "file-management",
        "multi-endpoint",
        "python",
        "async",
    ],
)
