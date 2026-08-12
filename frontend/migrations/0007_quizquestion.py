from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('frontend', '0006_chatthread_chatmessage'),
    ]

    operations = [
        migrations.CreateModel(
            name='QuizQuestion',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('quiz_id', models.CharField(db_index=True, max_length=60)),
                ('order', models.PositiveSmallIntegerField(default=0)),
                ('text', models.TextField()),
                ('choices', models.JSONField(default=list)),
                ('correct_index', models.PositiveSmallIntegerField(default=0)),
                ('explanation', models.TextField(blank=True)),
            ],
            options={
                'ordering': ['quiz_id', 'order'],
            },
        ),
    ]
