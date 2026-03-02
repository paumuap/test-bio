import os
import subprocess
import tempfile
from typing import List, Optional, Tuple

import numpy as np
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field

from Bio import AlignIO
from Bio.Align import PairwiseAligner, substitution_matrices
from Bio.Seq import Seq
from Bio.SeqRecord import SeqRecord
from Bio.Align import MultipleSeqAlignment


app = FastAPI(title="BioAlign Backend", version="0.1.0")


# ----------------------------
# Models
# ----------------------------

class ProteinSequenceIn(BaseModel):
    id: str = Field(..., examples=["AAA59595.1"])
    seq: str = Field(..., examples=["MVLSPADKTNVKAAWGKVGAHAGEYGAEALERMF..."])


class MSARequest(BaseModel):
    sequences: List[ProteinSequenceIn]
    output_format: str = Field("fasta", description="Alignment output format: 'fasta' or 'clustal'")


class AlignedRecordOut(BaseModel):
    id: str
    aligned: str
    positions: List[Optional[int]]  # 1-based residue index per alignment column; None for gap


class MSAResponse(BaseModel):
    alignment_length: int
    records: List[AlignedRecordOut]


class PairwiseLocalRequest(BaseModel):
    seq1: str
    seq2: str
    matrix: str = Field("BLOSUM62")
    open_gap_score: float = Field(-10.0)
    extend_gap_score: float = Field(-0.5)


class AlignmentBlock(BaseModel):
    start0: int
    end0: int
    start1: int  # 1-based start
    end1: int    # 1-based inclusive end


class PairwiseLocalResponse(BaseModel):
    score: float
    blocks_seq1: List[AlignmentBlock]
    blocks_seq2: List[AlignmentBlock]


class NormalizeScoresRequest(BaseModel):
    score_matrix: List[List[float]]


class NormalizeScoresResponse(BaseModel):
    max_score: float
    distance_matrix: List[List[float]]


# ----------------------------
# Helpers
# ----------------------------

def _require_clustalw() -> str:
    """
    Ensure clustalw is present and return the executable name.
    """
    exe = "clustalw"
    # subprocess will raise FileNotFoundError if not found; we check early with `--help`
    try:
        subprocess.run([exe, "-help"], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, check=False)
    except FileNotFoundError as e:
        raise HTTPException(
            status_code=500,
            detail="ClustalW executable 'clustalw' not found on PATH. Install clustalw and try again."
        ) from e
    return exe


def _write_fasta(path: str, records: List[ProteinSequenceIn]) -> None:
    with open(path, "w", encoding="utf-8") as f:
        for r in records:
            seq = r.seq.strip().replace(" ", "").replace("\n", "")
            if not seq:
                raise HTTPException(status_code=400, detail=f"Empty sequence for id={r.id}")
            f.write(f">{r.id}\n{seq}\n")


def _positions_per_column(aligned_seq: str) -> List[Optional[int]]:
    """
    For an aligned sequence containing gaps '-', return residue index per column (1-based),
    or None if the column is a gap.
    """
    pos = 0
    out: List[Optional[int]] = []
    for ch in aligned_seq:
        if ch == "-":
            out.append(None)
        else:
            pos += 1
            out.append(pos)
    return out


def _blocks_to_models(blocks: np.ndarray) -> List[AlignmentBlock]:
    """
    blocks is an array of shape (k, 2) with 0-based [start, end) coordinates.
    Convert to both 0-based and 1-based inclusive.
    """
    out: List[AlignmentBlock] = []
    for start0, end0 in blocks.tolist():
        out.append(
            AlignmentBlock(
                start0=int(start0),
                end0=int(end0),
                start1=int(start0) + 1,
                end1=int(end0)  # end0 is exclusive, so inclusive 1-based end == end0
            )
        )
    return out


# ----------------------------
# Endpoints
# ----------------------------

@app.get("/health")
def health():
    return {"ok": True}


