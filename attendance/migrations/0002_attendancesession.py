from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion
import django.utils.timezone


class Migration(migrations.Migration):

    dependencies = [
        ('attendance', '0001_initial'),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.AlterModelOptions(
            name='attendance',
            options={
                'ordering': ['-date'],
                'verbose_name': 'Attendance (legacy)',
                'verbose_name_plural': 'Attendances (legacy)',
            },
        ),
        migrations.CreateModel(
            name='AttendanceSession',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('date', models.DateField(default=django.utils.timezone.localdate)),
                ('clock_in', models.DateTimeField()),
                ('clock_out', models.DateTimeField(null=True, blank=True)),
                ('work_hours', models.DecimalField(decimal_places=2, max_digits=5, null=True, blank=True)),
                ('night_hours', models.DecimalField(decimal_places=2, max_digits=5, null=True, blank=True)),
                ('notes', models.TextField(blank=True)),
                ('status', models.CharField(
                    choices=[('open', 'Open'), ('complete', 'Complete')],
                    default='open',
                    max_length=20
                )),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('user', models.ForeignKey(
                    on_delete=django.db.models.deletion.CASCADE,
                    related_name='sessions',
                    to=settings.AUTH_USER_MODEL
                )),
            ],
            options={
                'verbose_name': 'Attendance Session',
                'verbose_name_plural': 'Attendance Sessions',
                'ordering': ['-date', '-clock_in'],
            },
        ),
    ]