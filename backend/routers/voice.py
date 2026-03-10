"""Voice transcription endpoint: Whisper-based audio transcription + command parsing.
Extracted from server.py — pure mechanical move, zero behavior changes."""

import logging
import os
from typing import Optional, Dict, Any

from fastapi import APIRouter, HTTPException, Depends, File, UploadFile, Form

from dependencies import User, get_current_user

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api", tags=["voice"])


# ── Routes ────────────────────────────────────────────────────────

@router.post("/voice/transcribe")
async def transcribe_voice(
    file: UploadFile = File(...),
    language: Optional[str] = Form(None),
    user: User = Depends(get_current_user)
):
    """Transcribe voice audio to text using Whisper."""
    from openai import AsyncOpenAI

    api_key = os.environ.get('OPENAI_API_KEY')
    if not api_key:
        raise HTTPException(status_code=503, detail="Voice service not configured")

    # Check file type
    allowed_types = ["audio/mpeg", "audio/mp3", "audio/wav", "audio/webm", "audio/m4a", "audio/mp4"]
    content_type = file.content_type or ""
    if not any(t in content_type for t in ["audio", "video"]):
        raise HTTPException(status_code=400, detail="Invalid file type. Must be audio file.")

    try:
        # Read file content
        audio_content = await file.read()

        # Save to temp file (Whisper API expects file-like object)
        import tempfile
        with tempfile.NamedTemporaryFile(delete=False, suffix=".mp3") as temp_file:
            temp_file.write(audio_content)
            temp_path = temp_file.name

        client = AsyncOpenAI(api_key=api_key)
        with open(temp_path, "rb") as audio_file:
            response = await client.audio.transcriptions.create(
                model="whisper-1",
                file=audio_file,
                response_format="json",
                language=language  # ISO-639-1 format: en, es, fr, etc.
            )

        # Cleanup temp file
        os.unlink(temp_path)

        # Parse voice command (response is Transcription object with .text)
        text = response.text.strip().lower()
        command = parse_voice_command(text)

        return {
            "text": response.text,
            "command": command,
            "language": language
        }

    except Exception as e:
        logger.error(f"Voice transcription error: {e}")
        raise HTTPException(status_code=500, detail="Failed to transcribe audio")


# ── Helpers ───────────────────────────────────────────────────────

def parse_voice_command(text: str) -> Optional[Dict[str, Any]]:
    """Parse transcribed text into a poker command."""
    text = text.lower().strip()

    # Buy-in commands
    if "buy in" in text or "buy-in" in text or "buyin" in text:
        # Extract amount if present
        import re
        amount_match = re.search(r'\$?(\d+)', text)
        amount = int(amount_match.group(1)) if amount_match else None
        return {"type": "buy_in", "amount": amount}

    # Rebuy commands
    if "rebuy" in text or "re-buy" in text or "re buy" in text:
        import re
        amount_match = re.search(r'\$?(\d+)', text)
        amount = int(amount_match.group(1)) if amount_match else None
        return {"type": "rebuy", "amount": amount}

    # Cash out commands
    if "cash out" in text or "cashout" in text or "cash-out" in text:
        import re
        chips_match = re.search(r'(\d+)\s*(chips?)?', text)
        chips = int(chips_match.group(1)) if chips_match else None
        return {"type": "cash_out", "chips": chips}

    # Start game
    if "start game" in text or "start the game" in text or "begin game" in text:
        return {"type": "start_game"}

    # End game
    if "end game" in text or "end the game" in text or "finish game" in text:
        return {"type": "end_game"}

    # Check balance
    if "balance" in text or "how much" in text or "my chips" in text:
        return {"type": "check_balance"}

    # AI help
    if "help" in text or "suggest" in text or "what should i do" in text:
        return {"type": "ai_help"}

    return None
