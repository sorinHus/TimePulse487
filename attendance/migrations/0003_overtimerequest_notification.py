from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion
import django.db.models.aggregates


class Migration(migrations.Migration):

    dependencies = [
        ('attendance', '0002_attendancesession'),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name='OvertimeRequest',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('date', models.DateField()),
                ('requested_hours', models.DecimalField(decimal_places=2, max_digits=4)),
                ('approved_hours', models.DecimalField(decimal_places=2, max_digits=4, null=True, blank=True)),
                ('status', models.CharField(
                    choices=[
                        ('pending', 'Pending'),
                        ('approved', 'Approved'),
                        ('partially_approved', 'Partially Approved'),
                        ('rejected', 'Rejected'),
                    ],
                    default='pending',
                    max_length=25
                )),
                ('manager_note', models.TextField(blank=True)),
                ('requested_at', models.DateTimeField(auto_now_add=True)),
                ('reviewed_at', models.DateTimeField(null=True, blank=True)),
                ('user', models.ForeignKey(
                    on_delete=django.db.models.deletion.CASCADE,
                    related_name='overtime_requests',
                    to=settings.AUTH_USER_MODEL
                )),
                ('reviewed_by', models.ForeignKey(
                    null=True, blank=True,
                    on_delete=django.db.models.deletion.SET_NULL,
                    related_name='overtime_reviews',
                    to=settings.AUTH_USER_MODEL
                )),
            ],
            options={
                'verbose_name': 'Overtime Request',
                'verbose_name_plural': 'Overtime Requests',
                'ordering': ['-requested_at'],
            },
        ),
        migrations.AlterUniqueTogether(
            name='overtimerequest',
            unique_together={('user', 'date')},
        ),
        migrations.CreateModel(
            name='Notification',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('title', models.CharField(max_length=200)),
                ('message', models.TextField()),
                ('type', models.CharField(
                    choices=[
                        ('overtime', 'Overtime'),
                        ('leave', 'Leave'),
                        ('system', 'System'),
                    ],
                    default='system',
                    max_length=20
                )),
                ('is_read', models.BooleanField(default=False)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('user', models.ForeignKey(
                    on_delete=django.db.models.deletion.CASCADE,
                    related_name='notifications',
                    to=settings.AUTH_USER_MODEL
                )),
            ],
            options={
                'verbose_name': 'Notification',
                'verbose_name_plural': 'Notifications',
                'ordering': ['-created_at'],
            },
        ),
    ]