"""
Setup script for Reception Labs FastAPI package
"""
from setuptools import setup, find_packages

with open("README.md", "r", encoding="utf-8") as fh:
    long_description = fh.read()

setup(
    name="reception_labs",
    version="0.1.0",
    author="Reception Labs Team",
    author_email="contact@receptionlabs.com",
    description="FastAPI application for ElevenLabs API integration",
    long_description=long_description,
    long_description_content_type="text/markdown",
    url="https://github.com/reception-labs/reception-labs",
    packages=find_packages(),
    classifiers=[
        "Programming Language :: Python :: 3",
        "License :: OSI Approved :: MIT License",
        "Operating System :: OS Independent",
    ],
    python_requires=">=3.8",
    install_requires=[
        "fastapi>=0.104.1",
        "uvicorn>=0.24.0",
        "httpx>=0.25.0",
        "pydantic>=2.5.0",
        "python-dotenv>=1.0.0",
    ],
    entry_points={
        "console_scripts": [
            "reception-labs=reception_labs.main:main",
        ],
    },
    include_package_data=True,
    zip_safe=False,
)