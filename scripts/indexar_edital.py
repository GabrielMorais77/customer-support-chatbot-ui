import argparse
import hashlib
import json
import os
import sys
from pathlib import Path

import fitz
import mysql.connector
import requests
from dotenv import load_dotenv


GEMINI_API_BASE = "https://generativelanguage.googleapis.com/v1beta/models"


def load_environment():
    root = Path(__file__).resolve().parents[1]
    for candidate in [root / ".env", root / "backend" / ".env", Path(__file__).resolve().parent / ".env"]:
        if candidate.exists():
            load_dotenv(candidate, override=False)


def env_value(*names, default=None):
    for name in names:
        value = os.getenv(name)
        if value not in (None, ""):
            return value
    return default


def parse_args():
    parser = argparse.ArgumentParser(description="Indexa edital em PDF no MySQL/TiDB usando Gemini Embedding.")
    parser.add_argument("--titulo", default=env_value("EDITAL_TITULO"))
    parser.add_argument("--orgao", default=env_value("EDITAL_ORGAO"))
    parser.add_argument("--banca", default=env_value("EDITAL_BANCA"))
    parser.add_argument("--uf", default=env_value("EDITAL_UF"))
    parser.add_argument("--municipio", default=env_value("EDITAL_MUNICIPIO"))
    parser.add_argument("--url-oficial", default=env_value("EDITAL_URL_OFICIAL"))
    parser.add_argument("--url-pdf", default=env_value("EDITAL_URL_PDF"))
    parser.add_argument("--tipo", default=env_value("EDITAL_TIPO", default="edital"))
    parser.add_argument("--chunk-size", type=int, default=int(env_value("CHUNK_SIZE", default="1800")))
    parser.add_argument("--chunk-overlap", type=int, default=int(env_value("CHUNK_OVERLAP", default="250")))
    return parser.parse_args()


def require_config(args):
    missing = []
    for label, value in {
        "GEMINI_API_KEY": env_value("GEMINI_API_KEY"),
        "DB_HOST/HOST": env_value("DB_HOST", "HOST"),
        "DB_DATABASE/DATABASE": env_value("DB_DATABASE", "DATABASE"),
        "DB_USERNAME/USERNAME": env_value("DB_USERNAME", "USERNAME"),
        "DB_PASSWORD/PASSWORD": env_value("DB_PASSWORD", "PASSWORD"),
        "--titulo ou EDITAL_TITULO": args.titulo,
        "--url-pdf ou EDITAL_URL_PDF": args.url_pdf,
    }.items():
        if not value:
            missing.append(label)

    if missing:
        raise RuntimeError("Configuracao ausente: " + ", ".join(missing))


def db_connection():
    config = {
        "host": env_value("DB_HOST", "HOST"),
        "port": int(env_value("DB_PORT", "PORT", default="3306")),
        "database": env_value("DB_DATABASE", "DATABASE"),
        "user": env_value("DB_USERNAME", "USERNAME"),
        "password": env_value("DB_PASSWORD", "PASSWORD"),
        "autocommit": False,
        "charset": "utf8mb4",
        "use_unicode": True,
    }

    ssl_ca = env_value("MYSQL_ATTR_SSL_CA", "DB_SSL_CA")
    if ssl_ca:
        config["ssl_ca"] = ssl_ca

    return mysql.connector.connect(**config)


def download_pdf(url):
    print("Baixando PDF...")
    response = requests.get(url, timeout=60)
    response.raise_for_status()
    content_type = response.headers.get("content-type", "")
    if "pdf" not in content_type.lower() and not url.lower().split("?")[0].endswith(".pdf"):
        print("Aviso: a resposta nao informou content-type PDF; tentando processar mesmo assim.")
    return response.content


def sha256_bytes(content):
    return hashlib.sha256(content).hexdigest()


def extract_text(pdf_bytes):
    print("Extraindo texto do PDF...")
    document = fitz.open(stream=pdf_bytes, filetype="pdf")
    pages = []
    for page in document:
        pages.append(page.get_text("text"))
    text = "\n\n".join(pages).strip()
    if len(text) < 500:
        raise RuntimeError("O PDF tem pouco texto extraivel. Este edital pode precisar de OCR antes da indexacao.")
    return text


