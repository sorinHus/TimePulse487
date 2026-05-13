from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ('leaves', '0005_leavebalance_expired_days'),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name='LeaveSchedule',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('year', models.PositiveIntegerField()),
                ('status', models.CharField(
                    choices=[('draft','Draft'),('submitted','Submitted'),('approved','Approved'),('rejected','Rejected')],
                    default='draft', max_length=20
                )),
                ('monthly_plan', models.JSONField(default=dict)),
                ('total_planned_days', models.DecimalField(decimal_places=1, default=0, max_digits=5)),
                ('review_note', models.TextField(blank=True)),
                ('reviewed_at', models.DateTimeField(blank=True, null=True)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('user', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='leave_schedules', to=settings.AUTH_USER_MODEL)),
                ('reviewed_by', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='reviewed_schedules', to=settings.AUTH_USER_MODEL)),
            ],
            options={'verbose_name': 'Leave Schedule', 'verbose_name_plural': 'Leave Schedules', 'ordering': ['-year']},
        ),
        migrations.AlterUniqueTogether(
            name='leaveschedule',
            unique_together={('user', 'year')},
        ),
    ]
