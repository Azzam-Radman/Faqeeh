from pydantic_settings import BaseSettings, SettingsConfigDict
from pydantic import Field
import os


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    ANTHROPIC_API_KEY: str = Field(default="", description="Anthropic API key")
    CHROMA_PERSIST_DIR: str = Field(default="./data/chroma", description="ChromaDB persistence directory")
    KG_DB_PATH: str = Field(default="./data/knowledge_graph.db", description="SQLite knowledge graph path")
    EMBEDDING_MODEL: str = Field(default="intfloat/multilingual-e5-small", description="SentenceTransformer model")
    UPLOAD_DIR: str = Field(default="./data/uploads", description="Directory for uploaded files")
    MAX_CHUNK_SIZE: int = Field(default=1000, description="Maximum chunk size in characters")
    CHUNK_OVERLAP: int = Field(default=150, description="Overlap between chunks in characters")
    LLM_MODEL: str = Field(default="claude-sonnet-4-6", description="Claude model to use")
    MAX_CONTEXT_CHUNKS: int = Field(default=8, description="Maximum chunks to include in LLM context")
    CORS_ORIGINS: list[str] = Field(default=["*"], description="Allowed CORS origins")

    def ensure_dirs(self) -> None:
        """Create required directories if they do not exist."""
        for path in [self.CHROMA_PERSIST_DIR, os.path.dirname(self.KG_DB_PATH), self.UPLOAD_DIR]:
            os.makedirs(path, exist_ok=True)


settings = Settings()
