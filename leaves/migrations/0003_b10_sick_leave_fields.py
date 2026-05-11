from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ('leaves', '0002_leaverequest_substitute'),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        # LeaveType: câmp is_sick_leave
        migrations.AddField(
            model_name='leavetype',
            name='is_sick_leave',
            field=models.BooleanField(default=False),
        ),
        # LeaveRequest: medical_document
        migrations.AddField(
            model_name='leaverequest',
            name='medical_document',
            field=models.CharField(blank=True, default='', max_length=500),
        ),
        # LeaveRequest: registered_by
        migrations.AddField(
            model_name='leaverequest',
            name='registered_by',
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name='registered_sick_leaves',
                to=settings.AUTH_USER_MODEL,
            ),
        ),
        # LeaveRequest: overlap_action
        migrations.AddField(
            model_name='leaverequest',
            name='overlap_action',
            field=models.CharField(
                blank=True,
                choices=[('return', 'Return days to balance'), ('extend', 'Extend leave after sick leave')],
                default='return',
                max_length=10,
            ),
        ),
    ]