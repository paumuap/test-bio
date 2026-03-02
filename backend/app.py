from fastapi import FastAPI, HTTPException

app = FastAPI()

@app.post("/clustalw-alignment")
async def clustalw_alignment(sequences: list[str]):
    # Placeholder for ClustalW alignment functionality
    return {"message": "ClustalW alignment performed."}

@app.post("/pairwise-alignment")
async def pairwise_alignment(sequence1: str, sequence2: str):
    # Placeholder for local pairwise alignment functionality
    return {"message": "Pairwise alignment performed."}

@app.post("/normalize-scores")
async def normalize_scores(score_matrix: list[list[float]]):
    # Placeholder for score-to-distance matrix normalization functionality
    return {"message": "Score normalization performed."}