@app.post("/clustalw-alignment", response_model=MSAResponse)
def clustalw_alignment(req: MSARequest):
    if len(req.sequences) < 2:
        raise HTTPException(status_code=400, detail="Provide at least 2 protein sequences for MSA.")

    output_format = req.output_format.lower().strip()
    if output_format not in ("fasta", "clustal"):
        raise HTTPException(status_code=400, detail="output_format must be 'fasta' or 'clustal'.")

    exe = _require_clustalw()

    with tempfile.TemporaryDirectory() as tmpdir:
        infile = os.path.join(tmpdir, "input.fasta")
        _write_fasta(infile, req.sequences)

        if output_format == "fasta":
            outfile = os.path.join(tmpdir, "aligned.fasta")
            clustal_output_flag = "FASTA"
            biopy_format = "fasta"
        else:
            outfile = os.path.join(tmpdir, "aligned.aln")
            clustal_output_flag = "CLUSTAL"
            biopy_format = "clustal"

        # ClustalW command
        # Note: -TYPE=PROTEIN because protein only
        cmd = [
            exe,
            f"-INFILE={infile}",
            "-TYPE=PROTEIN",
            f"-OUTPUT={clustal_output_flag}",
            f"-OUTFILE={outfile}",
            "-OUTORDER=INPUT",
        ]

        proc = subprocess.run(cmd, capture_output=True, text=True)
        if proc.returncode != 0:
            raise HTTPException(
                status_code=500,
                detail={
                    "message": "ClustalW failed",
                    "returncode": proc.returncode,
                    "stdout": proc.stdout[-4000:],
                    "stderr": proc.stderr[-4000:],
                },
            )

        if not os.path.exists(outfile):
            raise HTTPException(status_code=500, detail="ClustalW did not produce an output file.")

        alignment = AlignIO.read(outfile, biopy_format)
        records_out: List[AlignedRecordOut] = []
        for rec in alignment:
            aligned = str(rec.seq)
            records_out.append(
                AlignedRecordOut(
                    id=rec.id,
                    aligned=aligned,
                    positions=_positions_per_column(aligned),
                )
            )

        return MSAResponse(alignment_length=alignment.get_alignment_length(), records=records_out)


@app.post("/pairwise-alignment", response_model=PairwiseLocalResponse)
def pairwise_alignment(req: PairwiseLocalRequest):
    seq1 = req.seq1.strip().replace(" ", "").replace("\n", "")
    seq2 = req.seq2.strip().replace(" ", "").replace("\n", "")
    if not seq1 or not seq2:
        raise HTTPException(status_code=400, detail="seq1 and seq2 must be non-empty.")

    try:
        mat = substitution_matrices.load(req.matrix)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Unknown substitution matrix: {req.matrix}") from e

    aligner = PairwiseAligner(mode="local")
    aligner.substitution_matrix = mat
    aligner.open_gap_score = req.open_gap_score
    aligner.extend_gap_score = req.extend_gap_score

    aln = aligner.align(seq1, seq2)[0]

    # aln.aligned is a tuple: (blocks_for_seq1, blocks_for_seq2)
    blocks1, blocks2 = aln.aligned
    return PairwiseLocalResponse(
        score=float(aln.score),
        blocks_seq1=_blocks_to_models(blocks1),
        blocks_seq2=_blocks_to_models(blocks2),
    )


@app.post("/normalize-scores", response_model=NormalizeScoresResponse)
def normalize_scores(req: NormalizeScoresRequest):
    M = np.array(req.score_matrix, dtype=float)
    if M.ndim != 2 or M.shape[0] != M.shape[1]:
        raise HTTPException(status_code=400, detail="score_matrix must be a square matrix.")

    n = M.shape[0]
    if n < 2:
        raise HTTPException(status_code=400, detail="score_matrix must be at least 2x2.")

    mask = ~np.eye(n, dtype=bool)
    max_score = float(np.max(M[mask]))
    if max_score <= 0:
        raise HTTPException(status_code=400, detail="max off-diagonal score must be > 0 to normalize.")

    D = 1.0 - (M / max_score)
    np.fill_diagonal(D, 0.0)

    return NormalizeScoresResponse(
        max_score=max_score,
        distance_matrix=D.tolist(),
    )