def chunk_text(text, size, overlap):
    paragraphs = [part.strip() for part in text.replace("\r\n", "\n").split("\n\n") if part.strip()]
    chunks = []
    current = ""

    for paragraph in paragraphs:
        if len(paragraph) > size:
            if current:
                chunks.append(current.strip())
                current = ""
            start = 0
            while start < len(paragraph):
                chunks.append(paragraph[start : start + size].strip())
                start += max(1, size - overlap)
            continue

        candidate = f"{current}\n\n{paragraph}".strip() if current else paragraph
        if len(candidate) <= size:
            current = candidate
        else:
            chunks.append(current.strip())
            tail = current[-overlap:] if overlap > 0 else ""
            current = f"{tail}\n\n{paragraph}".strip()

    if current:
        chunks.append(current.strip())

    return [chunk for chunk in chunks if len(chunk) > 80]


def gemini_embedding(text):
    api_key = env_value("GEMINI_API_KEY")
    model = env_value("GEMINI_EMBEDDING_MODEL", default="gemini-embedding-2")
    model = model.removeprefix("models/")
    url = f"{GEMINI_API_BASE}/{model}:embedContent"
    response = requests.post(
        url,
        headers={"x-goog-api-key": api_key, "Content-Type": "application/json"},
        json={
            "model": f"models/{model}",
            "content": {"parts": [{"text": text[:8000]}]},
        },
        timeout=45,
    )
    response.raise_for_status()
    payload = response.json()
    values = payload.get("embedding", {}).get("values")
    if not values:
        raise RuntimeError("Gemini nao retornou embedding valido.")
    return values


def document_exists(cursor, document_hash):
    cursor.execute("SELECT id FROM edital_documentos WHERE hash_documento = %s", (document_hash,))
    return cursor.fetchone()


def save_index(args, pdf_hash, extracted_text, chunks):
    connection = db_connection()
    cursor = connection.cursor(dictionary=True)

    try:
        if document_exists(cursor, pdf_hash):
            print("Documento ja indexado. Nenhum chunk novo foi salvo.")
            connection.rollback()
            return

        cursor.execute(
            """
            INSERT INTO concursos (titulo, orgao, banca, uf, municipio, status, url_oficial, created_at, updated_at)
            VALUES (%s, %s, %s, %s, %s, 'indexado', %s, NOW(), NOW())
            """,
            (args.titulo, args.orgao, args.banca, args.uf, args.municipio, args.url_oficial),
        )
        concurso_id = cursor.lastrowid

        cursor.execute(
            """
            INSERT INTO edital_documentos
                (concurso_id, tipo, url_pdf, hash_documento, texto_extraido, data_captura, created_at, updated_at)
            VALUES (%s, %s, %s, %s, %s, NOW(), NOW(), NOW())
            """,
            (concurso_id, args.tipo, args.url_pdf, pdf_hash, extracted_text),
        )
        documento_id = cursor.lastrowid

        model = env_value("GEMINI_EMBEDDING_MODEL", default="gemini-embedding-2")
        total = len(chunks)
        for index, chunk in enumerate(chunks):
            print(f"Gerando embedding {index + 1}/{total}...")
            embedding = gemini_embedding(chunk)
            cursor.execute(
                """
                INSERT INTO edital_chunks
                    (documento_id, concurso_id, chunk_index, titulo, texto, embedding, embedding_model, created_at, updated_at)
                VALUES (%s, %s, %s, %s, %s, %s, %s, NOW(), NOW())
                """,
                (
                    documento_id,
                    concurso_id,
                    index,
                    args.titulo,
                    chunk,
                    json.dumps(embedding, ensure_ascii=False),
                    model,
                ),
            )

        connection.commit()
        print(f"Indexacao concluida: concurso_id={concurso_id}, documento_id={documento_id}, chunks={total}.")
    except Exception:
        connection.rollback()
        raise
    finally:
        cursor.close()
        connection.close()


def main():
    load_environment()
    args = parse_args()
    require_config(args)

    pdf_bytes = download_pdf(args.url_pdf)
    pdf_hash = sha256_bytes(pdf_bytes)
    print(f"Hash SHA-256: {pdf_hash}")
    extracted_text = extract_text(pdf_bytes)
    chunks = chunk_text(extracted_text, args.chunk_size, args.chunk_overlap)
    print(f"Chunks preparados: {len(chunks)}")
    if not chunks:
        raise RuntimeError("Nenhum chunk util foi gerado a partir do PDF.")
    save_index(args, pdf_hash, extracted_text, chunks)


if __name__ == "__main__":
    try:
        main()
    except Exception as exc:
        print(f"Erro: {exc}", file=sys.stderr)
        sys.exit(1)
