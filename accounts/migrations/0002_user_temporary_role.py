from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ('accounts', '0001_initial'),
    ]

    operations = [
        migrations.AddField(
            model_name='user',
            name='temporary_role',
            field=models.CharField(
                blank=True, null=True,
                max_length=20,
                choices=[
                    ('admin', 'Administrator'),
                    ('director', 'Director'),
                    ('manager', 'Manager'),
                    ('employee', 'Angajat'),
                ]
            ),
        ),
        migrations.AddField(
            model_name='user',
            name='temporary_role_start',
            field=models.DateField(null=True, blank=True),
        ),
        migrations.AddField(
            model_name='user',
            name='temporary_role_end',
            field=models.DateField(null=True, blank=True),
        ),
        migrations.AddField(
            model_name='user',
            name='substituting_for',
            field=models.ForeignKey(
                blank=True, null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name='substituted_by',
                to=settings.AUTH_USER_MODEL
            ),
        ),
    ]