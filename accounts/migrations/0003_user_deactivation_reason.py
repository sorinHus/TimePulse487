from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('accounts', '0002_user_temporary_role'),
    ]

    operations = [
        migrations.AddField(
            model_name='user',
            name='deactivation_reason',
            field=models.TextField(blank=True, default=''),
        ),
    ]
