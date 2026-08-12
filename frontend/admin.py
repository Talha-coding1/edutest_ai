from django.contrib import admin
from django.contrib.auth.admin import UserAdmin as DefaultUserAdmin
from django.contrib.auth.models import User

from .models import AuditRecord, LearnerProfile, QuizAttempt, QuizQuestion

admin.site.site_header = "EduTest AI Administration"
admin.site.site_title = "EduTest AI Admin"
admin.site.index_title = "Supervisor Dashboard"


@admin.register(AuditRecord)
class AuditRecordAdmin(admin.ModelAdmin):
    """Lets a superuser (supervisor) see every user's activity in one place:
    which URLs each student analyzed, what score they got, and how far they
    got through the gamified fixes — via the built-in Django admin at /admin/.
    """
    list_display = (
        "user", "url", "grade", "overall", "total_xp",
        "completed_count", "total_count", "created_at",
    )
    list_filter = ("grade", "created_at", "user")
    search_fields = ("url", "user__username", "user__email")
    readonly_fields = (
        "user", "url", "created_at", "updated_at", "overall", "ml_score",
        "grade", "categories", "issues", "errors_count", "warnings_count",
        "total_xp", "max_xp", "completed_indexes", "earned_badges",
    )
    ordering = ("-created_at",)
    date_hierarchy = "created_at"

    def has_add_permission(self, request):
        # Records are only ever created by running a real audit.
        return False


@admin.register(QuizAttempt)
class QuizAttemptAdmin(admin.ModelAdmin):
    """Every quiz a student has actually finished, with its real minutes —
    this is what daily-goal progress and time-based quiz filtering are
    computed from."""
    list_display = ("user", "quiz_title", "minutes", "completed_at")
    list_filter = ("completed_at", "user")
    search_fields = ("quiz_title", "user__username")
    readonly_fields = ("user", "quiz_id", "quiz_title", "minutes", "completed_at")
    ordering = ("-completed_at",)
    date_hierarchy = "completed_at"

    def has_add_permission(self, request):
        return False


@admin.register(QuizQuestion)
class QuizQuestionAdmin(admin.ModelAdmin):
    """This is the review surface for the LLM-authored question bank
    (frontend/quiz_questions_data.py, loaded by migration 0008). Fully
    editable on purpose — every question here should be skimmed for
    accuracy before relying on it for a graded/live-demo quiz attempt.
    Fix the text/choices/correct_index/explanation directly here; changes
    take effect immediately, no redeploy needed."""
    list_display = ("quiz_id", "order", "text", "correct_index")
    list_filter = ("quiz_id",)
    search_fields = ("text", "quiz_id")
    ordering = ("quiz_id", "order")
    fields = ("quiz_id", "order", "text", "choices", "correct_index", "explanation")


class AuditRecordInline(admin.TabularInline):
    """Shown directly on a user's admin page — every URL that specific
    student analyzed, without having to filter the AuditRecord list."""
    model = AuditRecord
    extra = 0
    can_delete = False
    fields = ("url", "grade", "overall", "total_xp", "completed_count_display", "created_at")
    readonly_fields = ("url", "grade", "overall", "total_xp", "completed_count_display", "created_at")
    ordering = ("-created_at",)

    def has_add_permission(self, request, obj=None):
        return False

    @admin.display(description="Missions")
    def completed_count_display(self, obj):
        return f"{obj.completed_count}/{obj.total_count}"


class QuizAttemptInline(admin.TabularInline):
    """Every quiz this specific student has completed, shown right on
    their admin page."""
    model = QuizAttempt
    extra = 0
    can_delete = False
    fields = ("quiz_title", "minutes", "completed_at")
    readonly_fields = ("quiz_title", "minutes", "completed_at")
    ordering = ("-completed_at",)

    def has_add_permission(self, request, obj=None):
        return False


class LearnerProfileInline(admin.StackedInline):
    model = LearnerProfile
    can_delete = False
    fields = ("difficulty_levels", "learning_style", "daily_goal_minutes", "daily_goal_locked_at", "interests")


class UserAdmin(DefaultUserAdmin):
    """Default Django user admin, extended with each student's audit and
    quiz history inline, plus at-a-glance activity totals in the user list."""
    inlines = [LearnerProfileInline, AuditRecordInline, QuizAttemptInline]
    list_display = (
        "username", "email", "is_staff", "is_superuser",
        "audits_run", "total_xp_earned", "date_joined",
    )

    @admin.display(description="Audits Run")
    def audits_run(self, obj):
        return obj.audit_records.count()

    @admin.display(description="Total XP")
    def total_xp_earned(self, obj):
        return sum(r.total_xp for r in obj.audit_records.all())


admin.site.unregister(User)
admin.site.register(User, UserAdmin)
