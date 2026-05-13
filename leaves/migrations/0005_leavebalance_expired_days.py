from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('leaves', '0004_seniority_rule'),
    ]

    operations = [
        migrations.AddField(
            model_name='leavebalance',
            name='expired_days',
            field=models.DecimalField(max_digits=5, decimal_places=1, default=0),
        ),
    ]
