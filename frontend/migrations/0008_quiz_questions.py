from django.db import migrations


def load_quiz_questions(apps, schema_editor):
    """Populates QuizQuestion from the authored bank in
    frontend/quiz_questions_data.py. Skips any quiz_id that already has
    rows, so this is safe to re-run (e.g. after a partial migrate)."""
    QuizQuestion = apps.get_model('frontend', 'QuizQuestion')
    from frontend.quiz_questions_data import QUIZ_QUESTIONS

    existing_quiz_ids = set(QuizQuestion.objects.values_list('quiz_id', flat=True).distinct())

    to_create = []
    for quiz_id, items in QUIZ_QUESTIONS.items():
        if quiz_id in existing_quiz_ids:
            continue
        for order, (text, choices, correct_index, explanation) in enumerate(items):
            to_create.append(QuizQuestion(
                quiz_id=quiz_id,
                order=order,
                text=text,
                choices=choices,
                correct_index=correct_index,
                explanation=explanation,
            ))

    if to_create:
        QuizQuestion.objects.bulk_create(to_create)


def remove_quiz_questions(apps, schema_editor):
    """Reverse: clears every row this migration would have loaded."""
    QuizQuestion = apps.get_model('frontend', 'QuizQuestion')
    from frontend.quiz_questions_data import QUIZ_QUESTIONS
    QuizQuestion.objects.filter(quiz_id__in=list(QUIZ_QUESTIONS.keys())).delete()


class Migration(migrations.Migration):

    dependencies = [
        ('frontend', '0007_quizquestion'),
    ]

    operations = [
        migrations.RunPython(load_quiz_questions, remove_quiz_questions),
    ]
