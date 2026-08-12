"""
llm_engine.py
=================================================================
Server-side-only wrapper around the Groq Cloud API for the "LLM Tutor"
feature. Free, hosted, no local models. The API key never reaches the
browser — every call happens here, in a Django view.

Primary path : `groq` Python SDK (pip install groq)
Fallback path: direct REST call via `requests`, used automatically if
               the `groq` package isn't installed.

Config (from .env / Django settings):
  GROQ_API_KEY  — required, free key from https://console.groq.com
  GROQ_MODEL    — optional, defaults to "llama-3.1-8b-instant"

If not configured, ask_tutor() returns a clear, honest message instead
of crashing or faking a response — thread creation / message storage
in views.py still works normally either way.
=================================================================
"""
import requests
from django.conf import settings

SYSTEM_PROMPT = """You are the "LLM Tutor" inside EduTest AI, an educational app that \
teaches software testing, SEO fundamentals, website performance, and non-functional \
requirements (NFRs) like reliability, usability, and scalability.

Your job:
- Explain concepts clearly, at the level the learner seems to be at.
- Prefer concrete examples over abstract theory. Tie explanations back to real \
websites/pages where it helps.
- When asked to "quiz me" or for practice questions, generate 3-5 short questions on \
the topic being discussed, then wait for the learner's answers before revealing which \
were correct.
- Keep answers focused and well-structured (short paragraphs, bullet points, or \
numbered steps) — this is read on a chat panel, not a textbook page.
- Stay within this app's actual subject matter: software testing (manual and \
automated), SEO auditing, website performance (Core Web Vitals, load time, etc.), \
accessibility/web standards, and NFRs. If asked something unrelated, briefly say so \
and offer to redirect to a relevant angle if one exists.
- You do not have access to the learner's specific audit results or quiz history \
unless they paste that information into the chat themselves.
"""

MAX_REPLY_TOKENS = 800
GROQ_REST_URL = "https://api.groq.com/openai/v1/chat/completions"


def _api_key():
    return getattr(settings, "GROQ_API_KEY", "") or ""


def _model():
    return getattr(settings, "GROQ_MODEL", "") or "llama-3.1-8b-instant"


def is_configured():
    return bool(_api_key())


def ask_tutor(message_history):
    """message_history: list of {'role': 'user'|'assistant', 'content': str},
    oldest first, ending with the newest user message.

    Returns (reply_text: str, ok: bool). On any failure, ok=False and
    reply_text is a short, honest explanation — never a fabricated answer.
    """
    api_key = _api_key()
    if not api_key:
        return (
            "The LLM Tutor isn't connected yet — no GROQ_API_KEY is set. "
            "Get a free key at console.groq.com, add it to your .env file "
            "(see .env.example) and restart the server.",
            False,
        )

    try:
        import groq  # noqa: F401
        return _ask_groq_sdk(message_history, api_key)
    except ImportError:
        return _ask_groq_rest(message_history, api_key)


def _ask_groq_sdk(message_history, api_key):
    import groq

    try:
        client = groq.Groq(api_key=api_key)
        response = client.chat.completions.create(
            model=_model(),
            max_tokens=MAX_REPLY_TOKENS,
            messages=[{"role": "system", "content": SYSTEM_PROMPT}] + list(message_history),
        )
        text = (response.choices[0].message.content or "").strip()
        return (text or "I couldn't generate a response for that — try rephrasing?", True)
    except groq.AuthenticationError:
        return ("The configured GROQ_API_KEY was rejected — double-check it's correct.", False)
    except groq.RateLimitError:
        return ("Groq's free tier rate limit was hit — wait a moment and try again.", False)
    except groq.APIError as e:
        return (f"The Tutor's API call failed: {str(e)[:150]}", False)
    except Exception as e:
        return (f"Unexpected error talking to the Tutor: {str(e)[:150]}", False)


def _ask_groq_rest(message_history, api_key):
    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json",
    }
    payload = {
        "model": _model(),
        "max_tokens": MAX_REPLY_TOKENS,
        "messages": [{"role": "system", "content": SYSTEM_PROMPT}] + list(message_history),
    }

    try:
        resp = requests.post(GROQ_REST_URL, headers=headers, json=payload, timeout=30)
        if resp.status_code == 401:
            return ("The configured GROQ_API_KEY was rejected — double-check it's correct.", False)
        if resp.status_code == 429:
            return ("Groq's free tier rate limit was hit — wait a moment and try again.", False)
        resp.raise_for_status()
        text = resp.json()["choices"][0]["message"]["content"].strip()
        return (text or "I couldn't generate a response for that — try rephrasing?", True)
    except requests.exceptions.ConnectionError:
        return ("Couldn't reach Groq's API — check your internet connection.", False)
    except requests.exceptions.Timeout:
        return ("The Tutor's API call timed out — try again in a moment.", False)
    except requests.exceptions.HTTPError as e:
        return (f"The Tutor's API call failed: {str(e)[:150]}", False)
    except Exception as e:
        return (f"Unexpected error talking to the Tutor: {str(e)[:150]}", False)


def make_thread_title(first_message):
    """Turns the learner's first message into a short thread title,
    same pattern as most chat apps."""
    text = " ".join(first_message.split())
    return text[:57] + "..." if len(text) > 60 else (text or "New Conversation")
