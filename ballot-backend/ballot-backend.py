from ballot_backend import app

if __name__ == "__main__":
    import uvicorn

    uvicorn.run(
        "ballot_backend:app",
        host="0.0.0.0",
        port=8001,
        reload=True,
        reload_dirs=["/app"],
    )
