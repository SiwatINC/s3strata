"""Example SQLAlchemy storage adapter for S3Strata"""

from datetime import datetime
from typing import List, Optional, Union

from sqlalchemy import Column, DateTime, Integer, String
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.future import select
from sqlalchemy.orm import sessionmaker

from s3strata import PhysicalFile, StorageAdapter, StorageTier

Base = declarative_base()


class PhysicalFileModel(Base):
    """SQLAlchemy model for physical files"""

    __tablename__ = "physical_files"

    id = Column(Integer, primary_key=True, autoincrement=True)
    storage_tier = Column(String(4), nullable=False)  # "HOT" or "COLD"
    filename = Column(String(255), nullable=False)
    path = Column(String(1024), nullable=False, unique=True)
    hot_until = Column(DateTime, nullable=True)
    created_at = Column(DateTime, nullable=False, default=datetime.now)
    updated_at = Column(DateTime, nullable=False, default=datetime.now, onupdate=datetime.now)


class SQLAlchemyAdapter(StorageAdapter):
    """SQLAlchemy implementation of StorageAdapter"""

    def __init__(self, session: AsyncSession):
        self.session = session

    def _to_dto(self, model: PhysicalFileModel) -> PhysicalFile:
        """Convert SQLAlchemy model to DTO"""
        return PhysicalFile(
            id=model.id,
            storage_tier=StorageTier(model.storage_tier),
            filename=model.filename,
            path=model.path,
            hot_until=model.hot_until,
            created_at=model.created_at,
            updated_at=model.updated_at,
        )

    async def create(
        self,
        storage_tier: StorageTier,
        filename: str,
        path: str,
        hot_until: Optional[datetime],
    ) -> PhysicalFile:
        """Create a new file record"""
        model = PhysicalFileModel(
            storage_tier=storage_tier.value,
            filename=filename,
            path=path,
            hot_until=hot_until,
        )
        self.session.add(model)
        await self.session.commit()
        await self.session.refresh(model)
        return self._to_dto(model)

    async def find_by_id(self, id: Union[str, int]) -> Optional[PhysicalFile]:
        """Find file by ID"""
        result = await self.session.execute(
            select(PhysicalFileModel).where(PhysicalFileModel.id == int(id))
        )
        model = result.scalar_one_or_none()
        return self._to_dto(model) if model else None

    async def update(
        self,
        id: Union[str, int],
        storage_tier: Optional[StorageTier] = None,
        path: Optional[str] = None,
        hot_until: Optional[datetime] = None,
    ) -> PhysicalFile:
        """Update file record"""
        result = await self.session.execute(
            select(PhysicalFileModel).where(PhysicalFileModel.id == int(id))
        )
        model = result.scalar_one()

        if storage_tier is not None:
            model.storage_tier = storage_tier.value
        if path is not None:
            model.path = path
        if hot_until is not None:
            model.hot_until = hot_until

        model.updated_at = datetime.now()
        await self.session.commit()
        await self.session.refresh(model)
        return self._to_dto(model)

    async def delete(self, id: Union[str, int]) -> None:
        """Delete file record"""
        result = await self.session.execute(
            select(PhysicalFileModel).where(PhysicalFileModel.id == int(id))
        )
        model = result.scalar_one()
        await self.session.delete(model)
        await self.session.commit()

    async def find_expired_hot_files(self) -> List[PhysicalFile]:
        """Find all HOT files where hot_until has passed"""
        result = await self.session.execute(
            select(PhysicalFileModel).where(
                PhysicalFileModel.storage_tier == StorageTier.HOT.value,
                PhysicalFileModel.hot_until <= datetime.now(),
            )
        )
        models = result.scalars().all()
        return [self._to_dto(model) for model in models]

    async def find_all(self) -> List[PhysicalFile]:
        """Find all file records"""
        result = await self.session.execute(select(PhysicalFileModel))
        models = result.scalars().all()
        return [self._to_dto(model) for model in models]


# Example usage
async def example():
    """Example of using the SQLAlchemy adapter"""
    from s3strata import FileManager, S3StrataConfig  # noqa: PLC0415

    # Create async engine and session
    engine = create_async_engine("sqlite+aiosqlite:///./test.db", echo=True)
    async_session = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

    # Create tables
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    # Create adapter and file manager
    async with async_session() as session:
        adapter = SQLAlchemyAdapter(session)

        config = S3StrataConfig(
            endpoint="s3.amazonaws.com",
            access_key="your-access-key",
            secret_key="your-secret-key",
            hot_bucket="my-hot-bucket",
            cold_bucket="my-cold-bucket",
        )

        file_manager = FileManager(config, adapter)

        # Upload a file
        file = await file_manager.upload(b"Hello, World!")
        print(f"Uploaded file: {file.id}")

        # Get URL
        url = await file_manager.get_url(file)
        print(f"File URL: {url}")


if __name__ == "__main__":
    import asyncio

    asyncio.run(example())
