import os
import subprocess
import tempfile
from typing import List, Optional, Tuple

import numpy as np
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from Bio import AlignIO
from Bio.Align import PairwiseAligner, substitution_matrices
from Bio.Seq import Seq
from Bio.SeqRecord import SeqRecord
from Bio.Align import MultipleSeqAlignment


app = FastAPI(title="BioAlign Backend", version="0.1.0")

# Enable CORS for frontend requests
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


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

def _progressive_alignment(seqs: List[SeqRecord]) -> MultipleSeqAlignment:
    """
    Simple progressive alignment using pairwise alignment.
    Aligns sequences incrementally to build a multiple alignment.
    """
    if not seqs:
        raise ValueError("No sequences provided")
    
    # Clean and validate sequences
    cleaned_seqs = []
    for seq in seqs:
        clean_str = str(seq.seq).strip().upper().replace(" ", "").replace("\n", "")
        # Only keep valid amino acid characters and gaps
        valid_chars = "ACDEFGHIKLMNPQRSTVWY-"
        clean_str = "".join(c for c in clean_str if c in valid_chars)
        if not clean_str:
            raise ValueError(f"Sequence {seq.id} is empty or contains no valid amino acids")
        cleaned_seqs.append(SeqRecord(Seq(clean_str), id=seq.id))
    
    # Start with first sequence
    alignment = MultipleSeqAlignment([cleaned_seqs[0]])
    
    # Progressively align remaining sequences
    aligner = PairwiseAligner()
    aligner.substitution_matrix = substitution_matrices.load("BLOSUM62")
    aligner.open_gap_score = -10
    aligner.extend_gap_score = -0.5
    
    for seq in cleaned_seqs[1:]:
        # Create a string from first sequence in alignment (may have gaps)
        consensus = str(alignment[0].seq)
        
        # Align new sequence to consensus
        aln = aligner.align(consensus.replace("-", ""), str(seq.seq))[0]
        
        # Extract alignment strings
        aligned1_str = str(aln[0])
        aligned2_str = str(aln[1])
        
        # Update all existing sequences with gaps from new alignment
        for i in range(len(alignment)):
            old_seq_str = str(alignment[i].seq)
            new_seq_str = ""
            old_idx = 0
            
            for ch in aligned1_str:
                if ch == "-":
                    new_seq_str += "-"
                else:
                    if old_idx < len(old_seq_str):
                        new_seq_str += old_seq_str[old_idx]
                    old_idx += 1
            
            alignment[i].seq = Seq(new_seq_str)
        
        # Add new sequence
        new_rec = SeqRecord(Seq(aligned2_str), id=seq.id)
        alignment.append(new_rec)
    
    return alignment


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


# # ----------------------------
# # Endpoints
# # ----------------------------

# @app.get("/health")
# def health():
#     return {"ok": True}


@app.post("/clustalw-alignment", response_model=MSAResponse)
def clustalw_alignment(req: MSARequest):
    if len(req.sequences) < 2:
        raise HTTPException(status_code=400, detail="Provide at least 2 protein sequences for MSA.")

    output_format = req.output_format.lower().strip()
    if output_format not in ("fasta", "clustal"):
        raise HTTPException(status_code=400, detail="output_format must be 'fasta' or 'clustal'.")

    # Validate and clean sequences
    try:
        seqs = []
        for s in req.sequences:
            clean_seq = s.seq.strip().upper().replace(" ", "").replace("\n", "")
            # Only keep valid amino acid characters
            valid_chars = "ACDEFGHIKLMNPQRSTVWY"
            clean_seq = "".join(c for c in clean_seq if c in valid_chars)
            
            if not clean_seq:
                raise HTTPException(status_code=400, detail=f"Sequence '{s.id}' is empty or contains no valid amino acids.")
            
            seqs.append(SeqRecord(Seq(clean_seq), id=s.id))
        
        # Run progressive alignment
        alignment = _progressive_alignment(seqs)
        
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
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Alignment failed: {str(e)}") from e


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