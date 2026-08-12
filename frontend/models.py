from django.conf import settings
from django.db import models


class AuditRecord(models.Model):
    """One row per website analysis a user runs.

    Holds both the audit result (score/grade/categories/issues) and the
    live gamification progress for that specific audit (XP, which missions
    are cleared, which badges are earned) so a user can close the Game
    Console, come back later from their Dashboard, and pick up exactly
    where they left off on that particular audit.
    """

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="audit_records",
    )
    url = models.URLField(max_length=500)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    # --- audit result (from seo_engine.run_full_audit) ---
    overall = models.PositiveSmallIntegerField(default=0)
    ml_score = models.FloatField(default=0)
    grade = models.CharField(max_length=40, blank=True)
    categories = models.JSONField(default=dict, blank=True)
    issues = models.JSONField(default=list, blank=True)  # = game['tasks'] display list
    errors_count = models.PositiveSmallIntegerField(default=0)
    warnings_count = models.PositiveSmallIntegerField(default=0)

    # --- gamification progress for THIS audit ---
    total_xp = models.PositiveIntegerField(default=0)
    max_xp = models.PositiveIntegerField(default=0)
    completed_indexes = models.JSONField(default=list, blank=True)  # [0, 2, 5, ...]
    earned_badges = models.JSONField(default=list, blank=True)      # ["meta_master", ...]

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.user} · {self.url} · {self.overall}%"

    @property
    def completed_count(self):
        return len(self.completed_indexes or [])

    @property
    def total_count(self):
        return len(self.issues or [])

    @property
    def is_complete(self):
        return self.total_count > 0 and self.completed_count == self.total_count


def _default_difficulty_levels():
    """New learners start with 'Beginner' selected — easier entry point."""
    return ["beginner"]


class LearnerProfile(models.Model):
    """One row per user — persists the 'Learning Preferences' settings shown
    on the Profile page (difficulty level, learning style, daily goal), so
    they survive page reloads and can drive real behaviour elsewhere (e.g.
    filtering the Quiz page to the learner's chosen difficulty level).
    """

    DIFFICULTY_CHOICES = [
        ("beginner", "Beginner"),
        ("intermediate", "Intermediate"),
        ("advanced", "Advanced"),
    ]
    LEARNING_STYLE_CHOICES = [
        ("visual", "Visual"),
        ("auditory", "Auditory"),
        ("hands_on", "Hands-on"),
    ]
    # Maps a learner's chosen difficulty to the quiz-card difficulty label
    # used in quiz.html ("Easy"/"Medium"/"Hard").
    DIFFICULTY_TO_QUIZ_LEVEL = {
        "beginner": "easy",
        "intermediate": "medium",
        "advanced": "hard",
    }

    user = models.OneToOneField(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="learner_profile",
    )
    # A list, not a single value — a learner can pick any combination of
    # Beginner/Intermediate/Advanced (e.g. just one, two, or all three).
    difficulty_levels = models.JSONField(default=_default_difficulty_levels)
    learning_style = models.CharField(
        max_length=20, choices=LEARNING_STYLE_CHOICES, default="hands_on"
    )
    daily_goal_minutes = models.PositiveSmallIntegerField(default=45)
    # Set the moment a learner picks a daily goal; the slider stays disabled
    # (see LearnerProfile.is_goal_locked) until they've logged enough real
    # QuizAttempt minutes today to meet it, at which point this is cleared.
    daily_goal_locked_at = models.DateTimeField(null=True, blank=True)
    # Real, persisted tags the learner adds themselves on the Profile page —
    # starts empty rather than pre-filled with fake suggestions.
    interests = models.JSONField(default=list)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"{self.user} · {', '.join(self.difficulty_levels) or 'no levels selected'}"

    @property
    def difficulty_labels(self):
        """Human-readable labels for whichever levels are currently selected,
        e.g. ['Beginner', 'Advanced']."""
        choices = dict(self.DIFFICULTY_CHOICES)
        return [choices.get(d, d) for d in (self.difficulty_levels or [])]

    @property
    def quiz_difficulties(self):
        """The quiz-card difficulty labels ('easy'/'medium'/'hard') matching
        every level this learner has selected. Empty if none selected —
        callers should treat that as 'no filter, show everything'."""
        return [self.DIFFICULTY_TO_QUIZ_LEVEL.get(d, "medium") for d in (self.difficulty_levels or [])]


class QuizAttempt(models.Model):
    """One row per quiz a learner actually finishes. This is the real,
    persisted record that daily-goal progress and quiz time-filtering are
    computed from — not a guess or a client-side-only counter."""

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="quiz_attempts",
    )
    quiz_id = models.CharField(max_length=60)
    quiz_title = models.CharField(max_length=120)
    minutes = models.PositiveSmallIntegerField()
    completed_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-completed_at"]

    def __str__(self):
        return f"{self.user} · {self.quiz_title} · {self.minutes} min"


class QuizQuestion(models.Model):
    """One row per question in a quiz's question bank.

    Content is static and curated (Option C: LLM-assisted authoring,
    human-reviewed, then stored) — never generated live at quiz time.
    This keeps the quiz deterministic, gradable, free to run, and safe
    to demo: no risk of a wrong/ambiguous answer key appearing live.

    `quiz_id` matches the 'id' field of the matching entry in
    QUIZ_CATALOG (frontend/views.py) — there's no ForeignKey to a Quiz
    model because the catalog itself is still static Python data, same
    as before this feature was added.
    """

    quiz_id = models.CharField(max_length=60, db_index=True)
    order = models.PositiveSmallIntegerField(default=0)
    text = models.TextField()
    # 4 answer options, in display order — e.g.
    # ["Structured Query Language", "Simple Query Logic", ...]
    choices = models.JSONField(default=list)
    correct_index = models.PositiveSmallIntegerField(default=0)
    # Shown after the learner answers, reinforcing *why* — optional but
    # populated for every question in the initial authored set.
    explanation = models.TextField(blank=True)

    class Meta:
        ordering = ["quiz_id", "order"]

    def __str__(self):
        return f"{self.quiz_id} · Q{self.order + 1}: {self.text[:50]}"


class ChatThread(models.Model):
    """One row per LLM Tutor conversation. Title is auto-set from the first
    user message (like most chat apps) so the sidebar shows something
    meaningful without the user having to name it themselves."""

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="chat_threads",
    )
    title = models.CharField(max_length=120, default="New Conversation")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-updated_at"]

    def __str__(self):
        return f"{self.user} · {self.title}"


class ChatMessage(models.Model):
    """One row per message in a ChatThread — both the learner's messages
    and the LLM's real replies are stored here, nothing is client-only."""

    ROLE_CHOICES = [("user", "User"), ("assistant", "Assistant")]

    thread = models.ForeignKey(ChatThread, on_delete=models.CASCADE, related_name="messages")
    role = models.CharField(max_length=10, choices=ROLE_CHOICES)
    content = models.TextField()
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["created_at"]

    def __str__(self):
        return f"{self.role}: {self.content[:40]}"
