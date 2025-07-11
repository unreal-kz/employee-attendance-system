from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
import os

app = FastAPI()

build_dir = os.path.join(os.path.dirname(__file__), "build")
app.mount("/", StaticFiles(directory=build_dir, html=True), name="static") 