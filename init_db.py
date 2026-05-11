import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'timepulse487.settings')
django.setup()

from django.contrib.auth import get_user_model
User = get_user_model()

username = os.environ.get('DJANGO_SUPERUSER_USERNAME', 'sorin487')
email = os.environ.get('DJANGO_SUPERUSER_EMAIL', 'sorin@timepulse.app')
password = os.environ.get('DJANGO_SUPERUSER_PASSWORD', '')

if not User.objects.filter(username=username).exists():
    User.objects.create_superuser(username=username, email=email, password=password)
    user = User.objects.get(username=username)
    user.role = 'admin'
    user.save()
    print(f'Superuser {username} created with role=admin.')
else:
    user = User.objects.get(username=username)
    user.set_password(password)
    user.role = 'admin'
    user.is_staff = True
    user.is_superuser = True
    user.save()
    print(f'Updated {username}: password reset, role=admin.')

    # B10: Marchează Sick Leave type
from leaves.models import LeaveType
updated = LeaveType.objects.filter(name='Sick Leave').update(is_sick_leave=True)
if updated:
    print('Sick Leave type marked with is_sick_leave=True.')
else:
    print('WARNING: Sick Leave type not found — check seed data.')