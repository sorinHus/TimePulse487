from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('leaves', '0003_b10_sick_leave_fields'),
    ]

    operations = [
        migrations.CreateModel(
            name='SeniorityRule',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('min_years', models.PositiveIntegerField(unique=True, help_text='Număr minim de ani de vechime')),
                ('extra_days', models.PositiveIntegerField(help_text='Zile extra de concediu de odihnă')),
                ('created_at', models.DateTimeField(auto_now_add=True)),
            ],
            options={
                'verbose_name': 'Seniority Rule',
                'verbose_name_plural': 'Seniority Rules',
                'ordering': ['min_years'],
            },
        ),
    ]